use crate::errors::{AppError, AppResult};
use crate::modules::order::model::{DoctorRevenue, OrderSummary};
use crate::utils::helpers::payment_status;
use crate::utils::money::{from_paise, to_paise};
use crate::utils::validation::{validate_amount, validate_positive_id, validate_test_ids};
use chrono::Datelike;
use rusqlite::{params, Connection, OptionalExtension, Transaction};

fn next_order_number(tx: &Transaction<'_>) -> AppResult<String> {
    let year = chrono::Local::now().year();
    let prefix = format!("LAB-{}-", year);
    let like_pattern = format!("{}%", prefix);

    let next_number: i32 = tx
        .query_row(
            "SELECT IFNULL(MAX(CAST(SUBSTR(order_number, 10) AS INTEGER)), 0) + 1
             FROM orders
             WHERE order_number LIKE ?1",
            [like_pattern],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    Ok(format!("{}{:04}", prefix, next_number))
}

fn next_invoice_number(tx: &Transaction<'_>) -> AppResult<String> {
    let year = chrono::Local::now().year();
    let prefix = format!("INV-{}-", year);
    let like_pattern = format!("{}%", prefix);

    let next_number: i32 = tx
        .query_row(
            "SELECT IFNULL(MAX(CAST(SUBSTR(invoice_no, 10) AS INTEGER)), 0) + 1
             FROM orders
             WHERE invoice_no LIKE ?1",
            [like_pattern],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    Ok(format!("{}{:04}", prefix, next_number))
}

fn unique_ids(ids: &[i32]) -> Vec<i32> {
    let mut unique = Vec::new();

    for id in ids {
        if !unique.contains(id) {
            unique.push(*id);
        }
    }

    unique
}

fn doctor_share_basis_points(conn: &Connection) -> AppResult<i64> {
    let value: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'doctor_share'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(AppError::from)?;
    let mut share = value
        .as_deref()
        .unwrap_or("40")
        .trim()
        .trim_end_matches('%')
        .trim()
        .parse::<f64>()
        .map_err(|_| AppError::ValidationError("Doctor share setting is invalid".into()))?;

    if !share.is_finite() || !(0.0..=100.0).contains(&share) {
        return Err(AppError::ValidationError("Doctor share must be between 0 and 100%".into()));
    }

    if share > 1.0 {
        share /= 100.0;
    }

    Ok((share * 10_000.0).round() as i64)
}

fn commission_for(basis_paise: i64, rate_basis_points: i64) -> i64 {
    ((basis_paise as i128 * rate_basis_points as i128 + 5_000) / 10_000) as i64
}

fn create_doctor_commission_snapshot(
    tx: &Transaction<'_>,
    order_id: i32,
    patient_id: i32,
    eligible_amount_paise: i64,
) -> AppResult<()> {
    let referred_by: Option<String> = tx
        .query_row("SELECT referred_by FROM patients WHERE id = ?1", [patient_id], |row| row.get(0))
        .map_err(AppError::from)?;
    let Some(doctor_name) = referred_by
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty() && !name.eq_ignore_ascii_case("self"))
    else {
        return Ok(());
    };

    let has_table: bool = tx
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='doctor_commissions'",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map(|count| count > 0)
        .unwrap_or(false);

    if !has_table {
        return Ok(());
    }

    let doctor_id: Option<i32> = tx
        .query_row(
            "SELECT id FROM doctors WHERE name = ?1 COLLATE NOCASE LIMIT 1",
            [&doctor_name],
            |row| row.get(0),
        )
        .optional()
        .map_err(AppError::from)?;
    let rate_basis_points = doctor_share_basis_points(tx)?;
    let commission_paise = commission_for(eligible_amount_paise, rate_basis_points);
    tx.execute(
        "INSERT INTO doctor_commissions (
            order_id, doctor_id, doctor_name_snapshot, eligible_amount_paise,
            share_rate_basis_points, commission_paise
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![order_id, doctor_id, doctor_name, eligible_amount_paise, rate_basis_points, commission_paise],
    )
    .map_err(AppError::from)?;
    Ok(())
}

fn record_order_commission_adjustment(
    tx: &Transaction<'_>,
    order_id: i32,
    new_eligible_amount_paise: i64,
    reason: &str,
) -> AppResult<()> {
    let has_table: bool = tx
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='doctor_commissions'",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map(|count| count > 0)
        .unwrap_or(false);

    if !has_table {
        return Ok(());
    }

    let snapshot: Option<(i32, i64, i64)> = tx
        .query_row(
            "SELECT dc.id, dc.share_rate_basis_points,
                    dc.commission_paise + IFNULL((
                        SELECT SUM(amount_delta_paise)
                        FROM doctor_commission_adjustments
                        WHERE commission_id = dc.id
                    ), 0)
             FROM doctor_commissions dc WHERE dc.order_id = ?1",
            [order_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(AppError::from)?;
    let Some((commission_id, rate_basis_points, current_paise)) = snapshot else {
        return Ok(());
    };
    let delta_paise = commission_for(new_eligible_amount_paise, rate_basis_points) - current_paise;
    if delta_paise != 0 {
        tx.execute(
            "INSERT INTO doctor_commission_adjustments (commission_id, amount_delta_paise, reason)
             VALUES (?1, ?2, ?3)",
            params![commission_id, delta_paise, reason],
        )
        .map_err(AppError::from)?;
    }
    Ok(())
}

#[allow(dead_code)]
pub fn create_order(
    conn: &mut Connection,
    patient_id: i32,
    test_ids: Vec<i32>,
    parameter_ids: Vec<i32>,
    total_amount: f64,
    discount_amount: f64,
) -> AppResult<i32> {
    create_order_with_prices(
        conn,
        patient_id,
        test_ids,
        parameter_ids,
        total_amount,
        discount_amount,
        None,
    )
}

pub fn create_order_with_prices(
    conn: &mut Connection,
    patient_id: i32,
    test_ids: Vec<i32>,
    parameter_ids: Vec<i32>,
    total_amount: f64,
    discount_amount: f64,
    custom_prices: Option<std::collections::HashMap<i32, f64>>,
) -> AppResult<i32> {
    validate_positive_id(patient_id, "patient_id")?;
    validate_test_ids(&test_ids)?;
    validate_amount(total_amount)?;
    validate_amount(discount_amount)?;

    let test_ids = unique_ids(&test_ids);
    let parameter_ids = unique_ids(&parameter_ids);

    let frontend_total_paise = to_paise(total_amount)?;
    let discount_amount_paise = to_paise(discount_amount)?;

    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate).map_err(AppError::from)?;

    let patient_exists: i32 = tx
        .query_row(
            "SELECT COUNT(*)
             FROM patients
             WHERE id = ?1",
            [patient_id],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    if patient_exists == 0 {
        return Err(AppError::NotFound(format!("Patient {} not found", patient_id)));
    }

    let mut test_snapshots: Vec<(i32, String, i64)> = Vec::new();
    let mut subtotal_paise: i64 = 0;

    for test_id in &test_ids {
        validate_positive_id(*test_id, "test_id")?;

        let test_row: Option<(String, f64)> = tx
            .query_row(
                "SELECT name, price
                 FROM tests
                 WHERE id = ?1
                   AND IFNULL(is_active, 1) = 1",
                [test_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(AppError::from)?;

        let Some((test_name, price)) = test_row else {
            return Err(AppError::NotFound(format!(
                "Test {} not found or inactive",
                test_id
            )));
        };

        let effective_price = match &custom_prices {
            Some(map) if map.contains_key(test_id) => {
                let cp = map[test_id];
                validate_amount(cp)?;
                cp
            }
            _ => price,
        };

        let price_paise = to_paise(effective_price)?;
        subtotal_paise += price_paise;

        test_snapshots.push((*test_id, test_name, price_paise));
    }

    if discount_amount_paise > subtotal_paise {
        return Err(AppError::BusinessLogicError(
            "Discount cannot exceed subtotal".to_string(),
        ));
    }

    let computed_total_paise = subtotal_paise - discount_amount_paise;

    if frontend_total_paise != computed_total_paise {
        return Err(AppError::BusinessLogicError(
            "Order total mismatch. Please refresh test catalog and try again.".to_string(),
        ));
    }

    let order_number = next_order_number(&tx)?;
    let invoice_no = next_invoice_number(&tx)?;

    tx.execute(
        "INSERT INTO orders (
            patient_id,
            total_amount_paise,
            discount_amount_paise,
            paid_amount_paise,
            invoice_no,
            order_number,
            status
         )
         VALUES (?1, ?2, ?3, 0, ?4, ?5, 'Pending')",
        params![
            patient_id,
            computed_total_paise,
            discount_amount_paise,
            invoice_no,
            order_number,
        ],
    )
    .map_err(AppError::from)?;

    let order_id = tx.last_insert_rowid() as i32;

    for (test_id, test_name, price_paise) in &test_snapshots {
        tx.execute(
            "INSERT INTO order_tests (
                order_id,
                test_id,
                test_name_snapshot,
                price_paise
             )
             VALUES (?1, ?2, ?3, ?4)",
            params![order_id, test_id, test_name, price_paise],
        )
        .map_err(AppError::from)?;
    }

    let mut selected_parameters: Vec<(i32, String, String, String)> = Vec::new();

    if parameter_ids.is_empty() {
        for test_id in &test_ids {
            let mut stmt = tx
                .prepare(
                    "SELECT id, name, IFNULL(unit, ''), IFNULL(normal_range, '')
                     FROM test_parameters
                     WHERE test_id = ?1
                       AND IFNULL(is_active, 1) = 1
                     ORDER BY id ASC",
                )
                .map_err(AppError::from)?;

            let rows = stmt
                .query_map([test_id], |row| {
                    Ok((
                        row.get::<_, i32>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                    ))
                })
                .map_err(AppError::from)?;

            for row in rows {
                selected_parameters.push(row.map_err(AppError::from)?);
            }
        }
    } else {
        for parameter_id in &parameter_ids {
            validate_positive_id(*parameter_id, "parameter_id")?;

            let parameter_row: Option<(i32, String, String, String)> = tx
                .query_row(
                    "SELECT
                        tp.id,
                        tp.name,
                        IFNULL(tp.unit, ''),
                        IFNULL(tp.normal_range, '')
                     FROM test_parameters tp
                     JOIN order_tests ot
                       ON ot.test_id = tp.test_id
                      AND ot.order_id = ?1
                     WHERE tp.id = ?2
                       AND IFNULL(tp.is_active, 1) = 1",
                    params![order_id, parameter_id],
                    |row| {
                        Ok((
                            row.get::<_, i32>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, String>(2)?,
                            row.get::<_, String>(3)?,
                        ))
                    },
                )
                .optional()
                .map_err(AppError::from)?;

            let Some(parameter) = parameter_row else {
                return Err(AppError::NotFound(format!(
                    "Parameter {} not found, inactive, or not linked to selected tests",
                    parameter_id
                )));
            };

            selected_parameters.push(parameter);
        }
    }

    if selected_parameters.is_empty() {
        return Err(AppError::BusinessLogicError(
            "At least one sub test must be selected".to_string(),
        ));
    }

    for (parameter_id, parameter_name, unit, normal_range) in selected_parameters {
        tx.execute(
            "INSERT INTO order_parameters (
                order_id,
                parameter_id,
                parameter_name_snapshot,
                unit_snapshot,
                normal_range_snapshot
             )
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![order_id, parameter_id, parameter_name, unit, normal_range],
        )
        .map_err(AppError::from)?;
    }

    create_doctor_commission_snapshot(&tx, order_id, patient_id, computed_total_paise)?;

    tx.commit().map_err(AppError::from)?;

    Ok(order_id)
}

pub fn get_orders(conn: &Connection) -> AppResult<Vec<OrderSummary>> {
        let mut stmt = conn.prepare(
                "SELECT o.id, p.name,
                                COALESCE(GROUP_CONCAT(COALESCE(ot.test_name_snapshot, t.name), ', '), 'No tests'),
                                IFNULL(o.total_amount_paise, 0), IFNULL(o.paid_amount_paise, 0),
                                IFNULL(o.created_at, ''),
                                CASE
                                        WHEN IFNULL(o.status, '') = 'Cancelled' THEN 'Cancelled'
                                        WHEN (SELECT COUNT(*) FROM order_parameters WHERE order_id = o.id) = 0
                                            OR (SELECT COUNT(*) FROM results WHERE order_id = o.id AND TRIM(value) <> '') = 0 THEN 'Pending'
                                        WHEN (SELECT COUNT(*) FROM results WHERE order_id = o.id AND TRIM(value) <> '')
                                                 < (SELECT COUNT(*) FROM order_parameters WHERE order_id = o.id) THEN 'Partial'
                                        ELSE 'Completed'
                                END,
                                COALESCE(NULLIF(o.order_number, ''), 'LAB-' || o.id),
                                IFNULL(p.patient_code, ''),
                                COALESCE(NULLIF(o.invoice_no, ''), 'INV-' || o.id)
                 FROM orders o
                 JOIN patients p ON p.id = o.patient_id
                 LEFT JOIN order_tests ot ON ot.order_id = o.id
                 LEFT JOIN tests t ON t.id = ot.test_id
                 GROUP BY o.id, p.name, o.total_amount_paise, o.paid_amount_paise, o.created_at, o.order_number, p.patient_code, o.invoice_no
                 ORDER BY o.id DESC",
        ).map_err(AppError::from)?;
    let rows = stmt.query_map([], |row| {
        let total_paise: i64 = row.get(3)?;
        let paid_paise: i64 = row.get(4)?;
        Ok(OrderSummary {
            id: row.get(0)?,
            patient_name: row.get(1)?,
            tests: row.get(2)?,
            total_amount: from_paise(total_paise),
            paid_amount: from_paise(paid_paise),
            pending_amount: from_paise((total_paise - paid_paise).max(0)),
            status: payment_status(total_paise, paid_paise),
            report_status: row.get(6)?,
            created_at: row.get(5)?,
            order_number: row.get(7)?,
            patient_code: row.get(8)?,
            invoice_no: row.get(9)?,
        })
    }).map_err(AppError::from)?;
    rows.map(|row| row.map_err(AppError::from)).collect()
}

pub fn get_order_status(conn: &Connection, order_id: i32) -> AppResult<String> {
    validate_positive_id(order_id, "order_id")?;
    let status: Option<String> = conn.query_row(
        "SELECT status FROM orders WHERE id = ?1",
        [order_id],
        |row| row.get(0),
    ).optional().map_err(AppError::from)?.flatten();

    if let Some(ref s) = status {
        if s == "Cancelled" {
            return Ok("Cancelled".to_string());
        }
    }

    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM order_parameters WHERE order_id = ?1",
        [order_id],
        |row| row.get(0),
    ).map_err(AppError::from)?;
    let filled: i32 = conn.query_row(
        "SELECT COUNT(*) FROM results WHERE order_id = ?1 AND TRIM(value) <> ''",
        [order_id],
        |row| row.get(0),
    ).map_err(AppError::from)?;
    Ok(if count == 0 || filled == 0 { "Pending" } else if filled < count { "Partial" } else { "Completed" }.to_string())
}

pub fn get_orders_by_date_range(
    conn: &Connection,
    date_from: &str,
    date_to: &str,
) -> AppResult<Vec<OrderSummary>> {
    let has_from = !date_from.trim().is_empty();
    let has_to = !date_to.trim().is_empty();

    let sql_base = "SELECT o.id, p.name,
                COALESCE(GROUP_CONCAT(COALESCE(ot.test_name_snapshot, t.name), ', '), 'No tests'),
                IFNULL(o.total_amount_paise, 0), IFNULL(o.paid_amount_paise, 0),
                IFNULL(o.created_at, ''),
                CASE
                    WHEN IFNULL(o.status, '') = 'Cancelled' THEN 'Cancelled'
                    WHEN (SELECT COUNT(*) FROM order_parameters WHERE order_id = o.id) = 0
                      OR (SELECT COUNT(*) FROM results WHERE order_id = o.id AND TRIM(value) <> '') = 0 THEN 'Pending'
                    WHEN (SELECT COUNT(*) FROM results WHERE order_id = o.id AND TRIM(value) <> '')
                         < (SELECT COUNT(*) FROM order_parameters WHERE order_id = o.id) THEN 'Partial'
                    ELSE 'Completed'
                END,
                COALESCE(NULLIF(o.order_number, ''), 'LAB-' || o.id),
                IFNULL(p.patient_code, ''),
                COALESCE(NULLIF(o.invoice_no, ''), 'INV-' || o.id)
         FROM orders o
         JOIN patients p ON p.id = o.patient_id
         LEFT JOIN order_tests ot ON ot.order_id = o.id
         LEFT JOIN tests t ON t.id = ot.test_id";

    let sql_suffix = "GROUP BY o.id, p.name, o.total_amount_paise, o.paid_amount_paise, o.created_at, o.order_number, p.patient_code, o.invoice_no
         ORDER BY o.id DESC";

    let (query_sql, params_vec): (String, Vec<String>) = match (has_from, has_to) {
        (true, true) => (
            format!("{} WHERE o.created_at >= ?1 AND o.created_at < date(?2, '+1 day') {}", sql_base, sql_suffix),
            vec![date_from.trim().to_string(), date_to.trim().to_string()],
        ),
        (true, false) => (
            format!("{} WHERE o.created_at >= ?1 {}", sql_base, sql_suffix),
            vec![date_from.trim().to_string()],
        ),
        (false, true) => (
            format!("{} WHERE o.created_at < date(?1, '+1 day') {}", sql_base, sql_suffix),
            vec![date_to.trim().to_string()],
        ),
        (false, false) => (
            format!("{} {}", sql_base, sql_suffix),
            vec![],
        ),
    };

    let mut stmt = conn.prepare(&query_sql).map_err(AppError::from)?;
    let map_row = |row: &rusqlite::Row| {
        let total_paise: i64 = row.get(3)?;
        let paid_paise: i64 = row.get(4)?;
        Ok(OrderSummary {
            id: row.get(0)?,
            patient_name: row.get(1)?,
            tests: row.get(2)?,
            total_amount: from_paise(total_paise),
            paid_amount: from_paise(paid_paise),
            pending_amount: from_paise((total_paise - paid_paise).max(0)),
            status: payment_status(total_paise, paid_paise),
            report_status: row.get(6)?,
            created_at: row.get(5)?,
            order_number: row.get(7)?,
            patient_code: row.get(8)?,
            invoice_no: row.get(9)?,
        })
    };

    let rows = match params_vec.len() {
        2 => stmt.query_map(params![params_vec[0], params_vec[1]], map_row).map_err(AppError::from)?,
        1 => stmt.query_map(params![params_vec[0]], map_row).map_err(AppError::from)?,
        _ => stmt.query_map([], map_row).map_err(AppError::from)?,
    };

    rows.map(|row| row.map_err(AppError::from)).collect()
}

pub fn get_doctor_revenue(
    conn: &Connection,
    date_from: &str,
    date_to: &str,
) -> AppResult<Vec<DoctorRevenue>> {
    let rate_basis_points = doctor_share_basis_points(conn)?;
    let has_from = !date_from.trim().is_empty();
    let has_to = !date_to.trim().is_empty();

    let (co_date_clause, o_date_clause, params_vec): (String, String, Vec<String>) = match (has_from, has_to) {
        (true, true) => (
            "AND co.created_at >= ?1 AND co.created_at < date(?2, '+1 day')".to_string(),
            "AND o.created_at >= ?1 AND o.created_at < date(?2, '+1 day')".to_string(),
            vec![date_from.trim().to_string(), date_to.trim().to_string()],
        ),
        (true, false) => (
            "AND co.created_at >= ?1".to_string(),
            "AND o.created_at >= ?1".to_string(),
            vec![date_from.trim().to_string()],
        ),
        (false, true) => (
            "AND co.created_at < date(?1, '+1 day')".to_string(),
            "AND o.created_at < date(?1, '+1 day')".to_string(),
            vec![date_to.trim().to_string()],
        ),
        (false, false) => (
            "".to_string(),
            "".to_string(),
            vec![],
        ),
    };

    let sql = format!(
        "WITH doctor_roster AS (
            SELECT id AS doctor_id, name FROM doctors WHERE TRIM(name) <> ''
            UNION ALL
            SELECT NULL, p.referred_by FROM patients p
            WHERE p.referred_by IS NOT NULL AND TRIM(p.referred_by) <> '' AND p.referred_by <> 'Self'
              AND NOT EXISTS (SELECT 1 FROM doctors d WHERE d.name = p.referred_by COLLATE NOCASE)
            GROUP BY p.referred_by COLLATE NOCASE
         )
         SELECT d.doctor_id, d.name, COUNT(DISTINCT o.id), IFNULL(SUM(o.total_amount_paise), 0),
            IFNULL((SELECT SUM(dc.commission_paise + IFNULL((SELECT SUM(amount_delta_paise)
                FROM doctor_commission_adjustments WHERE commission_id = dc.id), 0))
                FROM doctor_commissions dc JOIN orders co ON co.id = dc.order_id
                WHERE ((d.doctor_id IS NOT NULL AND dc.doctor_id = d.doctor_id)
                    OR (d.doctor_id IS NULL AND dc.doctor_name_snapshot = d.name))
                  {}), 0),
            IFNULL((SELECT SUM(amount_paise) FROM doctor_commission_settlements ds
                WHERE d.doctor_id IS NOT NULL AND ds.doctor_id = d.doctor_id), 0),
            IFNULL((SELECT SUM(dc.commission_paise + IFNULL((SELECT SUM(amount_delta_paise)
                FROM doctor_commission_adjustments WHERE commission_id = dc.id), 0))
                     FROM doctor_commissions dc
                     WHERE (d.doctor_id IS NOT NULL AND dc.doctor_id = d.doctor_id)
                         OR (d.doctor_id IS NULL AND dc.doctor_name_snapshot = d.name)), 0)
            - IFNULL((SELECT SUM(amount_paise) FROM doctor_commission_settlements ds
                WHERE d.doctor_id IS NOT NULL AND ds.doctor_id = d.doctor_id), 0),
            MAX(o.created_at),
            COUNT(DISTINCT CASE WHEN o.id IS NOT NULL AND NOT EXISTS
                (SELECT 1 FROM doctor_commissions dc WHERE dc.order_id = o.id) THEN o.id END)
         FROM doctor_roster d
         LEFT JOIN patients p ON p.referred_by = d.name COLLATE NOCASE
         LEFT JOIN orders o ON o.patient_id = p.id AND IFNULL(o.status, '') <> 'Cancelled'
             {}
         GROUP BY d.doctor_id, d.name ORDER BY 5 DESC, 3 DESC, d.name ASC",
        co_date_clause, o_date_clause
    );

    let mut stmt = conn.prepare(&sql).map_err(AppError::from)?;
    let map_doc = |row: &rusqlite::Row| {
        let referrals: i32 = row.get(2)?;
        let eligible = from_paise(row.get(3)?);
        let earned = from_paise(row.get(4)?);
        let paid = from_paise(row.get(5)?);
        let outstanding = from_paise(row.get::<_, i64>(6)?.max(0));
        Ok(DoctorRevenue {
            order_count: referrals,
            total_amount: eligible,
            paid_amount: paid,
            pending_amount: outstanding,
            share_amount: earned,
            doctor_id: row.get(0)?,
            doctor_name: row.get(1)?,
            referral_count: referrals,
            eligible_amount: eligible,
            share_percentage: rate_basis_points as f64 / 100.0,
            commission_earned: earned,
            commission_paid: paid,
            commission_outstanding: outstanding,
            last_referral: row.get::<_, Option<String>>(7)?.unwrap_or_default(),
            legacy_order_count: row.get(8)?,
        })
    };

    let rows = match params_vec.len() {
        2 => stmt.query_map(params![params_vec[0], params_vec[1]], map_doc).map_err(AppError::from)?,
        1 => stmt.query_map(params![params_vec[0]], map_doc).map_err(AppError::from)?,
        _ => stmt.query_map([], map_doc).map_err(AppError::from)?,
    };

    rows.map(|row| row.map_err(AppError::from)).collect()
}

pub fn cancel_order(conn: &mut Connection, order_id: i32) -> AppResult<()> {
    validate_positive_id(order_id, "order_id")?;

    let tx = conn
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(AppError::from)?;
    let current_status: String = tx
        .query_row(
            "SELECT IFNULL(status, 'Pending') FROM orders WHERE id = ?1",
            [order_id],
            |row| row.get(0),
        )
        .map_err(|_| AppError::NotFound(format!("Order {} not found", order_id)))?;

    if current_status == "Cancelled" {
        return Err(AppError::BusinessLogicError(
            "Order is already cancelled".to_string(),
        ));
    }

    record_order_commission_adjustment(&tx, order_id, 0, "Order cancelled")?;
    tx.execute(
        "UPDATE orders SET status = 'Cancelled' WHERE id = ?1",
        params![order_id],
    )
    .map_err(AppError::from)?;

    tx.commit().map_err(AppError::from)?;

    Ok(())
}

#[allow(dead_code)]
pub fn update_order(
    conn: &mut Connection,
    order_id: i32,
    test_ids: Vec<i32>,
    parameter_ids: Vec<i32>,
    total_amount: f64,
    discount_amount: f64,
) -> AppResult<()> {
    update_order_with_prices(
        conn,
        order_id,
        test_ids,
        parameter_ids,
        total_amount,
        discount_amount,
        None,
    )
}

pub fn update_order_with_prices(
    conn: &mut Connection,
    order_id: i32,
    test_ids: Vec<i32>,
    parameter_ids: Vec<i32>,
    total_amount: f64,
    discount_amount: f64,
    custom_prices: Option<std::collections::HashMap<i32, f64>>,
) -> AppResult<()> {
    validate_positive_id(order_id, "order_id")?;
    validate_test_ids(&test_ids)?;
    validate_amount(total_amount)?;
    validate_amount(discount_amount)?;

    let current_status: String = conn
        .query_row(
            "SELECT IFNULL(status, 'Pending') FROM orders WHERE id = ?1",
            [order_id],
            |row| row.get(0),
        )
        .map_err(|_| AppError::NotFound(format!("Order {} not found", order_id)))?;

    if current_status == "Cancelled" {
        return Err(AppError::BusinessLogicError(
            "Cannot edit a cancelled order".to_string(),
        ));
    }

    if current_status == "Completed" {
        return Err(AppError::BusinessLogicError(
            "Cannot edit a completed order".to_string(),
        ));
    }

    let test_ids = unique_ids(&test_ids);
    let parameter_ids = unique_ids(&parameter_ids);

    let frontend_total_paise = to_paise(total_amount)?;
    let discount_amount_paise = to_paise(discount_amount)?;

    let tx = conn
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(AppError::from)?;

    let mut subtotal_paise: i64 = 0;
    let mut test_snapshots: Vec<(i32, String, i64)> = Vec::new();

    for test_id in &test_ids {
        validate_positive_id(*test_id, "test_id")?;

        let test_row: Option<(String, f64)> = tx
            .query_row(
                "SELECT name, price
                 FROM tests
                 WHERE id = ?1
                   AND IFNULL(is_active, 1) = 1",
                [test_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(AppError::from)?;

        let Some((test_name, price)) = test_row else {
            return Err(AppError::NotFound(format!(
                "Test {} not found or inactive",
                test_id
            )));
        };

        let effective_price = match &custom_prices {
            Some(map) if map.contains_key(test_id) => {
                let cp = map[test_id];
                validate_amount(cp)?;
                cp
            }
            _ => price,
        };

        let price_paise = to_paise(effective_price)?;
        subtotal_paise += price_paise;
        test_snapshots.push((*test_id, test_name, price_paise));
    }

    if discount_amount_paise > subtotal_paise {
        return Err(AppError::BusinessLogicError(
            "Discount cannot exceed subtotal".to_string(),
        ));
    }

    let computed_total_paise = subtotal_paise - discount_amount_paise;

    if frontend_total_paise != computed_total_paise {
        return Err(AppError::BusinessLogicError(
            "Order total mismatch. Please refresh test catalog and try again.".to_string(),
        ));
    }

    tx.execute(
        "UPDATE orders
         SET total_amount_paise = ?1,
             discount_amount_paise = ?2
         WHERE id = ?3",
        params![
            computed_total_paise,
            discount_amount_paise,
            order_id,
        ],
    )
    .map_err(AppError::from)?;

    record_order_commission_adjustment(&tx, order_id, computed_total_paise, "Order corrected")?;

    tx.execute(
        "DELETE FROM order_tests WHERE order_id = ?1",
        params![order_id],
    )
    .map_err(AppError::from)?;

    tx.execute(
        "DELETE FROM order_parameters WHERE order_id = ?1",
        params![order_id],
    )
    .map_err(AppError::from)?;

    tx.execute(
        "DELETE FROM results WHERE order_id = ?1",
        params![order_id],
    )
    .map_err(AppError::from)?;

    for (test_id, test_name, price_paise) in &test_snapshots {
        tx.execute(
            "INSERT INTO order_tests (
                order_id, test_id, test_name_snapshot, price_paise
             )
             VALUES (?1, ?2, ?3, ?4)",
            params![order_id, test_id, test_name, price_paise],
        )
        .map_err(AppError::from)?;
    }

    let mut selected_parameters: Vec<(i32, String, String, String)> = Vec::new();

    if parameter_ids.is_empty() {
        for test_id in &test_ids {
            let mut stmt = tx
                .prepare(
                    "SELECT id, name, IFNULL(unit, ''), IFNULL(normal_range, '')
                     FROM test_parameters
                     WHERE test_id = ?1
                       AND IFNULL(is_active, 1) = 1
                     ORDER BY id ASC",
                )
                .map_err(AppError::from)?;

            let rows = stmt
                .query_map([test_id], |row| {
                    Ok((
                        row.get::<_, i32>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                    ))
                })
                .map_err(AppError::from)?;

            for row in rows {
                selected_parameters.push(row.map_err(AppError::from)?);
            }
        }
    } else {
        for parameter_id in &parameter_ids {
            validate_positive_id(*parameter_id, "parameter_id")?;

            let parameter_row: Option<(i32, String, String, String)> = tx
                .query_row(
                    "SELECT
                        tp.id,
                        tp.name,
                        IFNULL(tp.unit, ''),
                        IFNULL(tp.normal_range, '')
                     FROM test_parameters tp
                     WHERE tp.id = ?1
                       AND IFNULL(tp.is_active, 1) = 1",
                    params![parameter_id],
                    |row| {
                        Ok((
                            row.get::<_, i32>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, String>(2)?,
                            row.get::<_, String>(3)?,
                        ))
                    },
                )
                .optional()
                .map_err(AppError::from)?;

            let Some(parameter) = parameter_row else {
                return Err(AppError::NotFound(format!(
                    "Parameter {} not found or inactive",
                    parameter_id
                )));
            };

            selected_parameters.push(parameter);
        }
    }

    if selected_parameters.is_empty() {
        return Err(AppError::BusinessLogicError(
            "At least one sub test must be selected".to_string(),
        ));
    }

    for (parameter_id, parameter_name, unit, normal_range) in selected_parameters {
        tx.execute(
            "INSERT INTO order_parameters (
                order_id, parameter_id, parameter_name_snapshot, unit_snapshot, normal_range_snapshot
             )
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![order_id, parameter_id, parameter_name, unit, normal_range],
        )
        .map_err(AppError::from)?;
    }

    tx.commit().map_err(AppError::from)?;

    Ok(())
}

pub fn add_tests_to_order(

    conn: &mut Connection,

    order_id: i32,

    test_ids: Vec<i32>,

    custom_prices: Option<std::collections::HashMap<i32, f64>>,

) -> AppResult<()> {

    validate_positive_id(order_id, "order_id")?;

    validate_test_ids(&test_ids)?;



    let test_ids = unique_ids(&test_ids);



    let tx = conn

        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)

        .map_err(AppError::from)?;



    let current_order: Option<(String, i64)> = tx

        .query_row(

            "SELECT IFNULL(status, 'Pending'), IFNULL(total_amount_paise, 0)

             FROM orders WHERE id = ?1",

            [order_id],

            |row| Ok((row.get(0)?, row.get(1)?)),

        )

        .optional()

        .map_err(AppError::from)?;



    let Some((current_status, current_total_paise)) = current_order else {

        return Err(AppError::NotFound(format!("Order {} not found", order_id)));

    };



    if current_status == "Cancelled" {

        return Err(AppError::BusinessLogicError(

            "Cannot add tests to a cancelled order".to_string(),

        ));

    }



    // Check for tests already present on this order

    {

        let mut existing_test_ids_stmt = tx

            .prepare("SELECT test_id FROM order_tests WHERE order_id = ?1")

            .map_err(AppError::from)?;

        let existing_test_ids_iter = existing_test_ids_stmt

            .query_map([order_id], |row| row.get::<_, i32>(0))

            .map_err(AppError::from)?;

        let mut existing_test_ids = std::collections::HashSet::new();

        for id in existing_test_ids_iter {

            existing_test_ids.insert(id.map_err(AppError::from)?);

        }



        for test_id in &test_ids {

            if existing_test_ids.contains(test_id) {

                let test_name: String = tx

                    .query_row("SELECT name FROM tests WHERE id = ?1", [test_id], |row| row.get(0))

                    .unwrap_or_else(|_| format!("#{}", test_id));

                return Err(AppError::BusinessLogicError(format!(

                    "Test '{}' is already attached to this order",

                    test_name

                )));

            }

        }

    }



    let mut added_paise: i64 = 0;

    let mut test_snapshots: Vec<(i32, String, i64)> = Vec::new();



    for test_id in &test_ids {

        let test_row: Option<(String, f64)> = tx

            .query_row(

                "SELECT name, price

                 FROM tests

                 WHERE id = ?1

                   AND IFNULL(is_active, 1) = 1",

                [test_id],

                |row| Ok((row.get(0)?, row.get(1)?)),

            )

            .optional()

            .map_err(AppError::from)?;



        let Some((test_name, price)) = test_row else {

            return Err(AppError::NotFound(format!(

                "Test {} not found or inactive",

                test_id

            )));

        };



        let effective_price = match &custom_prices {

            Some(map) if map.contains_key(test_id) => {

                let cp = map[test_id];

                validate_amount(cp)?;

                cp

            }

            _ => price,

        };



        let price_paise = to_paise(effective_price)?;

        added_paise += price_paise;

        test_snapshots.push((*test_id, test_name, price_paise));

    }



    for (test_id, test_name, price_paise) in &test_snapshots {

        tx.execute(

            "INSERT INTO order_tests (

                order_id, test_id, test_name_snapshot, price_paise

             )

             VALUES (?1, ?2, ?3, ?4)",

            params![order_id, test_id, test_name, price_paise],

        )

        .map_err(AppError::from)?;



        let mut param_stmt = tx

            .prepare(

                "SELECT id, name, IFNULL(unit, ''), IFNULL(normal_range, '')

                 FROM test_parameters

                 WHERE test_id = ?1

                   AND IFNULL(is_active, 1) = 1

                 ORDER BY id ASC",

            )

            .map_err(AppError::from)?;



        let param_rows = param_stmt

            .query_map([test_id], |row| {

                Ok((

                    row.get::<_, i32>(0)?,

                    row.get::<_, String>(1)?,

                    row.get::<_, String>(2)?,

                    row.get::<_, String>(3)?,

                ))

            })

            .map_err(AppError::from)?;



        for p in param_rows {

            let (param_id, param_name, unit, normal_range) = p.map_err(AppError::from)?;

            tx.execute(

                "INSERT INTO order_parameters (

                    order_id, parameter_id, parameter_name_snapshot, unit_snapshot, normal_range_snapshot

                 )

                 VALUES (?1, ?2, ?3, ?4, ?5)",

                params![order_id, param_id, param_name, unit, normal_range],

            )

            .map_err(AppError::from)?;

        }

    }



    let new_total_paise = current_total_paise + added_paise;



    tx.execute(

        "UPDATE orders

         SET total_amount_paise = ?1,

             status = CASE WHEN status = 'Completed' THEN 'Pending' ELSE status END

         WHERE id = ?2",

        params![new_total_paise, order_id],

    )

    .map_err(AppError::from)?;



    record_order_commission_adjustment(&tx, order_id, new_total_paise, "Tests added to order")?;



    tx.commit().map_err(AppError::from)?;



    Ok(())

}



pub fn update_order_status(
    conn: &mut Connection,
    order_id: i32,
    new_status: &str,
) -> AppResult<()> {
    validate_positive_id(order_id, "order_id")?;

    let valid_statuses = ["Pending", "In Progress", "Completed", "Cancelled"];
    if !valid_statuses.contains(&new_status) {
        return Err(AppError::BusinessLogicError(format!(
            "Invalid status '{}'. Valid statuses: {}",
            new_status,
            valid_statuses.join(", ")
        )));
    }

    let current_status: String = conn
        .query_row(
            "SELECT IFNULL(status, 'Pending') FROM orders WHERE id = ?1",
            [order_id],
            |row| row.get(0),
        )
        .map_err(|_| AppError::NotFound(format!("Order {} not found", order_id)))?;

    if current_status == "Cancelled" {
        return Err(AppError::BusinessLogicError(
            "Cannot change status of a cancelled order".to_string(),
        ));
    }

    conn.execute(
        "UPDATE orders SET status = ?1 WHERE id = ?2",
        params![new_status, order_id],
    )
    .map_err(AppError::from)?;

    Ok(())
}
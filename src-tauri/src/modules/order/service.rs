use crate::errors::{AppError, AppResult};
use crate::modules::order::model::OrderSummary;
use crate::utils::money::{from_paise, to_paise};
use crate::utils::validation::{validate_amount, validate_positive_id, validate_test_ids};
use rusqlite::{params, Connection, OptionalExtension};

fn unique_ids(ids: &[i32]) -> Vec<i32> {
    let mut unique = Vec::new();

    for id in ids {
        if !unique.contains(id) {
            unique.push(*id);
        }
    }

    unique
}

fn payment_status(total_paise: i64, paid_paise: i64) -> String {
    if paid_paise <= 0 {
        "Pending".to_string()
    } else if paid_paise < total_paise {
        "Partial".to_string()
    } else {
        "Completed".to_string()
    }
}

pub fn create_order(
    conn: &mut Connection,
    patient_id: i32,
    test_ids: Vec<i32>,
    parameter_ids: Vec<i32>,
    total_amount: f64,
    discount_amount: f64,
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

        let price_paise = to_paise(price)?;
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
        "INSERT INTO orders (
            patient_id,
            total_amount,
            total_amount_paise,
            discount_amount,
            discount_amount_paise,
            paid_amount,
            paid_amount_paise
         )
         VALUES (?1, ?2, ?3, ?4, ?5, 0, 0)",
        params![
            patient_id,
            from_paise(computed_total_paise),
            computed_total_paise,
            from_paise(discount_amount_paise),
            discount_amount_paise,
        ],
    )
    .map_err(AppError::from)?;

    let order_id = tx.last_insert_rowid() as i32;
    let invoice_no = format!("INV-{}", order_id);

    tx.execute(
        "UPDATE orders
         SET invoice_no = ?1
         WHERE id = ?2",
        params![invoice_no, order_id],
    )
    .map_err(AppError::from)?;

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

    tx.commit().map_err(AppError::from)?;

    Ok(order_id)
}

pub fn get_orders(conn: &Connection) -> AppResult<Vec<OrderSummary>> {
    let mut stmt = conn
        .prepare(
            "SELECT
                o.id,
                p.name,
                COALESCE(
                    GROUP_CONCAT(COALESCE(ot.test_name_snapshot, t.name), ', '),
                    'No tests'
                ),
                IFNULL(o.total_amount_paise, 0),
                IFNULL(o.paid_amount_paise, 0),
                IFNULL(o.created_at, '')
             FROM orders o
             JOIN patients p ON p.id = o.patient_id
             LEFT JOIN order_tests ot ON ot.order_id = o.id
             LEFT JOIN tests t ON t.id = ot.test_id
             GROUP BY
                o.id,
                p.name,
                o.total_amount_paise,
                o.paid_amount_paise,
                o.created_at
             ORDER BY o.id DESC",
        )
        .map_err(AppError::from)?;

    let rows = stmt
        .query_map([], |row| {
            let total_paise = row.get::<_, i64>(3)?;
            let paid_paise = row.get::<_, i64>(4)?;
            let pending_paise = (total_paise - paid_paise).max(0);

            Ok(OrderSummary {
                id: row.get(0)?,
                patient_name: row.get(1)?,
                tests: row.get(2)?,
                total_amount: from_paise(total_paise),
                paid_amount: from_paise(paid_paise),
                pending_amount: from_paise(pending_paise),
                status: payment_status(total_paise, paid_paise),
                created_at: row.get(5)?,
            })
        })
        .map_err(AppError::from)?;

    rows.map(|row| row.map_err(AppError::from)).collect()
}

pub fn get_order_status(conn: &Connection, order_id: i32) -> AppResult<String> {
    validate_positive_id(order_id, "order_id")?;


    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*)
             FROM order_parameters
             WHERE order_id = ?1",
            [order_id],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    let filled: i32 = conn
        .query_row(
            "SELECT COUNT(*)
             FROM results
             WHERE order_id = ?1
               AND TRIM(value) <> ''",
            [order_id],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    let status = if count == 0 || filled == 0 {
        "Pending"
    } else if filled < count {
        "Partial"
    } else {
        "Completed"
    };

    Ok(status.to_string())
}
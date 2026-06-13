use crate::errors::{AppError, AppResult};
use crate::utils::money::from_paise;
use crate::utils::validation::validate_positive_id;
use rusqlite::Connection;

use super::model::{
    HistoryOrder, HistoryPayment, HistoryReport, PatientHistoryResponse, PatientProfile,
    PreviousResultEntry, PreviousResultGroup, TimelineEntry,
};

pub fn get_patient_history(conn: &Connection, patient_id: i32) -> AppResult<PatientHistoryResponse> {
    validate_positive_id(patient_id, "patient_id")?;

    // Verify patient exists
    let patient_exists: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM patients WHERE id = ?1",
            [patient_id],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    if patient_exists == 0 {
        return Err(AppError::NotFound(format!(
            "Patient {} not found",
            patient_id
        )));
    }

    // ── Patient Profile ──
    let patient = conn
        .query_row(
            "SELECT id, IFNULL(patient_code, ''), name, age_value, age_unit,
                    gender, phone, referred_by, IFNULL(created_at, '')
             FROM patients
             WHERE id = ?1",
            [patient_id],
            |row| {
                Ok(PatientProfile {
                    id: row.get(0)?,
                    patient_code: row.get(1)?,
                    name: row.get(2)?,
                    age_value: row.get(3)?,
                    age_unit: row.get(4)?,
                    gender: row.get(5)?,
                    phone: row.get(6)?,
                    referred_by: row.get(7)?,
                    created_at: row.get(8)?,
                })
            },
        )
        .map_err(AppError::from)?;

    // ── Orders (latest 10) ──
    let mut order_stmt = conn
        .prepare(
            "SELECT o.id, COALESCE(NULLIF(o.invoice_no, ''), 'INV-' || o.id),
                    IFNULL(o.total_amount_paise, 0), IFNULL(o.paid_amount_paise, 0),
                    IFNULL(o.status, ''), IFNULL(o.created_at, ''),
                    GROUP_CONCAT(COALESCE(NULLIF(ot.test_name_snapshot, ''), t.name), ', ')
             FROM orders o
             LEFT JOIN order_tests ot ON ot.order_id = o.id
             LEFT JOIN tests t ON t.id = ot.test_id
             WHERE o.patient_id = ?1
             GROUP BY o.id
             ORDER BY o.created_at DESC
             LIMIT 10",
        )
        .map_err(AppError::from)?;

    let orders: Vec<HistoryOrder> = order_stmt
        .query_map([patient_id], |row| {
            let total_paise: i64 = row.get(2)?;
            let paid_paise: i64 = row.get(3)?;
            let pending_paise = (total_paise - paid_paise).max(0);
            let status_str: String = row.get(4)?;
            Ok(HistoryOrder {
                id: row.get(0)?,
                invoice_no: row.get(1)?,
                total_amount: from_paise(total_paise),
                paid_amount: from_paise(paid_paise),
                pending_amount: from_paise(pending_paise),
                status: status_str,
                created_at: row.get(5)?,
                test_names: row.get(6)?,
            })
        })
        .map_err(AppError::from)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::from)?;

    // ── Payments (latest 10) ──
    let mut payment_stmt = conn
        .prepare(
            "SELECT ph.id, ph.order_id,
                    COALESCE(NULLIF(o.invoice_no, ''), 'INV-' || o.id),
                    IFNULL(ph.previous_paid_paise, 0), ph.new_paid_paise,
                    ph.total_amount_paise, IFNULL(ph.created_at, '')
             FROM payment_history ph
             JOIN orders o ON o.id = ph.order_id
             WHERE o.patient_id = ?1
             ORDER BY ph.created_at DESC
             LIMIT 10",
        )
        .map_err(AppError::from)?;

    let payments: Vec<HistoryPayment> = payment_stmt
        .query_map([patient_id], |row| {
            Ok(HistoryPayment {
                id: row.get(0)?,
                order_id: row.get(1)?,
                invoice_no: row.get(2)?,
                previous_paid: from_paise(row.get::<_, i64>(3)?),
                new_paid: from_paise(row.get::<_, i64>(4)?),
                total_amount: from_paise(row.get::<_, i64>(5)?),
                created_at: row.get(6)?,
            })
        })
        .map_err(AppError::from)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::from)?;

    // ── Reports (latest 10 — results with values) ──
    let mut report_stmt = conn
        .prepare(
            "SELECT o.id,
                    COALESCE(NULLIF(o.invoice_no, ''), 'INV-' || o.id),
                    COALESCE(NULLIF(ot.test_name_snapshot, ''), t.name),
                    COALESCE(NULLIF(op.parameter_name_snapshot, ''), tp.name),
                    IFNULL(r.value, ''),
                    COALESCE(NULLIF(op.unit_snapshot, ''), tp.unit, ''),
                    COALESCE(NULLIF(op.normal_range_snapshot, ''), tp.normal_range, ''),
                    IFNULL(o.created_at, '')
             FROM results r
             JOIN orders o ON o.id = r.order_id
             JOIN order_parameters op ON op.order_id = r.order_id AND op.parameter_id = r.parameter_id
             JOIN test_parameters tp ON tp.id = r.parameter_id
             JOIN tests t ON t.id = tp.test_id
             JOIN order_tests ot ON ot.order_id = r.order_id AND ot.test_id = tp.test_id
             WHERE o.patient_id = ?1
               AND TRIM(r.value) <> ''
             ORDER BY r.rowid DESC
             LIMIT 10",
        )
        .map_err(AppError::from)?;

    let reports: Vec<HistoryReport> = report_stmt
        .query_map([patient_id], |row| {
            Ok(HistoryReport {
                order_id: row.get(0)?,
                invoice_no: row.get(1)?,
                test_name: row.get(2)?,
                parameter_name: row.get(3)?,
                value: row.get(4)?,
                unit: row.get(5)?,
                normal_range: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(AppError::from)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::from)?;

    // ── Previous Results (grouped by parameter, all time) ──
    let mut prev_stmt = conn
        .prepare(
            "SELECT COALESCE(NULLIF(op.parameter_name_snapshot, ''), tp.name),
                    COALESCE(NULLIF(ot.test_name_snapshot, ''), t.name),
                    COALESCE(NULLIF(op.unit_snapshot, ''), tp.unit, ''),
                    COALESCE(NULLIF(op.normal_range_snapshot, ''), tp.normal_range, ''),
                    o.id,
                    COALESCE(NULLIF(o.invoice_no, ''), 'INV-' || o.id),
                    IFNULL(o.created_at, ''),
                    IFNULL(r.value, '')
             FROM results r
             JOIN orders o ON o.id = r.order_id
             JOIN order_parameters op ON op.order_id = r.order_id AND op.parameter_id = r.parameter_id
             JOIN test_parameters tp ON tp.id = r.parameter_id
             JOIN tests t ON t.id = tp.test_id
             JOIN order_tests ot ON ot.order_id = r.order_id AND ot.test_id = tp.test_id
             WHERE o.patient_id = ?1
               AND TRIM(r.value) <> ''
             ORDER BY tp.id, r.rowid DESC",
        )
        .map_err(AppError::from)?;

    let rows: Vec<(String, String, String, String, i32, String, String, String)> = prev_stmt
        .query_map([patient_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i32>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, String>(7)?,
            ))
        })
        .map_err(AppError::from)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::from)?;

    let mut prev_groups: Vec<PreviousResultGroup> = Vec::new();

    for (param_name, test_name, unit, normal_range, order_id, invoice_no, order_date, value) in rows {
        // Find existing group or create new one
        let group = prev_groups.iter_mut().find(|g| {
            g.parameter_name == param_name && g.test_name == test_name
        });

        match group {
            Some(g) => {
                g.entries.push(PreviousResultEntry {
                    order_id,
                    invoice_no,
                    order_date,
                    value,
                });
            }
            None => {
                prev_groups.push(PreviousResultGroup {
                    parameter_name: param_name,
                    test_name,
                    unit,
                    normal_range,
                    entries: vec![PreviousResultEntry {
                        order_id,
                        invoice_no,
                        order_date,
                        value,
                    }],
                });
            }
        }
    }

    // ── Timeline (chronological, newest first) ──
    let mut timeline: Vec<TimelineEntry> = Vec::new();

    // Patient created
    timeline.push(TimelineEntry {
        event_type: "patient_created".to_string(),
        description: format!("Patient registered with code {}", patient.patient_code),
        timestamp: patient.created_at.clone(),
        order_id: None,
    });

    // Orders placed
    let mut t_stmt = conn
        .prepare(
            "SELECT id, COALESCE(NULLIF(invoice_no, ''), 'INV-' || id), IFNULL(total_amount_paise, 0), IFNULL(created_at, '')
             FROM orders
             WHERE patient_id = ?1
             ORDER BY created_at DESC",
        )
        .map_err(AppError::from)?;

    let order_rows: Vec<(i32, String, i64, String)> = t_stmt
        .query_map([patient_id], |row| {
            Ok((
                row.get::<_, i32>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(AppError::from)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::from)?;

    for (oid, inv, total, created) in &order_rows {
        timeline.push(TimelineEntry {
            event_type: "order".to_string(),
            description: format!("Order {} placed — ₹{:.2}", inv, from_paise(*total)),
            timestamp: created.clone(),
            order_id: Some(*oid),
        });
    }

    // Payments made
    let mut tp_stmt = conn
        .prepare(
            "SELECT ph.order_id, ph.new_paid_paise, ph.total_amount_paise, IFNULL(ph.created_at, ''),
                    COALESCE(NULLIF(o.invoice_no, ''), 'INV-' || o.id)
             FROM payment_history ph
             JOIN orders o ON o.id = ph.order_id
             WHERE o.patient_id = ?1
             ORDER BY ph.created_at DESC",
        )
        .map_err(AppError::from)?;

    let pay_rows: Vec<(i32, i64, i64, String, String)> = tp_stmt
        .query_map([patient_id], |row| {
            Ok((
                row.get::<_, i32>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .map_err(AppError::from)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::from)?;

    for (oid, new_paid, total, created, inv) in &pay_rows {
        timeline.push(TimelineEntry {
            event_type: "payment".to_string(),
            description: format!(
                "Payment of ₹{:.2} received for {} (total: ₹{:.2})",
                from_paise(*new_paid),
                inv,
                from_paise(*total)
            ),
            timestamp: created.clone(),
            order_id: Some(*oid),
        });
    }

    // Results entered
    let mut tr_stmt = conn
        .prepare(
            "SELECT r.order_id, IFNULL(o.created_at, ''),
                    COALESCE(NULLIF(op.parameter_name_snapshot, ''), tp.name),
                    IFNULL(r.value, ''),
                    COALESCE(NULLIF(o.invoice_no, ''), 'INV-' || o.id)
             FROM results r
             JOIN orders o ON o.id = r.order_id
             JOIN order_parameters op ON op.order_id = r.order_id AND op.parameter_id = r.parameter_id
             JOIN test_parameters tp ON tp.id = r.parameter_id
             WHERE o.patient_id = ?1
               AND TRIM(r.value) <> ''
             ORDER BY o.created_at DESC",
        )
        .map_err(AppError::from)?;

    let res_rows: Vec<(i32, String, String, String, String)> = tr_stmt
        .query_map([patient_id], |row| {
            Ok((
                row.get::<_, i32>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .map_err(AppError::from)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(AppError::from)?;

    for (oid, created, param_name, value, inv) in &res_rows {
        timeline.push(TimelineEntry {
            event_type: "result".to_string(),
            description: format!(
                "Result for '{}' recorded: {} for {}",
                param_name, value, inv
            ),
            timestamp: created.clone(),
            order_id: Some(*oid),
        });
    }

    // Sort timeline newest first
    timeline.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    Ok(PatientHistoryResponse {
        patient,
        orders,
        payments,
        reports,
        previous_results: prev_groups,
        timeline,
    })
}
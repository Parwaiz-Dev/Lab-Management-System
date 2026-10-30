use crate::errors::{AppError, AppResult};
use crate::utils::validation::validate_positive_id;
use rusqlite::{params, Connection};

use super::model::{ReportPatientInfo, ReportRow};

fn ensure_order_exists(conn: &Connection, order_id: i32) -> AppResult<()> {
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM orders WHERE id = ?1",
            [order_id],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    if count == 0 {
        return Err(AppError::NotFound(format!("Order {} not found", order_id)));
    }

    Ok(())
}

fn format_age_sex(age_value: i32, age_unit: &str, gender: &str) -> String {
    let unit = match age_unit.trim().to_lowercase().as_str() {
        u if u.starts_with("year") => "Year",
        u if u.starts_with("month") => "Month",
        u if u.starts_with("day") => "Days",
        _ => "Year",
    };
    let gender_cap = match gender.trim().to_lowercase().as_str() {
        g if g.starts_with("male") => "Male",
        g if g.starts_with("female") => "Female",
        g if g.starts_with("other") => "Other",
        _ => "-",
    };

    if age_value > 0 {
        format!("{} {} | {}", age_value, unit, gender_cap)
    } else {
        format!("- | {}", gender_cap)
    }
}

fn format_indian_datetime(dt_str: &str) -> String {
    let clean = dt_str.trim();
    if clean.is_empty() {
        return "-".to_string();
    }

    if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(clean) {
        let local = parsed.with_timezone(&chrono::Local);
        return local.format("%d-%m-%Y %I:%M:%S %p").to_string();
    }

    if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(clean, "%Y-%m-%d %H:%M:%S") {
        return naive.format("%d-%m-%Y %I:%M:%S %p").to_string();
    }

    clean.to_string()
}

pub fn get_report(conn: &Connection, order_id: i32) -> AppResult<Vec<ReportRow>> {
    validate_positive_id(order_id, "order_id")?;

    ensure_order_exists(conn, order_id)?;

    let mut stmt = conn
        .prepare(
            "SELECT
                COALESCE(NULLIF(ot.test_name_snapshot, ''), t.name),
                COALESCE(NULLIF(op.parameter_name_snapshot, ''), tp.name),
                IFNULL(r.value, ''),
                COALESCE(NULLIF(op.unit_snapshot, ''), tp.unit, ''),
                COALESCE(NULLIF(op.normal_range_snapshot, ''), tp.normal_range, ''),
                CASE
                    WHEN r.value IS NOT NULL AND TRIM(r.value) <> '' THEN 1
                    ELSE 0
                END
             FROM order_parameters op
             JOIN test_parameters tp ON tp.id = op.parameter_id
             JOIN tests t ON t.id = tp.test_id
             JOIN order_tests ot
               ON ot.order_id = op.order_id
              AND ot.test_id = tp.test_id
             LEFT JOIN results r
               ON r.order_id = op.order_id
              AND r.parameter_id = op.parameter_id
             WHERE op.order_id = ?1
             ORDER BY ot.id ASC, op.id ASC",
        )
        .map_err(AppError::from)?;

    let rows = stmt
        .query_map([order_id], |row| {
            let is_entered_number: i32 = row.get(5)?;

            Ok(ReportRow {
                test_name: row.get(0)?,
                parameter_name: row.get(1)?,
                value: row.get(2)?,
                unit: row.get(3)?,
                normal_range: row.get(4)?,
                is_entered: is_entered_number == 1,
            })
        })
        .map_err(AppError::from)?;

    rows.map(|row| row.map_err(AppError::from)).collect()
}

pub fn get_patient_by_order(conn: &Connection, order_id: i32) -> AppResult<ReportPatientInfo> {
    validate_positive_id(order_id, "order_id")?;

    ensure_order_exists(conn, order_id)?;

    let patient = conn
        .query_row(
            "SELECT
                p.name,
                IFNULL(p.patient_code, ''),
                IFNULL(p.age_value, 0),
                IFNULL(p.age_unit, ''),
                IFNULL(p.gender, 'Unknown'),
                IFNULL(p.phone, ''),
                COALESCE(NULLIF(p.referred_by, ''), 'Self'),
                COALESCE(NULLIF(o.invoice_no, ''), 'INV-' || o.id),
                IFNULL(o.created_at, '')
             FROM orders o
             JOIN patients p ON p.id = o.patient_id
             WHERE o.id = ?1",
            params![order_id],
            |row| {
                let age_value: i32 = row.get(2)?;
                let age_unit: String = row.get(3)?;
                let gender: String = row.get(4)?;
                let age_sex = format_age_sex(age_value, &age_unit, &gender);

                let raw_order_date: String = row.get(8)?;
                let collection_time = format_indian_datetime(&raw_order_date);
                let reporting_time = chrono::Local::now().format("%d-%m-%Y %I:%M:%S %p").to_string();

                Ok(ReportPatientInfo {
                    patient_name: row.get(0)?,
                    patient_code: row.get(1)?,
                    age_value,
                    age_unit,
                    gender,
                    age_sex,
                    phone: row.get(5)?,
                    referred_by: row.get(6)?,
                    invoice_no: row.get(7)?,
                    order_date: raw_order_date,
                    collection_time,
                    reporting_time,
                })
            },
        )
        .map_err(AppError::from)?;

    Ok(patient)
}

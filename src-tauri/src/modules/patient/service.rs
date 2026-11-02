use crate::errors::{AppError, AppResult};
use crate::utils::validation::{
    validate_age, validate_doctor_name, validate_patient_name, validate_phone,
    validate_positive_id,
};
use chrono::Datelike;
use rusqlite::{params, Connection, Transaction};

use super::model::{DoctorRecord, Patient};

fn clean_optional_text(value: Option<String>) -> Option<String> {
    value
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

fn normalize_age_unit(age_unit: Option<String>) -> AppResult<String> {
    let value = age_unit
        .unwrap_or_else(|| "Years".to_string())
        .trim()
        .to_string();

    match value.as_str() {
        "Years" | "Months" | "Days" => Ok(value),
        _ => Err(AppError::ValidationError(
            "Age unit must be Years, Months, or Days".to_string(),
        )),
    }
}

fn normalize_gender(gender: Option<String>) -> AppResult<String> {
    let value = gender
        .unwrap_or_else(|| "Male".to_string())
        .trim()
        .to_string();

    match value.as_str() {
        "Male" | "Female" | "Other" => Ok(value),
        _ => Err(AppError::ValidationError(
            "Gender must be Male, Female, or Other".to_string(),
        )),
    }
}

fn normalize_referred_by(referred_by: Option<String>) -> Option<String> {
    clean_optional_text(referred_by).and_then(|value| {
        if value.eq_ignore_ascii_case("self") {
            None
        } else {
            Some(value)
        }
    })
}

fn next_patient_code(tx: &Transaction<'_>) -> AppResult<String> {
    let year = chrono::Local::now().year();
    let prefix = format!("PID-{}-", year);
    let like_pattern = format!("{}%", prefix);

    let next_number: i32 = tx
        .query_row(
            "SELECT IFNULL(MAX(CAST(SUBSTR(patient_code, 10) AS INTEGER)), 0) + 1
             FROM patients
             WHERE patient_code LIKE ?1",
            [like_pattern],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    Ok(format!("{}{:04}", prefix, next_number))
}

pub fn create_patient(
    conn: &mut Connection,
    name: String,
    age_value: Option<i32>,
    age_unit: Option<String>,
    gender: Option<String>,
    phone: Option<String>,
    referred_by: Option<String>,
) -> AppResult<i32> {
    let cleaned_name = name.trim().to_string();

    validate_patient_name(&cleaned_name)?;

    if let Some(age) = age_value {
        validate_age(age)?;
    }

    let cleaned_age_unit = normalize_age_unit(age_unit)?;
    let cleaned_gender = normalize_gender(gender)?;

    let cleaned_phone = clean_optional_text(phone);

    if let Some(ref phone_value) = cleaned_phone {
        validate_phone(phone_value)?;
    }

    let cleaned_referred_by = normalize_referred_by(referred_by);

    if let Some(ref doctor_name) = cleaned_referred_by {
        validate_doctor_name(doctor_name)?;
    }

    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate).map_err(AppError::from)?;

    let code = next_patient_code(&tx)?;

    tx.execute(
        "INSERT INTO patients (
            patient_code,
            name,
            age_value,
            age_unit,
            gender,
            phone,
            referred_by
         )
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            code,
            cleaned_name,
            age_value,
            cleaned_age_unit,
            cleaned_gender,
            cleaned_phone,
            cleaned_referred_by,
        ],
    )
    .map_err(AppError::from)?;

    let id = tx.last_insert_rowid() as i32;

    tx.commit().map_err(AppError::from)?;

    log::info!("Created patient {} with code {}", id, code);

    Ok(id)
}

pub fn search_patients(conn: &Connection, query: String) -> AppResult<Vec<Patient>> {
    let cleaned_query = query.trim();

    if cleaned_query.is_empty() {
        let mut stmt = conn
            .prepare(
                "SELECT
                    id,
                    IFNULL(patient_code, ''),
                    name,
                    age_value,
                    age_unit,
                    gender,
                    phone,
                    referred_by,
                    IFNULL(created_at, '')
                 FROM patients
                 ORDER BY id DESC
                 LIMIT 100",
            )
            .map_err(AppError::from)?;

        let patients = stmt
            .query_map([], |row| {
                Ok(Patient {
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
            })
            .map_err(AppError::from)?;

        return patients.map(|patient| patient.map_err(AppError::from)).collect();
    }

    let like_query = format!("%{}%", cleaned_query);

    let mut stmt = conn
        .prepare(
            "SELECT
                id,
                IFNULL(patient_code, ''),
                name,
                age_value,
                age_unit,
                gender,
                phone,
                referred_by,
                IFNULL(created_at, '')
             FROM patients
             WHERE name LIKE ?1
                OR patient_code LIKE ?1
                OR IFNULL(phone, '') LIKE ?1
                OR IFNULL(referred_by, '') LIKE ?1
             ORDER BY id DESC
             LIMIT 100",
        )
        .map_err(AppError::from)?;

    let patients = stmt
        .query_map(params![like_query], |row| {
            Ok(Patient {
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
        })
        .map_err(AppError::from)?;

    patients.map(|patient| patient.map_err(AppError::from)).collect()
}

pub fn get_doctors(conn: &Connection) -> AppResult<Vec<String>> {
    let mut stmt = conn
        .prepare(
            "SELECT name
             FROM doctors
             WHERE TRIM(name) <> '' AND IFNULL(is_active, 1) = 1
             ORDER BY name ASC",
        )
        .map_err(AppError::from)?;

    let doctors = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(AppError::from)?;

    doctors.map(|doctor| doctor.map_err(AppError::from)).collect()
}

pub fn get_all_doctors(conn: &Connection) -> AppResult<Vec<DoctorRecord>> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, IFNULL(is_active, 1), IFNULL(is_default, 0)
             FROM doctors
             WHERE TRIM(name) <> ''
             ORDER BY is_default DESC, is_active DESC, name ASC",
        )
        .map_err(AppError::from)?;

    let doctors = stmt
        .query_map([], |row| {
            let is_active_int: i32 = row.get(2)?;
            let is_default_int: i32 = row.get(3)?;
            Ok(DoctorRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                is_active: is_active_int != 0,
                is_default: is_default_int != 0,
            })
        })
        .map_err(AppError::from)?;

    doctors.map(|doctor| doctor.map_err(AppError::from)).collect()
}

pub fn get_default_doctor(conn: &Connection) -> AppResult<Option<DoctorRecord>> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, IFNULL(is_active, 1), IFNULL(is_default, 0)
             FROM doctors
             WHERE is_default = 1 AND IFNULL(is_active, 1) = 1
             LIMIT 1",
        )
        .map_err(AppError::from)?;

    let mut rows = stmt
        .query_map([], |row| {
            let is_active_int: i32 = row.get(2)?;
            let is_default_int: i32 = row.get(3)?;
            Ok(DoctorRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                is_active: is_active_int != 0,
                is_default: is_default_int != 0,
            })
        })
        .map_err(AppError::from)?;

    if let Some(row) = rows.next() {
        Ok(Some(row.map_err(AppError::from)?))
    } else {
        Ok(None)
    }
}

pub fn add_doctor(conn: &Connection, name: String) -> AppResult<i64> {
    let cleaned_name = name.trim().to_string();

    validate_doctor_name(&cleaned_name)?;

    let exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM doctors WHERE name = ?1 COLLATE NOCASE)",
            params![cleaned_name],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if exists {
        return Err(AppError::ValidationError(
            "A doctor with this name already exists".into(),
        ));
    }

    conn.execute(
        "INSERT INTO doctors (name, is_active, is_default)
         VALUES (?1, 1, 0)",
        params![cleaned_name],
    )
    .map_err(AppError::from)?;

    let id = conn.last_insert_rowid();
    log::info!("Added doctor: {} with id {}", cleaned_name, id);

    Ok(id)
}

pub fn update_doctor(conn: &Connection, id: i64, name: String) -> AppResult<()> {
    if id <= 0 {
        return Err(AppError::ValidationError("Invalid doctor id".into()));
    }
    let cleaned_name = name.trim().to_string();
    validate_doctor_name(&cleaned_name)?;

    let doctor_exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM doctors WHERE id = ?1)",
            params![id],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !doctor_exists {
        return Err(AppError::NotFound("Doctor not found".into()));
    }

    let duplicate_exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM doctors WHERE name = ?1 COLLATE NOCASE AND id <> ?2)",
            params![cleaned_name, id],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if duplicate_exists {
        return Err(AppError::ValidationError(
            "Another doctor with this name already exists".into(),
        ));
    }

    // Safeguard 1: Renaming a doctor only updates doctors.name.
    // It does NOT update historical patient records, reports, invoices, or commission snapshots.
    conn.execute(
        "UPDATE doctors SET name = ?1 WHERE id = ?2",
        params![cleaned_name, id],
    )
    .map_err(AppError::from)?;

    log::info!("Updated doctor id {} to name: {}", id, cleaned_name);
    Ok(())
}

pub fn set_default_doctor(conn: &mut Connection, id: i64) -> AppResult<()> {
    if id <= 0 {
        return Err(AppError::ValidationError("Invalid doctor id".into()));
    }

    let is_active: Option<i32> = conn
        .query_row(
            "SELECT is_active FROM doctors WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound("Doctor not found".into()),
            other => AppError::from(other),
        })?;

    if is_active.unwrap_or(0) == 0 {
        return Err(AppError::ValidationError(
            "Cannot set an inactive doctor as default. Please activate the doctor first.".into(),
        ));
    }

    let tx = conn.transaction().map_err(AppError::from)?;
    tx.execute("UPDATE doctors SET is_default = 0 WHERE is_default = 1", [])
        .map_err(AppError::from)?;
    tx.execute(
        "UPDATE doctors SET is_default = 1 WHERE id = ?1",
        params![id],
    )
    .map_err(AppError::from)?;
    tx.commit().map_err(AppError::from)?;

    log::info!("Set doctor id {} as default", id);
    Ok(())
}

pub fn set_doctor_active(conn: &mut Connection, id: i64, is_active: bool) -> AppResult<()> {
    if id <= 0 {
        return Err(AppError::ValidationError("Invalid doctor id".into()));
    }

    let exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM doctors WHERE id = ?1)",
            params![id],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound("Doctor not found".into()));
    }

    let tx = conn.transaction().map_err(AppError::from)?;
    if is_active {
        tx.execute(
            "UPDATE doctors SET is_active = 1 WHERE id = ?1",
            params![id],
        )
        .map_err(AppError::from)?;
    } else {
        // Requirement: If current default is deactivated, clear the default designation safely
        tx.execute(
            "UPDATE doctors SET is_active = 0, is_default = 0 WHERE id = ?1",
            params![id],
        )
        .map_err(AppError::from)?;
    }
    tx.commit().map_err(AppError::from)?;

    log::info!("Set doctor id {} active state to {}", id, is_active);
    Ok(())
}

pub fn update_patient(
    conn: &mut Connection,
    id: i32,
    name: String,
    age_value: Option<i32>,
    age_unit: Option<String>,
    gender: Option<String>,
    phone: Option<String>,
    referred_by: Option<String>,
) -> AppResult<()> {
    validate_positive_id(id, "patient_id")?;
    let cleaned_name = name.trim().to_string();
    validate_patient_name(&cleaned_name)?;

    if let Some(age) = age_value {
        validate_age(age)?;
    }

    let cleaned_age_unit = normalize_age_unit(age_unit)?;
    let cleaned_gender = normalize_gender(gender)?;
    let cleaned_phone = clean_optional_text(phone);
    if let Some(ref phone_val) = cleaned_phone {
        validate_phone(phone_val)?;
    }

    let cleaned_referred_by = normalize_referred_by(referred_by);
    if let Some(ref doc) = cleaned_referred_by {
        validate_doctor_name(doc)?;
    }

    let rows = conn.execute(
        "UPDATE patients SET
            name = ?1,
            age_value = ?2,
            age_unit = ?3,
            gender = ?4,
            phone = ?5,
            referred_by = ?6
         WHERE id = ?7",
        params![
            cleaned_name,
            age_value,
            cleaned_age_unit,
            cleaned_gender,
            cleaned_phone,
            cleaned_referred_by,
            id
        ],
    ).map_err(AppError::from)?;

    if rows == 0 {
        return Err(AppError::NotFound(format!("Patient {} not found", id)));
    }

    log::info!("Updated patient {}", id);
    Ok(())
}

pub fn delete_patient(conn: &mut Connection, id: i32) -> AppResult<()> {
    validate_positive_id(id, "patient_id")?;

    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate).map_err(AppError::from)?;

    let exists: bool = tx.query_row(
        "SELECT 1 FROM patients WHERE id = ?1",
        [id],
        |_| Ok(true),
    ).unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound(format!("Patient {} not found", id)));
    }

    let has_orders: bool = tx.query_row(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='orders'",
        [],
        |_| Ok(true),
    ).unwrap_or(false);

    if has_orders {
        let _ = tx.execute(
            "DELETE FROM results WHERE order_id IN (SELECT id FROM orders WHERE patient_id = ?1)",
            [id],
        );
        let _ = tx.execute(
            "DELETE FROM order_parameters WHERE order_id IN (SELECT id FROM orders WHERE patient_id = ?1)",
            [id],
        );
        let _ = tx.execute(
            "DELETE FROM order_tests WHERE order_id IN (SELECT id FROM orders WHERE patient_id = ?1)",
            [id],
        );
        let _ = tx.execute(
            "DELETE FROM payment_history WHERE order_id IN (SELECT id FROM orders WHERE patient_id = ?1)",
            [id],
        );
        let _ = tx.execute(
            "DELETE FROM doctor_commissions WHERE order_id IN (SELECT id FROM orders WHERE patient_id = ?1)",
            [id],
        );
        let _ = tx.execute(
            "DELETE FROM orders WHERE patient_id = ?1",
            [id],
        );
    }

    tx.execute(
        "DELETE FROM patients WHERE id = ?1",
        [id],
    ).map_err(AppError::from)?;

    tx.commit().map_err(AppError::from)?;
    log::info!("Deleted patient {} and associated records", id);
    Ok(())
}
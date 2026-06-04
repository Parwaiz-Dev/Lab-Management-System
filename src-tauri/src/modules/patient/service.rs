use crate::errors::{AppError, AppResult};
use crate::utils::validation::{
    validate_age, validate_doctor_name, validate_patient_name, validate_phone,
};
use chrono::Datelike;
use rusqlite::{params, Connection, Transaction};

use super::model::Patient;

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

    if cleaned_query.len() < 2 {
        return Ok(Vec::new());
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
             LIMIT 10",
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
             WHERE TRIM(name) <> ''
             ORDER BY name ASC",
        )
        .map_err(AppError::from)?;

    let doctors = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(AppError::from)?;

    doctors.map(|doctor| doctor.map_err(AppError::from)).collect()
}

pub fn add_doctor(conn: &Connection, name: String) -> AppResult<()> {
    let cleaned_name = name.trim().to_string();

    validate_doctor_name(&cleaned_name)?;


    conn.execute(
        "INSERT OR IGNORE INTO doctors (name)
         VALUES (?1)",
        params![cleaned_name],
    )
    .map_err(AppError::from)?;

    log::info!("Added doctor: {}", cleaned_name);

    Ok(())
}
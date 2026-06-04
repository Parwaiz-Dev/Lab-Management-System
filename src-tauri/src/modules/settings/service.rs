use crate::errors::{AppError, AppResult};
use crate::modules::settings::model::AppSettings;
use rusqlite::{params, Connection, OptionalExtension, Transaction};

const KEY_LAB_NAME: &str = "lab_name";
const KEY_LAB_ADDRESS: &str = "lab_address";
const KEY_DOCTOR_SHARE: &str = "doctor_share";
const KEY_LAB_LOGO: &str = "lab_logo";

fn clean_key(key: &str) -> AppResult<String> {
    let cleaned = key.trim().to_string();

    if cleaned.is_empty() {
        return Err(AppError::ValidationError(
            "Setting key cannot be empty".to_string(),
        ));
    }

    if cleaned.len() > 80 {
        return Err(AppError::ValidationError(
            "Setting key is too long".to_string(),
        ));
    }

    Ok(cleaned)
}

fn clean_value(value: &str) -> String {
    value.trim().to_string()
}

fn validate_doctor_share(value: &str) -> AppResult<()> {
    let cleaned = value.trim();

    if cleaned.is_empty() {
        return Ok(());
    }

    let share = cleaned.parse::<f64>().map_err(|_| {
        AppError::ValidationError("Doctor share must be a valid number".to_string())
    })?;

    if !(0.0..=1.0).contains(&share) {
        return Err(AppError::ValidationError(
            "Doctor share must be between 0 and 1. Example: 0.4".to_string(),
        ));
    }

    Ok(())
}

fn get_setting_or_default(conn: &Connection, key: &str, default_value: &str) -> AppResult<String> {
    let value: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [key],
            |row| row.get(0),
        )
        .optional()
        .map_err(AppError::from)?;

    Ok(value.unwrap_or_else(|| default_value.to_string()))
}

fn upsert_setting_tx(tx: &Transaction<'_>, key: &str, value: &str) -> AppResult<()> {
    tx.execute(
        "INSERT INTO settings (key, value)
         VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(AppError::from)?;

    Ok(())
}

pub fn get_setting(conn: &Connection, key: String) -> AppResult<String> {
    let cleaned_key = clean_key(&key)?;

    let value: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [cleaned_key],
            |row| row.get(0),
        )
        .optional()
        .map_err(AppError::from)?;

    Ok(value.unwrap_or_default())
}

pub fn set_setting(conn: &Connection, key: String, value: String) -> AppResult<()> {
    let cleaned_key = clean_key(&key)?;
    let cleaned_value = clean_value(&value);

    if cleaned_key == KEY_DOCTOR_SHARE {
        validate_doctor_share(&cleaned_value)?;
    }

    conn.execute(
        "INSERT INTO settings (key, value)
         VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![cleaned_key, cleaned_value],
    )
    .map_err(AppError::from)?;

    Ok(())
}

pub fn get_all_settings(conn: &Connection) -> AppResult<AppSettings> {
    Ok(AppSettings {
        lab_name: get_setting_or_default(conn, KEY_LAB_NAME, "Your Lab")?,
        lab_address: get_setting_or_default(conn, KEY_LAB_ADDRESS, "Your Address")?,
        doctor_share: get_setting_or_default(conn, KEY_DOCTOR_SHARE, "0.4")?,
        lab_logo: get_setting_or_default(conn, KEY_LAB_LOGO, "")?,
    })
}

pub fn save_lab_settings(
    conn: &mut Connection,
    lab_name: String,
    lab_address: String,
    doctor_share: String,
    lab_logo: String,
) -> AppResult<()> {
    let cleaned_lab_name = clean_value(&lab_name);
    let cleaned_lab_address = clean_value(&lab_address);
    let cleaned_doctor_share = clean_value(&doctor_share);
    let cleaned_lab_logo = clean_value(&lab_logo);

    if cleaned_lab_name.is_empty() {
        return Err(AppError::ValidationError(
            "Lab name cannot be empty".to_string(),
        ));
    }

    if cleaned_lab_name.len() > 150 {
        return Err(AppError::ValidationError(
            "Lab name must be less than 150 characters".to_string(),
        ));
    }

    if cleaned_lab_address.len() > 500 {
        return Err(AppError::ValidationError(
            "Lab address must be less than 500 characters".to_string(),
        ));
    }

    validate_doctor_share(&cleaned_doctor_share)?;

    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate).map_err(AppError::from)?;

    upsert_setting_tx(&tx, KEY_LAB_NAME, &cleaned_lab_name)?;
    upsert_setting_tx(&tx, KEY_LAB_ADDRESS, &cleaned_lab_address)?;
    upsert_setting_tx(&tx, KEY_DOCTOR_SHARE, &cleaned_doctor_share)?;
    upsert_setting_tx(&tx, KEY_LAB_LOGO, &cleaned_lab_logo)?;

    tx.commit().map_err(AppError::from)?;

    Ok(())
}
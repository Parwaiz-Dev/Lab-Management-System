use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use super::service;
use crate::errors::AppError;
use crate::modules::audit::service::create_audit_log;
use crate::modules::auth::commands::{require_auth, AuthState};
use crate::modules::patient::model::Patient;

#[tauri::command]
pub fn create_patient(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    name: String,
    age_value: Option<i32>,
    age_unit: Option<String>,
    gender: Option<String>,
    phone: Option<String>,
    referred_by: Option<String>,
) -> Result<i32, AppError> {
    let session = require_auth(&auth)?;
    let mut conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    let patient_id = service::create_patient(
        &mut *conn,
        name.clone(),
        age_value,
        age_unit,
        gender,
        phone,
        referred_by,
    )?;

    // Audit: patient created
    let new_data = serde_json::json!({ "name": &name });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "create",
        "patients",
        Some(patient_id as i64),
        None,
        Some(&new_data.to_string()),
    );

    Ok(patient_id)
}

#[tauri::command]
pub fn search_patients(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    query: String,
) -> Result<Vec<Patient>, AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::search_patients(&conn, query)?)
}

#[tauri::command]
pub fn get_doctors(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
) -> Result<Vec<String>, AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_doctors(&conn)?)
}

#[tauri::command]
pub fn add_doctor(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    name: String,
) -> Result<String, AppError> {
    let session = require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    service::add_doctor(&conn, name.clone())?;

    // Audit: doctor added
    let new_data = serde_json::json!({ "name": &name });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "create",
        "doctors",
        None,
        None,
        Some(&new_data.to_string()),
    );

    Ok("Doctor added".into())
}
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use super::service;
use crate::errors::AppError;
use crate::modules::audit::service::create_audit_log;
use crate::modules::auth::commands::{require_auth, AuthState};
use crate::modules::patient::model::{DoctorRecord, Patient};

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
pub fn get_all_doctors(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
) -> Result<Vec<DoctorRecord>, AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_all_doctors(&conn)?)
}

#[tauri::command]
pub fn get_default_doctor(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
) -> Result<Option<DoctorRecord>, AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_default_doctor(&conn)?)
}

#[tauri::command]
pub fn add_doctor(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    name: String,
) -> Result<String, AppError> {
    let session = require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    let id = service::add_doctor(&conn, name.clone())?;

    // Audit: doctor added
    let new_data = serde_json::json!({ "id": id, "name": &name });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "create",
        "doctors",
        Some(id),
        None,
        Some(&new_data.to_string()),
    );

    Ok("Doctor added".into())
}

#[tauri::command]
pub fn update_doctor(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    id: i64,
    name: String,
) -> Result<String, AppError> {
    let session = require_auth(&auth)?;
    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError("Only administrators can edit doctors".into()));
    }
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    service::update_doctor(&conn, id, name.clone())?;

    // Audit: doctor updated (Safeguard 1: only doctor record is renamed, historical records unchanged)
    let new_data = serde_json::json!({ "id": id, "name": &name });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "update",
        "doctors",
        Some(id),
        None,
        Some(&new_data.to_string()),
    );

    Ok("Doctor updated".into())
}

#[tauri::command]
pub fn set_default_doctor(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    id: i64,
) -> Result<String, AppError> {
    let session = require_auth(&auth)?;
    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError("Only administrators can set default doctor".into()));
    }
    let mut conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    service::set_default_doctor(&mut *conn, id)?;

    // Audit: default doctor changed
    let new_data = serde_json::json!({ "default_doctor_id": id });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "set_default",
        "doctors",
        Some(id),
        None,
        Some(&new_data.to_string()),
    );

    Ok("Default doctor updated".into())
}

#[tauri::command]
pub fn set_doctor_active(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    id: i64,
    is_active: bool,
) -> Result<String, AppError> {
    let session = require_auth(&auth)?;
    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError("Only administrators can activate/deactivate doctors".into()));
    }
    let mut conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    service::set_doctor_active(&mut *conn, id, is_active)?;

    let action = if is_active { "reactivate" } else { "deactivate" };
    let new_data = serde_json::json!({ "id": id, "is_active": is_active });
    create_audit_log(
        &conn,
        session.user_id as i64,
        action,
        "doctors",
        Some(id),
        None,
        Some(&new_data.to_string()),
    );

    Ok(format!("Doctor {}", action).into())
}

#[tauri::command]
pub fn update_patient(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    id: i32,
    name: String,
    age_value: Option<i32>,
    age_unit: Option<String>,
    gender: Option<String>,
    phone: Option<String>,
    referred_by: Option<String>,
) -> Result<(), AppError> {
    let session = require_auth(&auth)?;
    let mut conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    service::update_patient(
        &mut *conn,
        id,
        name.clone(),
        age_value,
        age_unit,
        gender,
        phone,
        referred_by,
    )?;

    // Audit: patient updated
    let new_data = serde_json::json!({ "name": &name, "id": id });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "update",
        "patients",
        Some(id as i64),
        None,
        Some(&new_data.to_string()),
    );

    Ok(())
}

#[tauri::command]
pub fn delete_patient(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    id: i32,
) -> Result<(), AppError> {
    let session = require_auth(&auth)?;
    let mut conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    service::delete_patient(&mut *conn, id)?;

    // Audit: patient deleted
    let new_data = serde_json::json!({ "deleted_id": id });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "delete",
        "patients",
        Some(id as i64),
        None,
        Some(&new_data.to_string()),
    );

    Ok(())
}
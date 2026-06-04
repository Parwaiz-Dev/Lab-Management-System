use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use super::service;
use crate::errors::AppError;
use crate::modules::audit::service::create_audit_log;
use crate::modules::auth::commands::{require_auth, AuthState};
use crate::modules::settings::model::AppSettings;

#[tauri::command]
pub fn get_setting(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    key: String,
) -> Result<String, AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_setting(&conn, key)?)
}

#[tauri::command]
pub fn set_setting(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    key: String,
    value: String,
) -> Result<String, AppError> {
    let session = require_auth(&auth)?;
    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError("Only admins can modify settings".to_string()));
    }

    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;

    // Snapshot existing setting value by its TEXT key
    let old_data = crate::modules::audit::service::snapshot_setting(
        &conn,
        &key,
    )
    .unwrap_or(None);

    service::set_setting(&conn, key.clone(), value.clone())?;

    // Audit: setting changed
    let new_data = serde_json::json!({ "key": &key, "value": &value });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "update",
        "settings",
        None,
        old_data.as_deref(),
        Some(&new_data.to_string()),
    );

    Ok("Saved".into())
}

#[tauri::command]
pub fn get_all_settings(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
) -> Result<AppSettings, AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_all_settings(&conn)?)
}

#[tauri::command]
pub fn save_lab_settings(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    lab_name: String,
    lab_address: String,
    doctor_share: String,
    lab_logo: String,
) -> Result<String, AppError> {
    let session = require_auth(&auth)?;
    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError("Only admins can save settings".to_string()));
    }
    let mut conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    service::save_lab_settings(&mut *conn, lab_name.clone(), lab_address.clone(), doctor_share.clone(), lab_logo.clone())?;

    // Audit: lab settings saved
    let new_data = serde_json::json!({
        "lab_name": &lab_name,
        "lab_address": &lab_address,
        "doctor_share": &doctor_share
    });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "update",
        "settings",
        None,
        None,
        Some(&new_data.to_string()),
    );

    Ok("Settings saved".into())
}
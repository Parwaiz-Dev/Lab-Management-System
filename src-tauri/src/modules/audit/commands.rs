use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use crate::errors::{AppError, AppResult};
use crate::modules::auth::commands::{require_auth, AuthState};

use super::model::AuditLogEntry;
use super::service;

// ---------------------------------------------------------------------------
// Admin-only audit query commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_audit_logs(
    db: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    table_name: Option<String>,
    record_id: Option<i64>,
    user_id: Option<i64>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> AppResult<Vec<AuditLogEntry>> {
    let session = require_auth(&auth)?;
    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError(
            "Only admins can view audit logs".to_string(),
        ));
    }

    let conn = db.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    service::get_audit_logs(
        &conn,
        table_name.as_deref(),
        record_id,
        user_id,
        limit,
        offset,
    )
}

#[tauri::command]
pub fn get_record_history(
    db: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    table_name: String,
    record_id: i64,
) -> AppResult<Vec<AuditLogEntry>> {
    let session = require_auth(&auth)?;
    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError(
            "Only admins can view audit logs".to_string(),
        ));
    }

    let conn = db.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    service::get_record_history(&conn, &table_name, record_id)
}

#[tauri::command]
pub fn get_user_activity(
    db: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    user_id: i64,
) -> AppResult<Vec<AuditLogEntry>> {
    let session = require_auth(&auth)?;
    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError(
            "Only admins can view audit logs".to_string(),
        ));
    }

    let conn = db.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    service::get_user_activity(&conn, user_id, None)
}
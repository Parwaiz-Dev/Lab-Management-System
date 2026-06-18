use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use super::service;
use crate::errors::AppError;
use crate::modules::audit::service::create_audit_log;
use crate::modules::auth::commands::{require_auth, AuthState};
use crate::modules::result::model::{OrderParameterDto, ResultInput};

#[tauri::command]
pub fn save_result(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    order_id: i32,
    parameter_id: i32,
    value: String,
) -> Result<String, AppError> {
    let session = require_auth(&auth)?;
    let mut conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;

    // Snapshot existing result before mutation, identified by (order_id, parameter_id)
    let old_data = crate::modules::audit::service::snapshot_result(
        &conn,
        order_id as i64,
        parameter_id as i64,
    )
    .unwrap_or(None);

    service::save_result(&mut *conn, order_id, parameter_id, value.clone())?;

    // Audit: result saved
    let new_data = serde_json::json!({
        "order_id": order_id,
        "parameter_id": parameter_id,
        "value": &value
    });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "save_result",
        "results",
        Some(order_id as i64),
        old_data.as_deref(),
        Some(&new_data.to_string()),
    );

    Ok("Saved".into())
}

#[tauri::command]
pub fn save_results(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    order_id: i32,
    results: Vec<ResultInput>,
) -> Result<String, AppError> {
    let session = require_auth(&auth)?;
    let mut conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    let count = service::save_results(&mut *conn, order_id, results)?;

    // Audit: batch results saved
    let new_data = serde_json::json!({
        "order_id": order_id,
        "results_count": count
    });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "save_results",
        "results",
        Some(order_id as i64),
        None,
        Some(&new_data.to_string()),
    );

    Ok(format!("{} results saved", count))
}

#[tauri::command]
pub fn get_parameters_by_order(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    order_id: i32,
) -> Result<Vec<OrderParameterDto>, AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_parameters_by_order(&conn, order_id)?)
}

#[tauri::command]
pub fn get_results_by_order(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    order_id: i32,
) -> Result<Vec<(i32, String)>, AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_results_by_order(&conn, order_id)?)
}
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use super::model::PaymentHistoryEntry;
use super::service;
use crate::errors::AppError;
use crate::modules::audit::service::create_audit_log;
use crate::modules::auth::commands::{require_auth, AuthState};

#[tauri::command]
pub fn update_payment(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    order_id: i32,
    paid_amount: f64,
) -> Result<String, AppError> {
    let session = require_auth(&auth)?;
    let mut conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;

    // Snapshot existing payment before mutation
    let old_data = crate::modules::audit::service::snapshot_row(
        &conn,
        "orders",
        "id",
        order_id as i64,
        &["paid_amount", "paid_amount_paise"],
    )
    .unwrap_or(None);

    service::update_payment(&mut *conn, order_id, paid_amount)?;

    // Audit: payment updated
    let new_data = serde_json::json!({ "paid_amount": paid_amount });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "update",
        "orders",
        Some(order_id as i64),
        old_data.as_deref(),
        Some(&new_data.to_string()),
    );

    Ok("Payment updated".into())
}

#[tauri::command]
pub fn get_daily_summary(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
) -> Result<(f64, f64, f64), AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_daily_summary(&conn)?)
}

#[tauri::command]
pub fn get_overall_summary(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
) -> Result<(f64, f64, f64), AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_overall_summary(&conn)?)
}

#[tauri::command]
pub fn get_payment_history(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    order_id: i32,
) -> Result<Vec<PaymentHistoryEntry>, AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_payment_history(&conn, order_id)?)
}

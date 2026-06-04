use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use super::service;
use crate::errors::AppError;
use crate::modules::audit::service::create_audit_log;
use crate::modules::auth::commands::{require_auth, AuthState};
use crate::modules::order::model::OrderSummary;

#[tauri::command]
pub fn create_order(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    patient_id: i32,
    test_ids: Vec<i32>,
    parameter_ids: Vec<i32>,
    total_amount: f64,
    discount_amount: f64,
) -> Result<i32, AppError> {
    let session = require_auth(&auth)?;
    let mut conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    let order_id = service::create_order(&mut *conn, patient_id, test_ids, parameter_ids, total_amount, discount_amount)?;

    // Audit: order created
    let new_data = serde_json::json!({
        "patient_id": patient_id,
        "total_amount": total_amount,
        "discount_amount": discount_amount
    });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "create",
        "orders",
        Some(order_id as i64),
        None,
        Some(&new_data.to_string()),
    );

    Ok(order_id)
}

#[tauri::command]
pub fn get_orders(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
) -> Result<Vec<OrderSummary>, AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_orders(&conn)?)
}

#[tauri::command]
pub fn get_order_status(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    order_id: i32,
) -> Result<String, AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_order_status(&conn, order_id)?)
}
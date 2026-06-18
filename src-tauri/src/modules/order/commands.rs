use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use super::service;
use crate::errors::AppError;
use crate::modules::audit::service::create_audit_log;
use crate::modules::auth::commands::{require_auth, AuthState};
use crate::modules::order::model::{DoctorRevenue, OrderSummary, UpdateOrderPayload};

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

#[tauri::command]
pub fn get_orders_by_date_range(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    date_from: String,
    date_to: String,
) -> Result<Vec<OrderSummary>, AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_orders_by_date_range(&conn, &date_from, &date_to)?)
}

#[tauri::command]
pub fn get_doctor_revenue(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    date_from: String,
    date_to: String,
) -> Result<Vec<DoctorRevenue>, AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_doctor_revenue(&conn, &date_from, &date_to)?)
}

#[tauri::command]
pub fn cancel_order(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    order_id: i32,
) -> Result<(), AppError> {
    let session = require_auth(&auth)?;
    let mut conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    service::cancel_order(&mut *conn, order_id)?;

    let new_data = serde_json::json!({ "status": "Cancelled" });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "cancel",
        "orders",
        Some(order_id as i64),
        None,
        Some(&new_data.to_string()),
    );

    Ok(())
}

#[tauri::command]
pub fn update_order(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    order_id: i32,
    payload: UpdateOrderPayload,
) -> Result<(), AppError> {
    let session = require_auth(&auth)?;
    let mut conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;

    let test_ids_for_audit = payload.test_ids.clone();
    let total_amount_for_audit = payload.total_amount;

    service::update_order(
        &mut *conn,
        order_id,
        payload.test_ids,
        payload.parameter_ids,
        total_amount_for_audit,
        payload.discount_amount,
    )?;

    let new_data = serde_json::json!({
        "test_ids": test_ids_for_audit,
        "total_amount": total_amount_for_audit
    });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "update",
        "orders",
        Some(order_id as i64),
        None,
        Some(&new_data.to_string()),
    );

    Ok(())
}

#[tauri::command]
pub fn update_order_status(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    order_id: i32,
    new_status: String,
) -> Result<(), AppError> {
    let session = require_auth(&auth)?;
    let mut conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    service::update_order_status(&mut *conn, order_id, &new_status)?;

    let new_data = serde_json::json!({ "status": new_status });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "update_status",
        "orders",
        Some(order_id as i64),
        None,
        Some(&new_data.to_string()),
    );

    Ok(())
}
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use super::service;
use crate::errors::AppError;
use crate::modules::audit::service::create_audit_log;
use crate::modules::auth::commands::{require_auth, AuthState};
use crate::modules::order::model::{
    AddTestsPayload, CreateOrderResult, DoctorRevenue, OrderSummary, UpdateOrderPayload,
};

#[tauri::command]
pub fn create_order(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    patient_id: i32,
    test_ids: Vec<i32>,
    parameter_ids: Vec<i32>,
    total_amount: f64,
    discount_amount: f64,
    custom_prices: Option<std::collections::HashMap<i32, f64>>,
    manual_order_number: Option<String>,
) -> Result<CreateOrderResult, AppError> {
    let session = require_auth(&auth)?;
    let mut conn = state
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;
    let is_manual = manual_order_number
        .as_deref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);

    let result = service::create_order_with_prices(
        &mut *conn,
        patient_id,
        test_ids,
        parameter_ids,
        total_amount,
        discount_amount,
        custom_prices,
        manual_order_number,
    )?;

    // Audit: order created
    let new_data = serde_json::json!({
        "patient_id": patient_id,
        "total_amount": total_amount,
        "discount_amount": discount_amount,
        "order_number": &result.order_number,
        "manual_override": is_manual,
    });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "create",
        "orders",
        Some(result.order_id as i64),
        None,
        Some(&new_data.to_string()),
    );

    Ok(result)
}

#[tauri::command]
pub fn get_next_lab_reference_number(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    date: Option<String>,
) -> Result<String, AppError> {
    require_auth(&auth)?;
    let conn = state
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;
    let order_date = match date.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        Some(d) => d.to_string(),
        None => service::current_ist_date(),
    };
    service::peek_next_daily_order_number(&conn, &order_date)
}

#[tauri::command]
pub fn check_lab_reference_number(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    reference_number: String,
    date: Option<String>,
) -> Result<bool, AppError> {
    require_auth(&auth)?;
    let conn = state
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;
    let order_date = match date.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        Some(d) => d.to_string(),
        None => service::current_ist_date(),
    };
    service::check_order_number_available(&conn, &reference_number, &order_date)
}

#[tauri::command]
pub fn get_orders(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
) -> Result<Vec<OrderSummary>, AppError> {
    require_auth(&auth)?;
    let conn = state
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_orders(&conn)?)
}

#[tauri::command]
pub fn get_order_status(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    order_id: i32,
) -> Result<String, AppError> {
    require_auth(&auth)?;
    let conn = state
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;
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
    let conn = state
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_orders_by_date_range(
        &conn, &date_from, &date_to,
    )?)
}

#[tauri::command]
pub fn get_doctor_revenue(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    date_from: String,
    date_to: String,
) -> Result<Vec<DoctorRevenue>, AppError> {
    let session = require_auth(&auth)?;
    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError(
            "Only admins can access doctor revenue data".to_string(),
        ));
    }
    let conn = state
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_doctor_revenue(&conn, &date_from, &date_to)?)
}

#[tauri::command]
pub fn cancel_order(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    order_id: i32,
) -> Result<(), AppError> {
    let session = require_auth(&auth)?;
    let mut conn = state
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;
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
    let mut conn = state
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    let test_ids_for_audit = payload.test_ids.clone();
    let total_amount_for_audit = payload.total_amount;

    service::update_order_with_prices(
        &mut *conn,
        order_id,
        payload.test_ids,
        payload.parameter_ids,
        total_amount_for_audit,
        payload.discount_amount,
        payload.custom_prices,
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
pub fn add_tests_to_order(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    order_id: i32,
    payload: AddTestsPayload,
) -> Result<(), AppError> {
    let session = require_auth(&auth)?;
    let mut conn = state
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    let test_ids_for_audit = payload.test_ids.clone();

    // Snapshot existing order state before mutation
    let old_data = crate::modules::audit::service::snapshot_row(
        &conn,
        "orders",
        "id",
        order_id as i64,
        &["total_amount_paise", "paid_amount_paise"],
    )
    .unwrap_or(None);

    service::add_tests_to_order(
        &mut *conn,
        order_id,
        payload.test_ids,
        payload.custom_prices,
    )?;

    let new_data = serde_json::json!({
        "added_test_ids": test_ids_for_audit,
    });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "add_tests",
        "orders",
        Some(order_id as i64),
        old_data.as_deref(),
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
    let mut conn = state
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;
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

#[tauri::command]
pub fn update_order_reference_number(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    order_id: i32,
    new_reference_number: String,
) -> Result<String, AppError> {
    let session = require_auth(&auth)?;
    let mut conn = state
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    let (old_ref, new_ref) =
        service::update_order_reference_number(&mut *conn, order_id, &new_reference_number)?;

    if old_ref != new_ref {
        let old_data = serde_json::json!({ "order_number": old_ref }).to_string();
        let new_data = serde_json::json!({ "order_number": new_ref }).to_string();
        create_audit_log(
            &conn,
            session.user_id as i64,
            "update_reference",
            "orders",
            Some(order_id as i64),
            Some(&old_data),
            Some(&new_data),
        );
    }

    Ok(new_ref)
}

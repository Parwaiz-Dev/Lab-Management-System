use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use super::service;
use crate::errors::AppError;
use crate::modules::audit::service::create_audit_log;
use crate::modules::auth::commands::{require_auth, AuthState};
use crate::modules::catalog::model::{TestCatalogItem, TestParameterDto};

#[tauri::command]
pub fn get_tests(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
) -> Result<Vec<TestCatalogItem>, AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_tests(&conn)?)
}

#[tauri::command]
pub fn get_test_parameters(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    test_id: i32,
) -> Result<Vec<TestParameterDto>, AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_test_parameters(&conn, test_id)?)
}

#[tauri::command]
pub fn add_test(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    name: String,
    price: f64,
) -> Result<i32, AppError> {
    let session = require_auth(&auth)?;
    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError("Only admins can manage the test catalog".to_string()));
    }
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    let test_id = service::add_test(&conn, name.clone(), price)?;

    // Audit: test created
    let new_data = serde_json::json!({ "name": &name, "price": price });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "create",
        "tests",
        Some(test_id as i64),
        None,
        Some(&new_data.to_string()),
    );

    Ok(test_id)
}

#[tauri::command]
pub fn update_test(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    test_id: i32,
    name: String,
    price: f64,
) -> Result<String, AppError> {
    let session = require_auth(&auth)?;
    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError("Only admins can manage the test catalog".to_string()));
    }
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;

    // Snapshot test before mutation
    let old_data = crate::modules::audit::service::snapshot_row(
        &conn,
        "tests",
        "id",
        test_id as i64,
        &["name", "price"],
    )
    .unwrap_or(None);

    service::update_test(&conn, test_id, name.clone(), price)?;

    // Audit: test updated
    let new_data = serde_json::json!({ "name": &name, "price": price });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "update",
        "tests",
        Some(test_id as i64),
        old_data.as_deref(),
        Some(&new_data.to_string()),
    );

    Ok("Test updated".into())
}

#[tauri::command]
pub fn delete_test(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    test_id: i32,
) -> Result<String, AppError> {
    let session = require_auth(&auth)?;
    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError("Only admins can manage the test catalog".to_string()));
    }

    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;

    // Snapshot test before deletion
    let old_data = crate::modules::audit::service::snapshot_row(
        &conn,
        "tests",
        "id",
        test_id as i64,
        &["name", "price"],
    )
    .unwrap_or(None);

    service::delete_test(&conn, test_id)?;

    // Audit: test deleted
    create_audit_log(
        &conn,
        session.user_id as i64,
        "delete",
        "tests",
        Some(test_id as i64),
        old_data.as_deref(),
        None,
    );

    Ok("Test deleted".into())
}

#[tauri::command]
pub fn add_test_parameter(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    test_id: i32,
    name: String,
    unit: String,
    normal_range: String,
) -> Result<i32, AppError> {
    let session = require_auth(&auth)?;
    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError("Only admins can manage the test catalog".to_string()));
    }
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    let param_id = service::add_test_parameter(&conn, test_id, name.clone(), unit.clone(), normal_range.clone())?;

    // Audit: parameter created
    let new_data = serde_json::json!({
        "test_id": test_id,
        "name": &name,
        "unit": &unit,
        "normal_range": &normal_range
    });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "create",
        "test_parameters",
        Some(param_id as i64),
        None,
        Some(&new_data.to_string()),
    );

    Ok(param_id)
}

#[tauri::command]
pub fn update_test_parameter(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    parameter_id: i32,
    name: String,
    unit: String,
    normal_range: String,
) -> Result<String, AppError> {
    let session = require_auth(&auth)?;
    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError("Only admins can manage the test catalog".to_string()));
    }

    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;

    // Snapshot parameter before mutation
    let old_data = crate::modules::audit::service::snapshot_row(
        &conn,
        "test_parameters",
        "id",
        parameter_id as i64,
        &["name", "unit", "normal_range"],
    )
    .unwrap_or(None);

    service::update_test_parameter(&conn, parameter_id, name.clone(), unit.clone(), normal_range.clone())?;

    // Audit: parameter updated
    let new_data = serde_json::json!({
        "name": &name,
        "unit": &unit,
        "normal_range": &normal_range
    });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "update",
        "test_parameters",
        Some(parameter_id as i64),
        old_data.as_deref(),
        Some(&new_data.to_string()),
    );

    Ok("Parameter updated".into())
}

#[tauri::command]
pub fn delete_test_parameter(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    parameter_id: i32,
) -> Result<String, AppError> {
    let session = require_auth(&auth)?;
    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError("Only admins can manage the test catalog".to_string()));
    }

    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;

    // Snapshot parameter before deletion
    let old_data = crate::modules::audit::service::snapshot_row(
        &conn,
        "test_parameters",
        "id",
        parameter_id as i64,
        &["name", "unit", "normal_range"],
    )
    .unwrap_or(None);

    service::delete_test_parameter(&conn, parameter_id)?;

    // Audit: parameter deleted
    create_audit_log(
        &conn,
        session.user_id as i64,
        "delete",
        "test_parameters",
        Some(parameter_id as i64),
        old_data.as_deref(),
        None,
    );

    Ok("Parameter deleted".into())
}

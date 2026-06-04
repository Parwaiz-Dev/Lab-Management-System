use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use super::service;
use crate::errors::AppError;
use crate::modules::auth::commands::{require_auth, AuthState};
use crate::modules::report::model::{ReportPatientInfo, ReportRow};

#[tauri::command]
pub fn get_report(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    order_id: i32,
) -> Result<Vec<ReportRow>, AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_report(&conn, order_id)?)
}

#[tauri::command]
pub fn get_patient_by_order(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    order_id: i32,
) -> Result<ReportPatientInfo, AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_patient_by_order(&conn, order_id)?)
}
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use crate::errors::{AppError, AppResult};
use crate::modules::auth::commands::{require_auth, AuthState};

use super::model::PatientHistoryResponse;
use super::service;

#[tauri::command]
pub fn get_patient_history(
    db: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    patient_id: i32,
) -> AppResult<PatientHistoryResponse> {
    let _session = require_auth(&auth)?;

    let conn = db.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    service::get_patient_history(&conn, patient_id)
}
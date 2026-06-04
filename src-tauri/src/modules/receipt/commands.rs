use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use super::service;
use crate::errors::AppError;
use crate::modules::auth::commands::{require_auth, AuthState};
use crate::modules::receipt::model::ReceiptData;

#[tauri::command]
pub fn get_receipt(
    state: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
    order_id: i32,
) -> Result<ReceiptData, AppError> {
    require_auth(&auth)?;
    let conn = state.lock().map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(service::get_receipt(&conn, order_id)?)
}
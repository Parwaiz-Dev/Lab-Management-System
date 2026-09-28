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

#[tauri::command]
pub fn save_export_file(
    filename: String,
    content: Vec<u8>,
    target_path: Option<String>,
) -> Result<String, String> {
    use std::fs;
    use std::path::PathBuf;

    let file_path = if let Some(path_str) = target_path {
        PathBuf::from(path_str)
    } else {
        let dir = dirs::download_dir()
            .or_else(|| dirs::document_dir())
            .or_else(|| dirs::desktop_dir())
            .unwrap_or_else(|| PathBuf::from("."));
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create download folder: {}", e))?;
        dir.join(&filename)
    };

    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create folder: {}", e))?;
    }

    fs::write(&file_path, content).map_err(|e| format!("Failed to write file to {}: {}", file_path.display(), e))?;

    Ok(file_path.to_string_lossy().to_string())
}
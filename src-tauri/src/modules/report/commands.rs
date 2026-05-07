use super::service;
use crate::modules::report::model::{ReportPatientInfo, ReportRow};

#[tauri::command]
pub fn get_report(order_id: i32) -> Result<Vec<ReportRow>, String> {
    service::get_report(order_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_patient_by_order(order_id: i32) -> Result<ReportPatientInfo, String> {
    service::get_patient_by_order(order_id).map_err(|e| e.to_string())
}
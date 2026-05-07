use super::service;
use crate::modules::patient::model::Patient;

#[tauri::command]
pub fn create_patient(
    name: String,
    age_value: Option<i32>,
    age_unit: Option<String>,
    gender: Option<String>,
    phone: Option<String>,
    referred_by: Option<String>,
) -> Result<i32, String> {
    service::create_patient(
        name,
        age_value,
        age_unit,
        gender,
        phone,
        referred_by,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_patients(query: String) -> Result<Vec<Patient>, String> {
    service::search_patients(query).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_doctors() -> Result<Vec<String>, String> {
    service::get_doctors().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_doctor(name: String) -> Result<String, String> {
    service::add_doctor(name)
        .map(|_| "Doctor added".into())
        .map_err(|e| e.to_string())
}
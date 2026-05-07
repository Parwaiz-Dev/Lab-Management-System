use super::service;
use crate::modules::settings::model::AppSettings;

#[tauri::command]
pub fn get_setting(key: String) -> Result<String, String> {
    service::get_setting(key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(key: String, value: String) -> Result<String, String> {
    service::set_setting(key, value)
        .map(|_| "Saved".into())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_settings() -> Result<AppSettings, String> {
    service::get_all_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_lab_settings(
    lab_name: String,
    lab_address: String,
    doctor_share: String,
    lab_logo: String,
) -> Result<String, String> {
    service::save_lab_settings(lab_name, lab_address, doctor_share, lab_logo)
        .map(|_| "Settings saved".into())
        .map_err(|e| e.to_string())
}
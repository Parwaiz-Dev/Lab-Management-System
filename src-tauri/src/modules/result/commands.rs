use super::service;
use crate::modules::result::model::{OrderParameterDto, ResultInput};

#[tauri::command]
pub fn save_result(order_id: i32, parameter_id: i32, value: String) -> Result<String, String> {
    service::save_result(order_id, parameter_id, value)
        .map(|_| "Saved".into())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_results(order_id: i32, results: Vec<ResultInput>) -> Result<String, String> {
    service::save_results(order_id, results)
        .map(|count| format!("{} results saved", count))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_parameters_by_order(order_id: i32) -> Result<Vec<OrderParameterDto>, String> {
    service::get_parameters_by_order(order_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_results_by_order(order_id: i32) -> Result<Vec<(i32, String)>, String> {
    service::get_results_by_order(order_id).map_err(|e| e.to_string())
}
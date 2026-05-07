use super::service;
use crate::modules::catalog::model::{TestCatalogItem, TestParameterDto};

#[tauri::command]
pub fn get_tests() -> Result<Vec<TestCatalogItem>, String> {
    service::get_tests().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_test_parameters(test_id: i32) -> Result<Vec<TestParameterDto>, String> {
    service::get_test_parameters(test_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_test(name: String, price: f64) -> Result<i32, String> {
    service::add_test(name, price).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_test(test_id: i32, name: String, price: f64) -> Result<String, String> {
    service::update_test(test_id, name, price)
        .map(|_| "Test updated".into())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_test(test_id: i32) -> Result<String, String> {
    service::delete_test(test_id)
        .map(|_| "Test deleted".into())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_test_parameter(
    test_id: i32,
    name: String,
    unit: String,
    normal_range: String,
) -> Result<i32, String> {
    service::add_test_parameter(test_id, name, unit, normal_range)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_test_parameter(
    parameter_id: i32,
    name: String,
    unit: String,
    normal_range: String,
) -> Result<String, String> {
    service::update_test_parameter(parameter_id, name, unit, normal_range)
        .map(|_| "Parameter updated".into())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_test_parameter(parameter_id: i32) -> Result<String, String> {
    service::delete_test_parameter(parameter_id)
        .map(|_| "Parameter deleted".into())
        .map_err(|e| e.to_string())
}

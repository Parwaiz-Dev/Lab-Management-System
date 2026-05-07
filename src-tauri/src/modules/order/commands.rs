use super::service;
use crate::modules::order::model::OrderSummary;

#[tauri::command]
pub fn create_order(
    patient_id: i32,
    test_ids: Vec<i32>,
    parameter_ids: Vec<i32>,
    total_amount: f64,
    discount_amount: f64,
) -> Result<i32, String> {
    service::create_order(patient_id, test_ids, parameter_ids, total_amount, discount_amount)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_orders() -> Result<Vec<OrderSummary>, String> {
    service::get_orders().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_order_status(order_id: i32) -> Result<String, String> {
    service::get_order_status(order_id).map_err(|e| e.to_string())
}
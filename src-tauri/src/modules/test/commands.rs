use super::service;
use crate::errors::AppError;

// 🧪 Get Tests
#[tauri::command]
pub fn get_tests() -> Result<Vec<service::TestCatalogItem>, String> {
    service::get_tests().map_err(|e: AppError| e.to_string())
}

// 💾 Create Order
#[tauri::command]
pub fn create_order(
    patient_id: i32,
    test_ids: Vec<i32>,
    parameter_ids: Vec<i32>,
    total_amount: f64,
    discount_amount: f64,
) -> Result<i32, String> {
    service::create_order(patient_id, test_ids, parameter_ids, total_amount, discount_amount)
        .map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub fn add_test(name: String, price: f64) -> Result<i32, String> {
    service::add_test(name, price)
        .map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub fn update_test(test_id: i32, name: String, price: f64) -> Result<String, String> {
    service::update_test(test_id, name, price)
        .map(|_| "Test updated".into())
        .map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub fn delete_test(test_id: i32) -> Result<String, String> {
    service::delete_test(test_id)
        .map(|_| "Test deleted".into())
        .map_err(|e: AppError| e.to_string())
}

// 🧬 Get Test Parameters
#[tauri::command]
pub fn get_test_parameters(
    test_id: i32,
) -> Result<Vec<service::TestParameterDto>, String> {
    service::get_test_parameters(test_id)
        .map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub fn add_test_parameter(
    test_id: i32,
    name: String,
    unit: String,
    normal_range: String,
) -> Result<i32, String> {
    service::add_test_parameter(test_id, name, unit, normal_range)
        .map_err(|e: AppError| e.to_string())
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
        .map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub fn delete_test_parameter(parameter_id: i32) -> Result<String, String> {
    service::delete_test_parameter(parameter_id)
        .map(|_| "Parameter deleted".into())
        .map_err(|e: AppError| e.to_string())
}

// 💾 Save Result
#[tauri::command]
pub fn save_result(
    order_id: i32,
    parameter_id: i32,
    value: String,
) -> Result<String, String> {
    service::save_result(order_id, parameter_id, value)
        .map(|_| "Saved".into())
        .map_err(|e: AppError| e.to_string())
}

// 📊 Orders
#[tauri::command]
pub fn get_orders() -> Result<Vec<(i32, String, String, f64, f64, String)>, String> {
    service::get_orders().map_err(|e: AppError| e.to_string())
}

// 📊 Report Status
#[tauri::command]
pub fn get_order_status(order_id: i32) -> Result<String, String> {
    service::get_order_status(order_id)
        .map_err(|e: AppError| e.to_string())
}

// 📊 Parameters
#[tauri::command]
pub fn get_parameters_by_order(
    order_id: i32,
) -> Result<Vec<service::OrderParameterDto>, String> {
    service::get_parameters_by_order(order_id)
        .map_err(|e: AppError| e.to_string())
}

// 📊 Results
#[tauri::command]
pub fn get_results_by_order(order_id: i32) -> Result<Vec<(i32, String)>, String> {
    service::get_results_by_order(order_id)
        .map_err(|e: AppError| e.to_string())
}

// 📄 Report
#[tauri::command]
pub fn get_report(order_id: i32) -> Result<Vec<service::ReportRow>, String> {
    service::get_report(order_id)
        .map_err(|e: AppError| e.to_string())
}

// 👤 Patient
#[tauri::command]
pub fn get_patient_by_order(order_id: i32) -> Result<service::ReportPatientInfo, String> {
    service::get_patient_by_order(order_id)
        .map_err(|e: AppError| e.to_string())
}

// 💰 Payment
#[tauri::command]
pub fn update_payment(order_id: i32, paid_amount: f64) -> Result<String, String> {
    service::update_payment(order_id, paid_amount)
        .map(|_| "Payment updated".into())
        .map_err(|e: AppError| e.to_string())
}

// 💰 Summary
#[tauri::command]
pub fn get_daily_summary() -> Result<(f64, f64, f64), String> {
    service::get_daily_summary()
        .map_err(|e: AppError| e.to_string())
}

// ⚙️ Settings
#[tauri::command]
pub fn get_setting(key: String) -> Result<String, String> {
    service::get_setting(key)
        .map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub fn set_setting(key: String, value: String) -> Result<String, String> {
    service::set_setting(key, value)
        .map(|_| "Saved".into())
        .map_err(|e: AppError| e.to_string())
}

// 🧾 Receipt (FIXED)
#[tauri::command]
pub fn get_receipt(
    order_id: i32,
) -> Result<(String, String, f64, f64, f64, Vec<service::ReceiptLine>), String> {
    service::get_receipt(order_id)
        .map_err(|e: AppError| e.to_string())
}


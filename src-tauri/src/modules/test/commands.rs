use super::service;

// 🧪 Get Tests
#[tauri::command]
pub fn get_tests() -> Result<Vec<(i32, String, f64)>, String> {
    service::get_tests().map_err(|e: rusqlite::Error| e.to_string())
}

// 💾 Create Order
#[tauri::command]
pub fn create_order(
    patient_id: i32,
    test_ids: Vec<i32>,
    total_amount: f64,
) -> Result<String, String> {
    service::create_order(patient_id, test_ids, total_amount)
        .map(|_| "Order saved successfully".into())
        .map_err(|e: rusqlite::Error| e.to_string())
}

// 🧬 Get Test Parameters
#[tauri::command]
pub fn get_test_parameters(
    test_id: i32,
) -> Result<Vec<(i32, String, String, String)>, String> {
    service::get_test_parameters(test_id)
        .map_err(|e: rusqlite::Error| e.to_string())
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
        .map_err(|e: rusqlite::Error| e.to_string())
}

// 📊 Orders
#[tauri::command]
pub fn get_orders() -> Result<Vec<(i32, String, String, f64, f64, String)>, String> {
    service::get_orders().map_err(|e: rusqlite::Error| e.to_string())
}

// 📊 Report Status
#[tauri::command]
pub fn get_order_status(order_id: i32) -> Result<String, String> {
    service::get_order_status(order_id)
        .map_err(|e: rusqlite::Error| e.to_string())
}

// 📊 Parameters
#[tauri::command]
pub fn get_parameters_by_order(
    order_id: i32,
) -> Result<Vec<(i32, String, String, String)>, String> {
    service::get_parameters_by_order(order_id)
        .map_err(|e: rusqlite::Error| e.to_string())
}

// 📊 Results
#[tauri::command]
pub fn get_results_by_order(order_id: i32) -> Result<Vec<(i32, String)>, String> {
    service::get_results_by_order(order_id)
        .map_err(|e: rusqlite::Error| e.to_string())
}

// 📄 Report
#[tauri::command]
pub fn get_report(order_id: i32) -> Result<Vec<(String, String, String, String)>, String> {
    service::get_report(order_id)
        .map_err(|e: rusqlite::Error| e.to_string())
}

// 👤 Patient
#[tauri::command]
pub fn get_patient_by_order(order_id: i32) -> Result<(String, i32, String), String> {
    service::get_patient_by_order(order_id)
        .map_err(|e: rusqlite::Error| e.to_string())
}

// 💰 Payment
#[tauri::command]
pub fn update_payment(order_id: i32, paid_amount: f64) -> Result<String, String> {
    service::update_payment(order_id, paid_amount)
        .map(|_| "Payment updated".into())
        .map_err(|e: rusqlite::Error| e.to_string())
}

// 💰 Summary
#[tauri::command]
pub fn get_daily_summary() -> Result<(f64, f64, f64), String> {
    service::get_daily_summary()
        .map_err(|e: rusqlite::Error| e.to_string())
}

// ⚙️ Settings
#[tauri::command]
pub fn get_setting(key: String) -> Result<String, String> {
    service::get_setting(key)
        .map_err(|e: rusqlite::Error| e.to_string())
}

#[tauri::command]
pub fn set_setting(key: String, value: String) -> Result<String, String> {
    service::set_setting(key, value)
        .map(|_| "Saved".into())
        .map_err(|e: rusqlite::Error| e.to_string())
}

// 🧾 Receipt (FIXED)
#[tauri::command]
pub fn get_receipt(
    order_id: i32,
) -> Result<(String, String, f64, f64, Vec<(String, f64)>), String> {
    service::get_receipt(order_id)
        .map_err(|e: rusqlite::Error| e.to_string())
}


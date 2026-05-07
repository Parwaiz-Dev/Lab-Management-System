use super::service;

#[tauri::command]
pub fn update_payment(order_id: i32, paid_amount: f64) -> Result<String, String> {
    service::update_payment(order_id, paid_amount)
        .map(|_| "Payment updated".into())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_daily_summary() -> Result<(f64, f64, f64), String> {
    service::get_daily_summary().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_overall_summary() -> Result<(f64, f64, f64), String> {
    service::get_overall_summary().map_err(|e| e.to_string())
}

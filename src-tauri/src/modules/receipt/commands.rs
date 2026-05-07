use super::service;
use crate::modules::receipt::model::ReceiptData;

#[tauri::command]
pub fn get_receipt(order_id: i32) -> Result<ReceiptData, String> {
    service::get_receipt(order_id).map_err(|e| e.to_string())
}
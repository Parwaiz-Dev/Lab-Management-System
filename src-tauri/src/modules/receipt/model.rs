use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ReceiptLine {
    pub test_name: String,
    pub price: f64,
    pub parameter_names: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ReceiptData {
    pub order_id: i32,
    pub invoice_no: String,

    pub patient_name: String,
    pub patient_code: String,
    pub age_value: Option<i32>,
    pub age_unit: String,
    pub gender: String,
    pub phone: String,
    pub referred_by: String,

    pub subtotal_amount: f64,
    pub discount_amount: f64,
    pub total_amount: f64,
    pub paid_amount: f64,
    pub pending_amount: f64,
    pub payment_status: String,

    pub order_date: String,
    pub tests: Vec<ReceiptLine>,
}
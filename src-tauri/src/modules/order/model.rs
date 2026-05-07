use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct OrderSummary {
    pub id: i32,
    pub patient_name: String,
    pub tests: String,
    pub total_amount: f64,
    pub paid_amount: f64,
    pub pending_amount: f64,
    pub status: String,
    pub created_at: String,
}
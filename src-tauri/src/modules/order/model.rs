use serde::{Deserialize, Serialize};

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

#[derive(Debug, Serialize)]
pub struct DoctorRevenue {
    pub doctor_name: String,
    pub order_count: i32,
    pub total_amount: f64,
    pub paid_amount: f64,
    pub pending_amount: f64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOrderPayload {
    pub test_ids: Vec<i32>,
    pub parameter_ids: Vec<i32>,
    pub total_amount: f64,
    pub discount_amount: f64,
}
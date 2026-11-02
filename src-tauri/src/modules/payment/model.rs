use serde::Serialize;

#[derive(Serialize)]
pub struct PaymentHistoryEntry {
    pub id: i32,
    pub order_id: i32,
    pub previous_paid: f64,
    pub new_paid: f64,
    pub total_amount: f64,
    pub payment_method: Option<String>,
    pub created_at: String,
}

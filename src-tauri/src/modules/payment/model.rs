use serde::Serialize;

#[derive(Serialize)]
pub struct Summary {
    pub total_amount: f64,
    pub paid_amount: f64,
    pub pending_amount: f64,
}

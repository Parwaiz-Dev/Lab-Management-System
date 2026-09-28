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
    pub report_status: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct DoctorRevenue {
    pub order_count: i32,
    pub total_amount: f64,
    pub paid_amount: f64,
    pub pending_amount: f64,
    pub share_amount: f64,
    pub doctor_id: Option<i32>,
    pub doctor_name: String,
    pub referral_count: i32,
    pub eligible_amount: f64,
    pub share_percentage: f64,
    pub commission_earned: f64,
    pub commission_paid: f64,
    pub commission_outstanding: f64,
    pub last_referral: String,
    pub legacy_order_count: i32,
}

#[derive(Debug, Serialize)]
pub struct DoctorRevenueDetails {
    pub doctor_name: String,
    pub referrals: Vec<DoctorReferralOrder>,
    pub adjustments: Vec<DoctorCommissionAdjustment>,
    pub settlements: Vec<DoctorCommissionSettlement>,
}

#[derive(Debug, Serialize)]
pub struct DoctorReferralOrder {
    pub order_id: i32,
    pub patient_name: String,
    pub tests: String,
    pub eligible_amount: f64,
    pub share_percentage: f64,
    pub commission_earned: f64,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct DoctorCommissionAdjustment {
    pub id: i32,
    pub order_id: i32,
    pub amount: f64,
    pub reason: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct DoctorCommissionSettlement {
    pub id: i32,
    pub amount: f64,
    pub note: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOrderPayload {
    pub test_ids: Vec<i32>,
    pub parameter_ids: Vec<i32>,
    pub total_amount: f64,
    pub discount_amount: f64,
}
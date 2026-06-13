use serde::{Deserialize, Serialize};

/// Full patient history response — returned by `get_patient_history`.
#[derive(Debug, Serialize)]
pub struct PatientHistoryResponse {
    pub patient: PatientProfile,
    pub orders: Vec<HistoryOrder>,
    pub payments: Vec<HistoryPayment>,
    pub reports: Vec<HistoryReport>,
    pub previous_results: Vec<PreviousResultGroup>,
    pub timeline: Vec<TimelineEntry>,
}

#[derive(Debug, Serialize)]
pub struct PatientProfile {
    pub id: i32,
    pub patient_code: String,
    pub name: String,
    pub age_value: Option<i32>,
    pub age_unit: Option<String>,
    pub gender: Option<String>,
    pub phone: Option<String>,
    pub referred_by: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct HistoryOrder {
    pub id: i32,
    pub invoice_no: String,
    pub total_amount: f64,
    pub paid_amount: f64,
    pub pending_amount: f64,
    pub status: String,
    pub created_at: String,
    pub test_names: String,
}

#[derive(Debug, Serialize)]
pub struct HistoryPayment {
    pub id: i32,
    pub order_id: i32,
    pub invoice_no: String,
    pub previous_paid: f64,
    pub new_paid: f64,
    pub total_amount: f64,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct HistoryReport {
    pub order_id: i32,
    pub invoice_no: String,
    pub test_name: String,
    pub parameter_name: String,
    pub value: String,
    pub unit: String,
    pub normal_range: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct PreviousResultGroup {
    pub parameter_name: String,
    pub test_name: String,
    pub unit: String,
    pub normal_range: String,
    pub entries: Vec<PreviousResultEntry>,
}

#[derive(Debug, Serialize)]
pub struct PreviousResultEntry {
    pub order_id: i32,
    pub invoice_no: String,
    pub order_date: String,
    pub value: String,
}

#[derive(Debug, Serialize)]
pub struct TimelineEntry {
    pub event_type: String, // "order", "payment", "result", "patient_created"
    pub description: String,
    pub timestamp: String,
    pub order_id: Option<i32>,
}

/// Internal query params for pagination (future use).
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct HistoryQueryParams {
    pub patient_id: i32,
    pub orders_limit: Option<i32>,
    pub payments_limit: Option<i32>,
    pub reports_limit: Option<i32>,
}
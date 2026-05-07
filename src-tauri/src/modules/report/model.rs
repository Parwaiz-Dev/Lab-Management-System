use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ReportRow {
    pub test_name: String,
    pub parameter_name: String,
    pub value: String,
    pub unit: String,
    pub normal_range: String,
    pub is_entered: bool,
}

#[derive(Debug, Serialize)]
pub struct ReportPatientInfo {
    pub patient_name: String,
    pub patient_code: String,
    pub age_value: i32,
    pub age_unit: String,
    pub gender: String,
    pub phone: String,
    pub referred_by: String,
    pub invoice_no: String,
    pub order_date: String,
}
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct Patient {
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

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct DoctorRecord {
    pub id: i64,
    pub name: String,
    pub is_active: bool,
    pub is_default: bool,
}

use serde::Serialize;

#[derive(Serialize)]
pub struct Patient {
    pub id: i32,
    pub patient_code: String,
    pub name: String,
    pub age_value: Option<i32>,
    pub age_unit: Option<String>,
    pub gender: Option<String>,
    pub phone: Option<String>,
    pub referred_by: Option<String>,
}
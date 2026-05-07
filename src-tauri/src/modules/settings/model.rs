use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AppSettings {
    pub lab_name: String,
    pub lab_address: String,
    pub doctor_share: String,
    pub lab_logo: String,
}
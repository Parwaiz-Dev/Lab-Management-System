use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct OrderParameterDto {
    pub id: i32,
    pub test_id: i32,
    pub test_name: String,
    pub name: String,
    pub unit: String,
    pub normal_range: String,
    pub value: String,
    pub is_entered: bool,
}

#[derive(Debug, Deserialize)]
pub struct ResultInput {
    pub parameter_id: i32,
    pub value: String,
}
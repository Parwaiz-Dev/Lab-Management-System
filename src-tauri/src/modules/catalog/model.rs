use serde::Serialize;

#[derive(Serialize)]
pub struct TestParameterDto {
    pub id: i32,
    pub name: String,
    pub unit: String,
    pub normal_range: String,
}

#[derive(Serialize)]
pub struct TestCatalogItem {
    pub id: i32,
    pub name: String,
    pub price: f64,
    pub parameters: Vec<TestParameterDto>,
}

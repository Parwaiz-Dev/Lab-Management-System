use crate::db::connection::get_connection;
use chrono::Datelike;
use rusqlite::{params, Result};
use super::model::Patient;

// 🔢 Generate Patient ID
pub fn generate_patient_code() -> String {
    let conn = get_connection();

    let year = chrono::Local::now().year();

    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM patients WHERE strftime('%Y', created_at) = ?1",
        [year.to_string()],
        |row| row.get(0),
    ).unwrap();

    format!("PID-{}-{:#04}", year, count + 1)
}

// ➕ Create Patient
pub fn create_patient(
    name: String,
    age_value: Option<i32>,
    age_unit: Option<String>,
    gender: Option<String>,
    phone: Option<String>,
    referred_by: Option<String>,
) -> Result<i32> {
    let conn = get_connection();
    let code = generate_patient_code();

    conn.execute(
        "INSERT INTO patients 
        (patient_code, name, age_value, age_unit, gender, phone, referred_by)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![code, name, age_value, age_unit, gender, phone, referred_by],
    )?;

    // 🔥 GET REAL ID
    let id = conn.last_insert_rowid();

    Ok(id as i32)
}

// 🔍 Search Patients
pub fn search_patients(query: String) -> Result<Vec<Patient>> {
    let conn = get_connection();

    let like_query = format!("%{}%", query);

    let mut stmt = conn.prepare(
        "SELECT id, patient_code, name, age_value, age_unit, gender, phone, referred_by
         FROM patients
         WHERE name LIKE ?1
         LIMIT 10"
    )?;

    let patients = stmt.query_map(params![like_query], |row| {
        Ok(Patient {
            id: row.get(0)?,
            patient_code: row.get(1)?,
            name: row.get(2)?,
            age_value: row.get(3)?,
            age_unit: row.get(4)?,
            gender: row.get(5)?,
            phone: row.get(6)?,
            referred_by: row.get(7)?,
        })
    })?;

    Ok(patients.map(|p| p.unwrap()).collect())
}

// 🧑‍⚕️ Get Doctors
pub fn get_doctors() -> Result<Vec<String>> {
    let conn = get_connection();

    let mut stmt = conn.prepare("SELECT name FROM doctors")?;

    let doctors = stmt.query_map([], |row| {
        Ok(row.get(0)?)
    })?;

    Ok(doctors.map(|d| d.unwrap()).collect())
}

// ➕ Add Doctor
pub fn add_doctor(name: String) -> Result<()> {
    let conn = get_connection();

    conn.execute(
        "INSERT INTO doctors (name) VALUES (?1)",
        [name],
    )?;

    Ok(())
}
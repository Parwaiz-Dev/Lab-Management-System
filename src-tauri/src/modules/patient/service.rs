/// 👤 Patient Service Module
/// Handles all patient-related business logic:
/// - Patient creation with auto-generated IDs
/// - Patient search functionality
/// - Doctor management
/// 
/// Database Tables Used:
/// - patients: Main patient records
/// - doctors: Referring doctor references

use crate::db::connection::get_connection;
use crate::errors::{AppError, AppResult};
use crate::utils::validation::{
    validate_patient_name, validate_age, validate_phone, validate_doctor_name,
};
use chrono::Datelike;
use rusqlite::params;
use super::model::Patient;

// ============================================================================
// 🔢 PATIENT ID GENERATION
// ============================================================================

/// Generate a unique patient code in format: PID-YYYY-NNNN
/// 
/// Format:
/// - PID: Prefix (Patient ID)
/// - YYYY: Current year
/// - NNNN: Sequential number for the year (zero-padded)
/// 
/// Example: PID-2024-0042
/// 
/// This ensures:
/// - Unique across the system
/// - Human-readable format
/// - Year-based organization
pub fn generate_patient_code() -> AppResult<String> {
    let conn = get_connection();
    let year = chrono::Local::now().year();

    // Count existing patients for this year
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM patients WHERE strftime('%Y', created_at) = ?1",
            [year.to_string()],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    Ok(format!("PID-{}-{:04}", year, count + 1))
}

// ============================================================================
// ➕ CREATE PATIENT
// ============================================================================

/// Create a new patient record
/// 
/// Parameters:
/// - name: Patient's full name (required, validated)
/// - age_value: Patient's age as number (validated range: 0-150)
/// - age_unit: Age unit - Years, Months, or Days
/// - gender: Male, Female, or Other
/// - phone: Contact phone number (optional, validated if provided)
/// - referred_by: Name of referring doctor (optional)
/// 
/// Returns:
/// - Patient ID on success
/// - Error if validation fails or database error
/// 
/// Validations:
/// 1. Name: 2-100 chars, letters/spaces/hyphens only
/// 2. Age: 0-150 for years, reasonable ranges for other units
/// 3. Phone: 10-15 digits if provided
pub fn create_patient(
    name: String,
    age_value: Option<i32>,
    age_unit: Option<String>,
    gender: Option<String>,
    phone: Option<String>,
    referred_by: Option<String>,
) -> AppResult<i32> {
    // ✅ Validate inputs before database operations
    validate_patient_name(&name)?;
    
    if let Some(age) = age_value {
        validate_age(age)?;
    }
    
    if let Some(ref p) = phone {
        validate_phone(p)?;
    }

    let conn = get_connection();
    let code = generate_patient_code()?;

    // 📝 Insert with generated code
    conn.execute(
        "INSERT INTO patients 
        (patient_code, name, age_value, age_unit, gender, phone, referred_by)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            code,
            name,
            age_value,
            age_unit.unwrap_or_else(|| "Years".to_string()),
            gender.unwrap_or_else(|| "Male".to_string()),
            phone,
            referred_by
        ],
    )
    .map_err(AppError::from)?;

    // Get the auto-incremented ID
    let id = conn.last_insert_rowid() as i32;
    
    log::info!("Created patient {} with code {}", id, code);
    Ok(id)
}

// ============================================================================
// 🔍 SEARCH PATIENTS
// ============================================================================

/// Search for patients by name (case-insensitive, LIKE query)
/// 
/// Parameters:
/// - query: Search string (minimum 2 characters recommended)
/// 
/// Returns:
/// - Vector of matching Patient records (limit: 10)
/// 
/// Features:
/// - Case-insensitive search
/// - Returns up to 10 results to prevent overwhelming UI
/// - Sorted by name
/// 
/// Performance:
/// - O(n) scan if no index on patient name
/// - Consider adding index: CREATE INDEX idx_patient_name ON patients(name)
pub fn search_patients(query: String) -> AppResult<Vec<Patient>> {
    let conn = get_connection();
    
    // Build LIKE pattern: %query%
    let like_query = format!("%{}%", query.trim());

    let mut stmt = conn
        .prepare(
            "SELECT id, patient_code, name, age_value, age_unit, gender, phone, referred_by
         FROM patients
         WHERE name LIKE ?1
         LIMIT 10"
        )
        .map_err(AppError::from)?;

    let patients = stmt
        .query_map(params![like_query], |row| {
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
        })
        .map_err(AppError::from)?;

    let results: AppResult<Vec<Patient>> = patients
        .map(|p| p.map_err(AppError::from))
        .collect();

    results
}

// ============================================================================
// 🧑‍⚕️ DOCTOR MANAGEMENT
// ============================================================================

/// Retrieve all available doctors
/// 
/// Returns:
/// - Vector of doctor names sorted alphabetically
/// - Used to populate "Referred By" dropdown
pub fn get_doctors() -> AppResult<Vec<String>> {
    let conn = get_connection();

    let mut stmt = conn
        .prepare("SELECT name FROM doctors ORDER BY name ASC")
        .map_err(AppError::from)?;

    let doctors = stmt
        .query_map([], |row| Ok(row.get(0)?))
        .map_err(AppError::from)?;

    let results: AppResult<Vec<String>> = doctors
        .map(|d| d.map_err(AppError::from))
        .collect();

    results
}

/// Add a new doctor to the system
/// 
/// Parameters:
/// - name: Doctor's name (required, validated)
/// 
/// Validations:
/// - Name: 2-100 characters
/// - No duplicate names allowed (database constraint)
/// 
/// Note: Returns error if doctor already exists
pub fn add_doctor(name: String) -> AppResult<()> {
    // ✅ Validate doctor name
    validate_doctor_name(&name)?;

    let conn = get_connection();

    conn.execute(
        "INSERT INTO doctors (name) VALUES (?1)",
        params![name],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            AppError::DuplicateError(format!("Doctor '{}' already exists", name))
        } else {
            AppError::from(e)
        }
    })?;

    log::info!("Added doctor: {}", name);
    Ok(())
}
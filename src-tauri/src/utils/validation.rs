/// ✅ Input Validation Module
/// Validates all user inputs before database operations
/// Prevents SQL injection, invalid data, and business logic violations

use crate::errors::{AppError, AppResult};


/// Validate patient name
/// - Not empty
/// - Not too long (max 100 chars)
/// - No special SQL characters
pub fn validate_patient_name(name: &str) -> AppResult<()> {
    if name.trim().is_empty() {
        return Err(AppError::ValidationError(
            "Patient name cannot be empty".to_string(),
        ));
    }

    if name.len() > 100 {
        return Err(AppError::ValidationError(
            "Patient name too long (max 100 characters)".to_string(),
        ));
    }

    // ⚠️ Allow basic letters, spaces, hyphens, apostrophes
    if !name.chars().all(|c| c.is_alphabetic() || " -'".contains(c)) {
        return Err(AppError::ValidationError(
            "Patient name contains invalid characters".to_string(),
        ));
    }

    Ok(())
}

/// Validate patient age
pub fn validate_age(age: i32) -> AppResult<()> {
    if age < 0 || age > 150 {
        return Err(AppError::ValidationError(
            "Age must be between 0 and 150".to_string(),
        ));
    }
    Ok(())
}

/// Validate phone number (basic validation)
pub fn validate_phone(phone: &str) -> AppResult<()> {
    if phone.is_empty() {
        return Ok(()); // Optional field
    }

    if phone.len() < 10 || phone.len() > 15 {
        return Err(AppError::ValidationError(
            "Phone number must be 10-15 digits".to_string(),
        ));
    }

    if !phone.chars().all(|c| c.is_numeric() || "+-() ".contains(c)) {
        return Err(AppError::ValidationError(
            "Phone contains invalid characters".to_string(),
        ));
    }

    Ok(())
}

/// Validate amount (price, payment)
pub fn validate_amount(amount: f64) -> AppResult<()> {
    if amount < 0.0 {
        return Err(AppError::ValidationError(
            "Amount cannot be negative".to_string(),
        ));
    }

    if amount.is_nan() || amount.is_infinite() {
        return Err(AppError::ValidationError(
            "Invalid amount value".to_string(),
        ));
    }

    // Max amount: 10 million (reasonable upper bound)
    if amount > 10_000_000.0 {
        return Err(AppError::ValidationError(
            "Amount exceeds maximum allowed value".to_string(),
        ));
    }

    Ok(())
}

/// Validate doctor name
pub fn validate_doctor_name(name: &str) -> AppResult<()> {
    if name.trim().is_empty() {
        return Err(AppError::ValidationError(
            "Doctor name cannot be empty".to_string(),
        ));
    }

    if name.len() > 100 {
        return Err(AppError::ValidationError(
            "Doctor name too long (max 100 characters)".to_string(),
        ));
    }

    Ok(())
}

/// Validate test parameter value
pub fn validate_parameter_value(value: &str) -> AppResult<()> {
    if value.trim().is_empty() {
        return Err(AppError::ValidationError(
            "Parameter value cannot be empty".to_string(),
        ));
    }

    if value.len() > 500 {
        return Err(AppError::ValidationError(
            "Parameter value too long (max 500 characters)".to_string(),
        ));
    }

    Ok(())
}

/// Validate multiple test IDs
pub fn validate_test_ids(test_ids: &[i32]) -> AppResult<()> {
    if test_ids.is_empty() {
        return Err(AppError::ValidationError(
            "At least one test must be selected".to_string(),
        ));
    }

    if test_ids.len() > 100 {
        return Err(AppError::ValidationError(
            "Too many tests selected (max 100)".to_string(),
        ));
    }

    // Check for negative IDs
    if test_ids.iter().any(|&id| id <= 0) {
        return Err(AppError::ValidationError(
            "Invalid test ID provided".to_string(),
        ));
    }

    Ok(())
}

/// Validate positive integer (for IDs)
pub fn validate_positive_id(id: i32, field_name: &str) -> AppResult<()> {
    if id <= 0 {
        return Err(AppError::ValidationError(format!(
            "{} must be a positive number",
            field_name
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_name_valid() {
        assert!(validate_patient_name("John Doe").is_ok());
        assert!(validate_patient_name("Mary-Jane O'Connor").is_ok());
    }

    #[test]
    fn test_validate_name_empty() {
        assert!(validate_patient_name("").is_err());
        assert!(validate_patient_name("   ").is_err());
    }

    #[test]
    fn test_validate_age() {
        assert!(validate_age(25).is_ok());
        assert!(validate_age(-1).is_err());
        assert!(validate_age(200).is_err());
    }

    #[test]
    fn test_validate_amount() {
        assert!(validate_amount(100.50).is_ok());
        assert!(validate_amount(-50.0).is_err());
        assert!(validate_amount(20_000_000.0).is_err());
    }
}

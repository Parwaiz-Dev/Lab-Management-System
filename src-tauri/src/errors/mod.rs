/// 🛡️ Error Handling Module
/// Provides structured error types and conversion utilities for the entire application.
/// This replaces ad-hoc string error handling with proper Rust error patterns.

use std::fmt;

/// AppError - Unified error type for all application errors
/// Provides context and error categorization for better debugging and user messaging
#[derive(Debug, Clone)]
pub enum AppError {
    /// Database operation failed (connection, query, etc.)
    DatabaseError(String),
    
    /// Input validation failed (invalid data format, missing fields, etc.)
    ValidationError(String),
    
    /// Resource not found (patient, order, test, etc.)
    NotFound(String),
    
    /// Duplicate resource (patient code already exists, etc.)
    DuplicateError(String),
    
    /// Business logic violation (payment exceeds total, etc.)
    BusinessLogicError(String),
    
    /// File I/O operation failed (backup, restore, etc.)
    FileError(String),
    
    /// Internal server error
    InternalError(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::DatabaseError(msg) => write!(f, "Database Error: {}", msg),
            AppError::ValidationError(msg) => write!(f, "Validation Error: {}", msg),
            AppError::NotFound(msg) => write!(f, "Not Found: {}", msg),
            AppError::DuplicateError(msg) => write!(f, "Duplicate: {}", msg),
            AppError::BusinessLogicError(msg) => write!(f, "Business Logic Error: {}", msg),
            AppError::FileError(msg) => write!(f, "File Error: {}", msg),
            AppError::InternalError(msg) => write!(f, "Internal Error: {}", msg),
        }
    }
}

impl std::error::Error for AppError {}

/// Convert rusqlite::Error to AppError
impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        log::error!("SQLite Error: {:?}", err);
        match err {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound("Query returned no results".to_string())
            }
            rusqlite::Error::InvalidParameterCount(expected, provided) => {
                AppError::ValidationError(format!(
                    "Parameter count mismatch: expected {}, got {}",
                    expected, provided
                ))
            }
            rusqlite::Error::InvalidColumnType(col, _, _) => {
                AppError::DatabaseError(format!("Invalid column type: {}", col))
            }
            rusqlite::Error::InvalidColumnName(name) => {
                AppError::DatabaseError(format!("Invalid column: {}", name))
            }
            _ => AppError::DatabaseError(err.to_string()),
        }
    }
}

/// Convert AppError to Tauri Result (String error)
impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}

/// Helper type for Results in this crate
pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = AppError::ValidationError("Name is required".to_string());
        assert_eq!(err.to_string(), "Validation Error: Name is required");
    }

    #[test]
    fn test_error_conversion() {
        let err: String = AppError::NotFound("Patient not found".to_string()).into();
        assert_eq!(err, "Not Found: Patient not found");
    }
}

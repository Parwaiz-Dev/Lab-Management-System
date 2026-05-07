use std::fmt;

#[derive(Debug, Clone)]
pub enum AppError {
    DatabaseError(String),
    ValidationError(String),
    NotFound(String),
    DuplicateError(String),
    BusinessLogicError(String),
    FileError(String),
    InternalError(String),
}

impl AppError {
    pub fn user_message(&self) -> String {
        match self {
            AppError::DatabaseError(_) => {
                "A database error occurred. Please try again.".to_string()
            }
            AppError::ValidationError(msg) => msg.clone(),
            AppError::NotFound(msg) => msg.clone(),
            AppError::DuplicateError(msg) => msg.clone(),
            AppError::BusinessLogicError(msg) => msg.clone(),
            AppError::FileError(msg) => msg.clone(),
            AppError::InternalError(_) => {
                "Something went wrong. Please try again.".to_string()
            }
        }
    }
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

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        log::error!("SQLite Error: {:?}", err);

        match err {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound("Record not found".to_string())
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

            rusqlite::Error::SqliteFailure(db_error, message) => {
                if db_error.code == rusqlite::ErrorCode::ConstraintViolation {
                    return AppError::DuplicateError(
                        message.unwrap_or_else(|| "Duplicate or constraint violation".to_string()),
                    );
                }

                AppError::DatabaseError(
                    message.unwrap_or_else(|| db_error.to_string()),
                )
            }

            _ => AppError::DatabaseError(err.to_string()),
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        log::error!("File Error: {:?}", err);
        AppError::FileError(err.to_string())
    }
}

impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}

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

    #[test]
    fn test_user_message() {
        let err = AppError::BusinessLogicError("Payment cannot exceed order total".to_string());
        assert_eq!(err.user_message(), "Payment cannot exceed order total");
    }
}
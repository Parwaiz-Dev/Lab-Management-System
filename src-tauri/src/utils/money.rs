use crate::errors::{AppError, AppResult};

const MAX_AMOUNT: f64 = 10_000_000.0;
const PAISE_PER_RUPEE: f64 = 100.0;
const DECIMAL_EPSILON: f64 = 0.000_001;

/// Convert rupee amount to paise for safe integer storage.
///
/// Examples:
/// - 450.50 -> 45050
/// - 100.00 -> 10000
/// - 0.99 -> 99
///
/// Why this exists:
/// SQLite REAL values can create rounding issues for currency.
/// For billing, payments, discounts, and reports, store money as INTEGER paise.
pub fn to_paise(amount: f64) -> AppResult<i64> {
    if amount.is_nan() || amount.is_infinite() {
        return Err(AppError::ValidationError(
            "Invalid amount value".to_string(),
        ));
    }

    if amount < 0.0 {
        return Err(AppError::ValidationError(
            "Amount cannot be negative".to_string(),
        ));
    }

    if amount > MAX_AMOUNT {
        return Err(AppError::ValidationError(format!(
            "Amount cannot exceed {}",
            MAX_AMOUNT
        )));
    }

    let paise_float = amount * PAISE_PER_RUPEE;
    let rounded_paise = paise_float.round();

    if (paise_float - rounded_paise).abs() > DECIMAL_EPSILON {
        return Err(AppError::ValidationError(
            "Amount must have at most two decimal places".to_string(),
        ));
    }

    Ok(rounded_paise as i64)
}

/// Convert stored paise back to rupee amount for UI/API response.
///
/// Example:
/// - 45050 -> 450.50
/// - 10000 -> 100.00
pub fn from_paise(paise: i64) -> f64 {
    (paise as f64) / PAISE_PER_RUPEE
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_rupees_to_paise() {
        assert_eq!(to_paise(100.0).unwrap(), 10000);
        assert_eq!(to_paise(450.50).unwrap(), 45050);
        assert_eq!(to_paise(0.99).unwrap(), 99);
    }

    #[test]
    fn converts_paise_to_rupees() {
        assert_eq!(from_paise(10000), 100.0);
        assert_eq!(from_paise(45050), 450.5);
        assert_eq!(from_paise(99), 0.99);
    }

    #[test]
    fn rejects_invalid_amounts() {
        assert!(to_paise(-1.0).is_err());
        assert!(to_paise(f64::NAN).is_err());
        assert!(to_paise(f64::INFINITY).is_err());
    }

    #[test]
    fn rejects_more_than_two_decimals() {
        assert!(to_paise(100.123).is_err());
        assert!(to_paise(99.999).is_err());
    }

    #[test]
    fn rejects_large_amounts() {
        assert!(to_paise(10_000_001.0).is_err());
    }
}
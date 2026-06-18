/// Compute payment status string from paise values.
/// - "Pending" when nothing has been paid yet
/// - "Partial" when some but not all has been paid
/// - "Completed" when fully paid
pub fn payment_status(total_paise: i64, paid_paise: i64) -> String {
    if paid_paise <= 0 {
        "Pending".to_string()
    } else if paid_paise < total_paise {
        "Partial".to_string()
    } else {
        "Completed".to_string()
    }
}
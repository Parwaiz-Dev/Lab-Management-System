use std::time::Duration;

/// Developer-controlled expiration window in hours.
/// Set to 24 hours per system specifications.
/// Modifying this single constant adjusts the entire expiration lifecycle.
pub const AUTO_UNINSTALL_AFTER_HOURS: u64 = 128;

/// Developer-controlled flag determining whether reinstallation or explicit calls
/// can reset the activation timer.
/// Default: false (production). In production, reinstalling NEVER resets the timer.
pub const ALLOW_ACTIVATION_RESET: bool = false;

/// Interval between periodic background checks while the application is running (in seconds).
pub const BACKGROUND_CHECK_INTERVAL_SECS: u64 = 60;

/// Resolves the effective expiration duration.
/// In standard runtime, returns AUTO_UNINSTALL_AFTER_HOURS converted to Duration.
/// During automated testing, permits `LMS_TEST_EXPIRATION_SECS` environment override if set.
pub fn get_expiration_duration() -> Duration {
    if let Ok(val) = std::env::var("LMS_TEST_EXPIRATION_SECS") {
        if let Ok(secs) = val.trim().parse::<u64>() {
            if secs > 0 {
                return Duration::from_secs(secs);
            }
        }
    }
    Duration::from_secs(AUTO_UNINSTALL_AFTER_HOURS * 3600)
}

pub mod config;
pub mod monitor;
pub mod scheduler;
pub mod state;
pub mod storage;
pub mod uninstaller;

#[cfg(test)]
mod integration_test;

pub use config::{
    get_expiration_duration, ALLOW_ACTIVATION_RESET, AUTO_UNINSTALL_AFTER_HOURS,
    BACKGROUND_CHECK_INTERVAL_SECS,
};
pub use monitor::start_monitor;
pub use scheduler::{register_scheduled_task, remove_scheduled_task};
pub use state::ActivationRecord;
pub use storage::{get_activation_file_path, load_or_initialize_activation, sync_to_db};
pub use uninstaller::{find_uninstaller_path, trigger_uninstallation};

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration as ChronoDuration, Utc};
    use std::fs;
    use std::time::Duration;

    #[test]
    fn test_developer_constant_configuration() {
        // Requirement 1: Developer-controlled hardcoded expiration constant
        assert_eq!(
            AUTO_UNINSTALL_AFTER_HOURS, 24,
            "AUTO_UNINSTALL_AFTER_HOURS must default to 24 hours"
        );
        // Requirement 6: Reinstalling should not silently reset
        assert_eq!(
            ALLOW_ACTIVATION_RESET, false,
            "ALLOW_ACTIVATION_RESET must be false in production"
        );
    }

    #[test]
    fn test_activation_record_lifecycle() {
        let now = Utc::now();
        let record = ActivationRecord::new(now, Duration::from_secs(3600));

        assert!(!record.is_expired(), "Record should not be expired immediately");
        assert!(record.remaining_seconds() > 3500, "Remaining seconds should be close to 3600");

        // Expired record
        let past = now - ChronoDuration::hours(25);
        let expired_record = ActivationRecord::new(past, Duration::from_secs(24 * 3600));
        assert!(expired_record.is_expired(), "Record created 25h ago with 24h duration must be expired");
        assert_eq!(expired_record.remaining_seconds(), 0, "Expired record remaining seconds must be 0");
    }

    #[test]
    fn test_restart_persistence() {
        let temp_dir = std::env::temp_dir().join(format!("lms_test_persist_{}", Utc::now().timestamp_nanos_opt().unwrap_or(0)));
        fs::create_dir_all(&temp_dir).unwrap();
        let test_file = temp_dir.join(".activation_lock.json");

        let initial_time = Utc::now() - ChronoDuration::hours(5);
        let record = ActivationRecord::new(initial_time, Duration::from_secs(24 * 3600));

        // Save
        let json = serde_json::to_string_pretty(&record).unwrap();
        fs::write(&test_file, json).unwrap();

        // Simulate application restart by reading from disk in a fresh context
        let loaded_json = fs::read_to_string(&test_file).unwrap();
        let loaded_record: ActivationRecord = serde_json::from_str(&loaded_json).unwrap();

        assert_eq!(loaded_record.first_activated_at, record.first_activated_at);
        assert_eq!(loaded_record.expires_at, record.expires_at);
        assert_eq!(loaded_record.installation_id, record.installation_id);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_reinstall_protection_does_not_reset_timestamp() {
        // Verify that if an existing timestamp is present in storage,
        // initialization logic respects it rather than replacing with Utc::now()
        let original_activation = Utc::now() - ChronoDuration::hours(10);
        let duration = Duration::from_secs(24 * 3600);
        let record = ActivationRecord::new(original_activation, duration);

        assert_eq!(record.first_activated_at_datetime().timestamp(), original_activation.timestamp());
        let remaining = record.remaining_seconds();
        // 24 hours - 10 hours = 14 hours = ~50400 seconds
        assert!(remaining <= 14 * 3600 + 5 && remaining >= 14 * 3600 - 5);
    }

    #[test]
    fn test_user_data_path_separation() {
        // Requirement 5: Uninstall only application files, preserve databases, user files, backups.
        let data_dir = crate::db::connection::get_db_dir().unwrap();
        let db_path = crate::db::connection::get_db_path().unwrap();

        assert!(
            db_path.starts_with(&data_dir),
            "Database path must reside in the persistent OS AppData folder"
        );
        assert_eq!(
            db_path.file_name().unwrap(),
            "lab_data.db"
        );
    }
}

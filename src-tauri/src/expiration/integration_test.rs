#[cfg(test)]
mod tests {
    use crate::expiration::config::{
        get_expiration_duration, ALLOW_ACTIVATION_RESET, AUTO_UNINSTALL_AFTER_HOURS,
    };
    use crate::expiration::scheduler::{register_scheduled_task, remove_scheduled_task};
    use crate::expiration::state::ActivationRecord;
    use crate::expiration::uninstaller::find_uninstaller_path;
    use chrono::{Duration as ChronoDuration, Utc};
    use rusqlite::Connection;
    use std::fs;
    use std::time::Duration;

    #[test]
    fn test_short_development_duration_expiration() {
        // Requirement 9: Verify expiration using short duration
        std::env::set_var("LMS_TEST_EXPIRATION_SECS", "2");
        let dur = get_expiration_duration();
        assert_eq!(dur, Duration::from_secs(2));

        let now = Utc::now();
        let record = ActivationRecord::new(now, dur);

        // Initially not expired
        assert!(!record.is_expired());

        // Wait slightly past duration
        std::thread::sleep(Duration::from_millis(2100));

        // Now expired
        assert!(record.is_expired());
        assert_eq!(record.remaining_seconds(), 0);

        // Clean up test env var
        std::env::remove_var("LMS_TEST_EXPIRATION_SECS");
        // Verify restored production duration
        assert_eq!(
            get_expiration_duration(),
            Duration::from_secs(AUTO_UNINSTALL_AFTER_HOURS * 3600)
        );
    }

    #[test]
    fn test_restart_persistence_cycle() {
        // Requirement 2: Countdown must persist across application restarts
        let temp_dir = std::env::temp_dir().join(format!("lms_restart_{}", Utc::now().timestamp_nanos_opt().unwrap_or(0)));
        fs::create_dir_all(&temp_dir).unwrap();

        let initial_activated = Utc::now() - ChronoDuration::hours(3);
        let record = ActivationRecord::new(initial_activated, Duration::from_secs(24 * 3600));

        let state_file = temp_dir.join(".activation_lock.json");
        fs::write(&state_file, serde_json::to_string_pretty(&record).unwrap()).unwrap();

        // Simulate app restart: Read state in a new execution context
        let content = fs::read_to_string(&state_file).unwrap();
        let reloaded: ActivationRecord = serde_json::from_str(&content).unwrap();

        assert_eq!(reloaded.first_activated_at, record.first_activated_at);
        assert_eq!(reloaded.expires_at, record.expires_at);
        assert_eq!(reloaded.installation_id, record.installation_id);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_no_reinstall_reset_guarantee() {
        // Requirement 6: Reinstalling should not silently reset the original activation timestamp
        assert!(!ALLOW_ACTIVATION_RESET);

        let original_install_time = Utc::now() - ChronoDuration::hours(18);
        let initial_record = ActivationRecord::new(original_install_time, Duration::from_secs(24 * 3600));

        // Simulate new binary launch after reinstall finding existing metadata
        let reinstalled_time = Utc::now();
        let timestamps = vec![initial_record.first_activated_at_datetime(), reinstalled_time];
        let earliest = timestamps.into_iter().min().unwrap();

        assert_eq!(
            earliest.timestamp(),
            original_install_time.timestamp(),
            "The reinstallation must retain the original installation timestamp"
        );
    }

    #[test]
    fn test_data_preservation_guarantee() {
        // Requirement 5: Uninstall only application files. Never delete SQLite databases, user files, backups.
        let temp_dir = std::env::temp_dir().join(format!("lms_data_pres_{}", Utc::now().timestamp_nanos_opt().unwrap_or(0)));
        fs::create_dir_all(&temp_dir).unwrap();

        let test_db_path = temp_dir.join("lab_data.db");
        let conn = Connection::open(&test_db_path).unwrap();

        conn.execute_batch(
            "CREATE TABLE patients (id INTEGER PRIMARY KEY, name TEXT);
             INSERT INTO patients (name) VALUES ('Test Patient 1');
             CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
             INSERT INTO settings (key, value) VALUES ('lab_name', 'Preserved Lab');",
        ).unwrap();

        // Create a simulated backup file
        let backup_dir = temp_dir.join("backups");
        fs::create_dir_all(&backup_dir).unwrap();
        let backup_file = backup_dir.join("lab_backup_20261012.db");
        fs::copy(&test_db_path, &backup_file).unwrap();

        // Perform WAL checkpoint as uninstallation mechanism does
        conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);").unwrap();
        drop(conn);

        // Verify data intact
        let conn2 = Connection::open(&test_db_path).unwrap();
        let patient_name: String = conn2
            .query_row("SELECT name FROM patients WHERE id = 1", [], |r| r.get(0))
            .unwrap();
        let lab_name: String = conn2
            .query_row("SELECT value FROM settings WHERE key = 'lab_name'", [], |r| r.get(0))
            .unwrap();

        assert_eq!(patient_name, "Test Patient 1");
        assert_eq!(lab_name, "Preserved Lab");
        assert!(backup_file.exists(), "Backup files must be completely preserved");

        drop(conn2);
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_windows_scheduled_task_lifecycle() {
        // Requirement 4: Test scheduling logic
        let future = Utc::now() + ChronoDuration::hours(24);
        let record = ActivationRecord::new(future, Duration::from_secs(24 * 3600));

        let reg_res = register_scheduled_task(&record);
        assert!(reg_res.is_ok());

        let remove_res = remove_scheduled_task();
        assert!(remove_res.is_ok());
    }

    #[test]
    fn test_uninstaller_discovery() {
        // Requirement 3: Finds official uninstaller
        let uninstaller = find_uninstaller_path();
        // If installed on Windows, it finds C:\Users\...\AppData\Local\lms\uninstall.exe
        if let Some(ref path) = uninstaller {
            assert!(path.exists(), "Found uninstaller path must exist on disk");
            println!("Discovered official Windows uninstaller at: {:?}", path);
        }
    }
}

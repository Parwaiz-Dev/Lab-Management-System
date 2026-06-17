/// Settings module integration tests.
#[cfg(test)]
mod tests {
    use crate::modules::settings::service::{
        get_all_settings, get_setting, save_lab_settings, set_setting,
    };
    use rusqlite::Connection;

    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            INSERT INTO settings (key, value) VALUES ('lab_name', 'My Lab');
            INSERT INTO settings (key, value) VALUES ('lab_address', '123 Street');
            INSERT INTO settings (key, value) VALUES ('doctor_share', '0.3');
        ",
        )
        .unwrap();
        conn
    }

    // ── get_setting ──

    #[test]
    fn get_setting_returns_existing_value() {
        let conn = test_db();
        let value = get_setting(&conn, "lab_name".into()).unwrap();
        assert_eq!(value, "My Lab");
    }

    #[test]
    fn get_setting_returns_default_for_missing() {
        let conn = test_db();
        // get_setting uses .unwrap_or_default() → "" for String
        let value = get_setting(&conn, "lab_logo".into()).unwrap();
        assert_eq!(value, "");
    }

    #[test]
    fn get_setting_doctor_share_default() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);",
        )
        .unwrap();
        // get_setting returns "" for missing keys (unwrap_or_default)
        let value = get_setting(&conn, "doctor_share".into()).unwrap();
        assert_eq!(value, "");
    }

    #[test]
    fn get_setting_lab_name_default() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);",
        )
        .unwrap();
        let value = get_setting(&conn, "lab_name".into()).unwrap();
        assert_eq!(value, "");
    }

    // ── set_setting ──

    #[test]
    fn set_setting_inserts_new_key() {
        let conn = test_db();
        set_setting(&conn, "lab_logo".into(), "/path/to/logo.png".into()).unwrap();
        let value = get_setting(&conn, "lab_logo".into()).unwrap();
        assert_eq!(value, "/path/to/logo.png");
    }

    #[test]
    fn set_setting_updates_existing_key() {
        let conn = test_db();
        set_setting(&conn, "lab_name".into(), "Updated Lab".into()).unwrap();
        let value = get_setting(&conn, "lab_name".into()).unwrap();
        assert_eq!(value, "Updated Lab");
    }

    #[test]
    fn set_setting_rejects_empty_key() {
        let conn = test_db();
        let result = set_setting(&conn, "".into(), "value".into());
        assert!(result.is_err());
    }

    #[test]
    fn set_setting_rejects_invalid_doctor_share() {
        let conn = test_db();
        let result = set_setting(&conn, "doctor_share".into(), "invalid".into());
        assert!(result.is_err());
    }

    #[test]
    fn set_setting_validates_doctor_share_range() {
        let conn = test_db();
        // Negative value (< 0)
        let result = set_setting(&conn, "doctor_share".into(), "-0.1".into());
        assert!(result.is_err());
        // Value > 1.0
        let result2 = set_setting(&conn, "doctor_share".into(), "1.5".into());
        assert!(result2.is_err());
    }

    #[test]
    fn set_setting_accepts_valid_doctor_share() {
        let conn = test_db();
        set_setting(&conn, "doctor_share".into(), "0.4".into()).unwrap();
        let value = get_setting(&conn, "doctor_share".into()).unwrap();
        assert_eq!(value, "0.4");
    }

    // ── get_all_settings ──

    #[test]
    fn get_all_settings_returns_all_values() {
        let conn = test_db();
        let settings = get_all_settings(&conn).unwrap();
        assert_eq!(settings.lab_name, "My Lab");
        assert_eq!(settings.lab_address, "123 Street");
        assert_eq!(settings.doctor_share, "0.3");
        assert_eq!(settings.lab_logo, "");
    }

    #[test]
    fn get_all_settings_empty_db_returns_defaults() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);",
        )
        .unwrap();
        let settings = get_all_settings(&conn).unwrap();
        // get_all_settings uses get_setting_or_default with these defaults:
        // lab_name="Your Lab", lab_address="Your Address", doctor_share="0.4", lab_logo=""
        assert_eq!(settings.lab_name, "Your Lab");
        assert_eq!(settings.lab_address, "Your Address");
        assert_eq!(settings.doctor_share, "0.4");
        assert_eq!(settings.lab_logo, "");
    }

    // ── save_lab_settings ──

    #[test]
    fn save_lab_settings_updates_all_fields() {
        let mut conn = test_db();
        save_lab_settings(
            &mut conn,
            "New Lab".into(),
            "New Address".into(),
            "0.5".into(),
            "/new/logo.png".into(),
        )
        .unwrap();
        let settings = get_all_settings(&conn).unwrap();
        assert_eq!(settings.lab_name, "New Lab");
        assert_eq!(settings.lab_address, "New Address");
        assert_eq!(settings.doctor_share, "0.5");
        assert_eq!(settings.lab_logo, "/new/logo.png");
    }

    #[test]
    fn save_lab_settings_rejects_invalid_doctor_share() {
        let mut conn = test_db();
        let result = save_lab_settings(
            &mut conn,
            "Lab".into(),
            "Addr".into(),
            "invalid".into(),
            "".into(),
        );
        assert!(result.is_err());
    }
}
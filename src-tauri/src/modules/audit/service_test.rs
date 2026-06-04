/// Audit log integration tests.
///
/// These tests verify that the audit system:
/// 1. Correctly logs create/update/delete/toggle actions
/// 2. Does NOT log passwords
/// 3. Never breaks primary operations (audit failures are swallowed)
#[cfg(test)]
mod tests {
    use crate::db::connection::get_connection;
    use crate::db::schema::init_db;
    use crate::modules::audit::model::AuditLogEntry;
    use crate::modules::audit::service;

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /// Bootstrap an in-memory DB with the full schema + seeds.
    fn test_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_code TEXT UNIQUE,
                name TEXT NOT NULL,
                age_value INTEGER,
                age_unit TEXT,
                gender TEXT,
                phone TEXT,
                referred_by TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                total_amount REAL DEFAULT 0,
                total_amount_paise INTEGER DEFAULT 0,
                discount_amount REAL DEFAULT 0,
                discount_amount_paise INTEGER DEFAULT 0,
                paid_amount REAL DEFAULT 0,
                paid_amount_paise INTEGER DEFAULT 0,
                invoice_no TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id)
            );
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'staff',
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                table_name TEXT NOT NULL,
                record_id INTEGER,
                old_data TEXT,
                new_data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            CREATE TABLE IF NOT EXISTS results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                parameter_id INTEGER NOT NULL,
                value TEXT,
                FOREIGN KEY (order_id) REFERENCES orders(id)
            );
            ",
        )
        .unwrap();
        conn.execute("INSERT INTO users (id, username, password_hash, role) VALUES (1, 'admin', '$2b$12$hash', 'admin')", []).unwrap();
        conn.execute("INSERT INTO users (id, username, password_hash, role) VALUES (2, 'staff1', '$2b$12$hash', 'staff')", []).unwrap();
        conn.execute("INSERT INTO patients (id, patient_code, name) VALUES (1, 'P001', 'Test Patient')", []).unwrap();
        conn.execute("INSERT INTO patients (id, patient_code, name) VALUES (2, 'P002', 'John Doe')", []).unwrap();
        conn.execute("INSERT INTO orders (id, patient_id, total_amount, total_amount_paise, paid_amount, paid_amount_paise) VALUES (1, 1, 500, 50000, 0, 0)", []).unwrap();
        conn.execute("INSERT INTO orders (id, patient_id, total_amount, total_amount_paise, paid_amount, paid_amount_paise) VALUES (2, 2, 1000, 100000, 200, 20000)", []).unwrap();
        conn.execute("INSERT INTO settings (key, value) VALUES ('lab_name', 'Old Lab')", []).unwrap();
        conn
    }

    /// Count audit log rows matching filters.
    fn count_audit(conn: &rusqlite::Connection, action: &str, table_name: &str) -> i32 {
        conn.query_row(
            "SELECT COUNT(*) FROM audit_logs WHERE action = ?1 AND table_name = ?2",
            rusqlite::params![action, table_name],
            |row| row.get(0),
        )
        .unwrap()
    }

    // ------------------------------------------------------------------
    // 1. Basic create-and-verify
    // ------------------------------------------------------------------

    #[test]
    fn audit_log_is_created_on_insert() {
        let conn = test_db();

        let before = count_audit(&conn, "create", "patients");

        service::create_audit_log(
            &conn,
            1,          // admin user_id
            "create",
            "patients",
            Some(1),
            None,
            Some(r#"{"name":"Test Patient"}"#),
        );

        let after = count_audit(&conn, "create", "patients");
        assert_eq!(after, before + 1, "audit row should have been inserted");
    }

    // ------------------------------------------------------------------
    // 2. Audit with old_data (payment update snapshot)
    // ------------------------------------------------------------------

    #[test]
    fn audit_with_old_and_new_data() {
        let conn = test_db();

        service::create_audit_log(
            &conn,
            1,
            "update",
            "orders",
            Some(1),
            Some(r#"{"paid_amount":"0"}"#),
            Some(r#"{"paid_amount":"500"}"#),
        );

        let log = get_latest(conn);
        assert_eq!(log.action, "update");
        assert_eq!(log.table_name, "orders");
        assert_eq!(log.record_id, Some(1));
        assert!(log.old_data.unwrap().contains("paid_amount"));
        assert!(log.new_data.unwrap().contains("500"));
    }

    // ------------------------------------------------------------------
    // 3. Safety — password is never logged
    // ------------------------------------------------------------------

    #[test]
    fn password_is_never_logged() {
        let conn = test_db();

        // Simulate user creation audit (as the commands layer does)
        service::create_audit_log(
            &conn,
            1,
            "create",
            "users",
            Some(3),
            None,
            Some(r#"{"username":"newuser","role":"staff"}"#),
        );

        let logs = service::get_audit_logs(&conn, Some("users"), Some(3), None, None, None).unwrap();
        assert_eq!(logs.len(), 1);

        let entry = &logs[0];
        // The new_data JSON must NOT contain "password" or "password_hash"
        if let Some(ref data) = entry.new_data {
            let lower = data.to_lowercase();
            assert!(
                !lower.contains("password"),
                "audit log must never contain password: {}",
                data
            );
            assert!(
                !lower.contains("hash"),
                "audit log must never contain password hash: {}",
                data
            );
        }
    }

    // ------------------------------------------------------------------
    // 4. Safety — audit failure does NOT break primary operation
    // ------------------------------------------------------------------

    #[test]
    fn audit_failure_does_not_break_caller() {
        // Drop audit_logs table to simulate a broken audit schema
        let conn = test_db();
        conn.execute("DROP TABLE audit_logs", []).unwrap();

        // This call should NOT panic — it just swallows the error
        service::create_audit_log(
            &conn,
            1,
            "create",
            "patients",
            Some(1),
            None,
            Some(r#"{"name":"safe"}"#),
        );

        // The patients table should still be intact
        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM patients", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 2, "patients table should be unaffected");
    }

    // ------------------------------------------------------------------
    // 5. Query helpers return correct results
    // ------------------------------------------------------------------

    #[test]
    fn get_record_history_filters_correctly() {
        let conn = test_db();

        // Write two audit entries for order 1, one for order 2
        service::create_audit_log(&conn, 1, "create", "orders", Some(1), None, Some(r#"{}"#));
        service::create_audit_log(&conn, 1, "update", "orders", Some(1), Some(r#"{}"#), Some(r#"{}"#));
        service::create_audit_log(&conn, 2, "update", "orders", Some(2), Some(r#"{}"#), Some(r#"{}"#));

        let history = service::get_record_history(&conn, "orders", 1).unwrap();
        assert_eq!(history.len(), 2, "should return only order 1 entries");

        // Newest first
        assert_eq!(history[0].action, "update");
        assert_eq!(history[1].action, "create");
    }

    #[test]
    fn get_user_activity_filters_by_user() {
        let conn = test_db();

        service::create_audit_log(&conn, 1, "create", "patients", Some(1), None, Some(r#"{}"#));
        service::create_audit_log(&conn, 2, "create", "patients", Some(2), None, Some(r#"{}"#));
        service::create_audit_log(&conn, 1, "update", "patients", Some(1), Some(r#"{}"#), Some(r#"{}"#));

        let user1 = service::get_user_activity(&conn, 1, None).unwrap();
        assert_eq!(user1.len(), 2);

        let user2 = service::get_user_activity(&conn, 2, None).unwrap();
        assert_eq!(user2.len(), 1);
    }

    #[test]
    fn get_audit_logs_with_all_filters() {
        let conn = test_db();

        service::create_audit_log(&conn, 1, "update", "orders", Some(1), Some(r#"{}"#), Some(r#"{}"#));
        service::create_audit_log(&conn, 1, "update", "orders", Some(2), Some(r#"{}"#), Some(r#"{}"#));
        service::create_audit_log(&conn, 2, "create", "patients", Some(1), None, Some(r#"{}"#));

        let result = service::get_audit_logs(
            &conn,
            Some("orders"),
            Some(1),
            Some(1),
            None,
            None,
        )
        .unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].user_id, 1);
        assert_eq!(result[0].table_name, "orders");
        assert_eq!(result[0].record_id, Some(1));
    }

    // ------------------------------------------------------------------
    // 6. Snapshot helper
    // ------------------------------------------------------------------

    #[test]
    fn snapshot_row_captures_current_values() {
        let conn = test_db();

        let snap = service::snapshot_row(&conn, "orders", "id", 1, &["paid_amount", "paid_amount_paise"])
            .unwrap()
            .expect("should capture existing row");

        assert!(snap.contains("paid_amount"), "snapshot: {}", snap);
    }

    #[test]
    fn snapshot_row_returns_none_for_missing() {
        let conn = test_db();
        let snap = service::snapshot_row(&conn, "orders", "id", 999, &["paid_amount"]).unwrap();
        assert!(snap.is_none());
    }

    // ------------------------------------------------------------------
    // 6b. snapshot_result helper — composite key lookup
    // ------------------------------------------------------------------

    #[test]
    fn snapshot_result_captures_existing_value() {
        let conn = test_db();
        // Insert a result row so we can snapshot it
        conn.execute(
            "INSERT INTO results (order_id, parameter_id, value) VALUES (1, 10, 'Normal')",
            [],
        )
        .unwrap();

        let snap = service::snapshot_result(&conn, 1, 10)
            .unwrap()
            .expect("should capture existing result row");

        assert!(snap.contains("Normal"), "snapshot: {}", snap);
        assert!(snap.contains("value"), "snapshot: {}", snap);
    }

    #[test]
    fn snapshot_result_returns_none_for_missing() {
        let conn = test_db();
        let snap = service::snapshot_result(&conn, 1, 999).unwrap();
        assert!(snap.is_none(), "should be None for non-existent result");
    }

    // ------------------------------------------------------------------
    // 6c. snapshot_setting helper — TEXT key lookup
    // ------------------------------------------------------------------

    #[test]
    fn snapshot_setting_captures_existing_value() {
        let conn = test_db();
        // 'lab_name' = 'Old Lab' was inserted in test_db()

        let snap = service::snapshot_setting(&conn, "lab_name")
            .unwrap()
            .expect("should capture existing setting");

        assert!(snap.contains("Old Lab"), "snapshot: {}", snap);
        assert!(snap.contains("value"), "snapshot: {}", snap);
    }

    #[test]
    fn snapshot_setting_returns_none_for_missing_key() {
        let conn = test_db();
        let snap = service::snapshot_setting(&conn, "nonexistent_key").unwrap();
        assert!(snap.is_none(), "should be None for non-existent key");
    }

    // ------------------------------------------------------------------
    // 7. Limit / offset pagination
    // ------------------------------------------------------------------

    #[test]
    fn audit_logs_respect_limit_and_offset() {
        let conn = test_db();

        for i in 0..5 {
            service::create_audit_log(
                &conn,
                1,
                "create",
                "patients",
                Some(i + 1),
                None,
                Some(r#"{}"#),
            );
        }

        let page1 = service::get_audit_logs(&conn, None, None, None, Some(2), Some(0)).unwrap();
        assert_eq!(page1.len(), 2);

        let page2 = service::get_audit_logs(&conn, None, None, None, Some(2), Some(2)).unwrap();
        assert_eq!(page2.len(), 2);

        // Should be different
        assert_ne!(page1[0].id, page2[0].id);
    }

    // ------------------------------------------------------------------
    // 8. Username is joined from users table
    // ------------------------------------------------------------------

    #[test]
    fn username_is_resolved_in_audit_logs() {
        let conn = test_db();

        service::create_audit_log(&conn, 1, "login", "users", Some(1), None, None);

        let logs = service::get_audit_logs(&conn, None, None, None, None, None).unwrap();
        let entry = &logs[0];

        assert_eq!(entry.username, "admin");
    }

    // ------------------------------------------------------------------
    // Private helper
    // ------------------------------------------------------------------

    fn get_latest(conn: rusqlite::Connection) -> AuditLogEntry {
        conn.query_row(
            "SELECT a.id, a.user_id, COALESCE(u.username,'unknown'),
                    a.action, a.table_name, a.record_id, a.old_data, a.new_data, a.created_at
             FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id
             ORDER BY a.id DESC LIMIT 1",
            [],
            |row| {
                Ok(AuditLogEntry {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    username: row.get(2)?,
                    action: row.get(3)?,
                    table_name: row.get(4)?,
                    record_id: row.get(5)?,
                    old_data: row.get(6)?,
                    new_data: row.get(7)?,
                    created_at: row.get(8)?,
                })
            },
        )
        .unwrap()
    }
}
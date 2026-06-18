/// Catalog module integration tests.
#[cfg(test)]
mod tests {
    use crate::modules::catalog::service::{
        add_test, add_test_parameter, delete_test, delete_test_parameter, get_test_parameters,
        get_tests, update_test, update_test_parameter,
    };
    use rusqlite::Connection;

    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE tests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                price REAL NOT NULL DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                updated_at TEXT
            );
            CREATE TABLE test_parameters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                unit TEXT,
                normal_range TEXT,
                is_active INTEGER DEFAULT 1,
                updated_at TEXT,
                UNIQUE(test_id, name),
                FOREIGN KEY (test_id) REFERENCES tests(id)
            );
            CREATE TABLE patients (
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
            CREATE TABLE orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                total_amount_paise INTEGER DEFAULT 0,
                discount_amount_paise INTEGER DEFAULT 0,
                paid_amount_paise INTEGER DEFAULT 0,
                invoice_no TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id)
            );
            CREATE TABLE order_tests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                test_id INTEGER NOT NULL,
                test_name_snapshot TEXT,
                price_paise INTEGER DEFAULT 0,
                UNIQUE(order_id, test_id),
                FOREIGN KEY (order_id) REFERENCES orders(id),
                FOREIGN KEY (test_id) REFERENCES tests(id)
            );

            INSERT INTO tests (id, name, price) VALUES (1, 'CBC', 500.00);
            INSERT INTO tests (id, name, price) VALUES (2, 'Lipid Profile', 800.00);
            INSERT INTO test_parameters (id, test_id, name, unit, normal_range)
            VALUES (10, 1, 'Hemoglobin', 'g/dL', '12-16');
            INSERT INTO test_parameters (id, test_id, name, unit, normal_range)
            VALUES (11, 1, 'WBC', '/uL', '4000-11000');
        ",
        )
        .unwrap();
        conn
    }

    // ── get_tests ──

    #[test]
    fn get_tests_returns_active_tests_with_parameters() {
        let conn = test_db();
        let tests = get_tests(&conn).unwrap();
        assert_eq!(tests.len(), 2);
        let cbc = tests.iter().find(|t| t.id == 1).unwrap();
        assert_eq!(cbc.name, "CBC");
        assert_eq!(cbc.parameters.len(), 2);
    }

    #[test]
    fn get_tests_hides_inactive() {
        let conn = test_db();
        conn.execute("UPDATE tests SET is_active = 0 WHERE id = 1", [])
            .unwrap();
        let tests = get_tests(&conn).unwrap();
        assert_eq!(tests.len(), 1);
        assert_eq!(tests[0].id, 2);
    }

    #[test]
    fn get_tests_empty_catalog() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE tests (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, price REAL NOT NULL DEFAULT 0, is_active INTEGER DEFAULT 1, updated_at TEXT);
             CREATE TABLE test_parameters (id INTEGER PRIMARY KEY AUTOINCREMENT, test_id INTEGER NOT NULL, name TEXT NOT NULL, unit TEXT, normal_range TEXT, is_active INTEGER DEFAULT 1, updated_at TEXT, UNIQUE(test_id, name), FOREIGN KEY (test_id) REFERENCES tests(id));",
        )
        .unwrap();
        let tests = get_tests(&conn).unwrap();
        assert!(tests.is_empty());
    }

    // ── get_test_parameters ──

    #[test]
    fn get_test_parameters_returns_for_valid_test() {
        let conn = test_db();
        let params = get_test_parameters(&conn, 1).unwrap();
        assert_eq!(params.len(), 2);
        assert_eq!(params[0].name, "Hemoglobin");
    }

    #[test]
    fn get_test_parameters_non_existent_test_returns_empty() {
        let conn = test_db();
        let params = get_test_parameters(&conn, 999).unwrap();
        assert!(params.is_empty());
    }

    // ── add_test ──

    #[test]
    fn add_test_creates_new_test() {
        let conn = test_db();
        let new_id = add_test(&conn, "Blood Sugar".into(), 300.00).unwrap();
        assert!(new_id > 0);
        let tests = get_tests(&conn).unwrap();
        assert!(tests.iter().any(|t| t.name == "Blood Sugar"));
    }

    #[test]
    fn add_test_rejects_empty_name() {
        let conn = test_db();
        let result = add_test(&conn, "".into(), 300.00);
        assert!(result.is_err());
    }

    #[test]
    fn add_test_rejects_negative_price() {
        let conn = test_db();
        let result = add_test(&conn, "Blood Sugar".into(), -100.00);
        assert!(result.is_err());
    }

    #[test]
    fn add_test_duplicate_name_upserts() {
        let conn = test_db();
        // add_test uses ON CONFLICT(name) DO UPDATE — duplicates update price, not error
        let id = add_test(&conn, "CBC".into(), 600.00).unwrap();
        assert_eq!(id, 1);
        let tests = get_tests(&conn).unwrap();
        let cbc = tests.iter().find(|t| t.id == 1).unwrap();
        assert_eq!(cbc.price, 600.00);
    }

    // ── update_test ──

    #[test]
    fn update_test_changes_name_and_price() {
        let conn = test_db();
        update_test(&conn, 1, "CBC Updated".into(), 600.00).unwrap();
        let tests = get_tests(&conn).unwrap();
        let updated = tests.iter().find(|t| t.id == 1).unwrap();
        assert_eq!(updated.name, "CBC Updated");
        assert_eq!(updated.price, 600.00);
    }

    #[test]
    fn update_test_rejects_non_existent() {
        let conn = test_db();
        let result = update_test(&conn, 999, "Ghost".into(), 100.00);
        assert!(result.is_err());
    }

    #[test]
    fn update_test_rejects_duplicate_name() {
        let conn = test_db();
        let result = update_test(&conn, 1, "Lipid Profile".into(), 600.00);
        assert!(result.is_err());
    }

    // ── delete_test ──

    #[test]
    fn delete_test_soft_deletes() {
        let conn = test_db();
        delete_test(&conn, 1).unwrap();
        let tests = get_tests(&conn).unwrap();
        assert!(!tests.iter().any(|t| t.id == 1));
    }

    #[test]
    fn delete_test_rejects_non_existent() {
        let conn = test_db();
        let result = delete_test(&conn, 999);
        assert!(result.is_err());
    }

    #[test]
    fn delete_test_soft_deletes_even_with_orders() {
        let conn = test_db();
        // delete_test is a soft delete — it doesn't check for referencing orders
        conn.execute_batch(
            "INSERT INTO patients (id, patient_code, name) VALUES (1, 'P001', 'Test');
             INSERT INTO orders (id, patient_id, total_amount_paise) VALUES (1, 1, 50000);
             INSERT INTO order_tests (order_id, test_id, test_name_snapshot, price_paise) VALUES (1, 1, 'CBC', 50000);",
        )
        .unwrap();
        delete_test(&conn, 1).unwrap();
        let tests = get_tests(&conn).unwrap();
        assert!(!tests.iter().any(|t| t.id == 1));
    }

    // ── add_test_parameter ──

    #[test]
    fn add_test_parameter_creates_new() {
        let conn = test_db();
        let new_id =
            add_test_parameter(&conn, 1, "Platelets".into(), "cells/uL".into(), "150-450".into())
                .unwrap();
        assert!(new_id > 0);
        let params = get_test_parameters(&conn, 1).unwrap();
        assert_eq!(params.len(), 3);
    }

    #[test]
    fn add_test_parameter_rejects_empty_name() {
        let conn = test_db();
        let result = add_test_parameter(&conn, 1, "".into(), "unit".into(), "range".into());
        assert!(result.is_err());
    }

    #[test]
    fn add_test_parameter_rejects_non_existent_test() {
        let conn = test_db();
        let result =
            add_test_parameter(&conn, 999, "Param".into(), "unit".into(), "range".into());
        assert!(result.is_err());
    }

    // ── update_test_parameter ──

    #[test]
    fn update_test_parameter_changes_fields() {
        let conn = test_db();
        update_test_parameter(
            &conn,
            10,
            "Hb Updated".into(),
            "g/L".into(),
            "120-160".into(),
        )
        .unwrap();
        let params = get_test_parameters(&conn, 1).unwrap();
        let updated = params.iter().find(|p| p.id == 10).unwrap();
        assert_eq!(updated.name, "Hb Updated");
        assert_eq!(updated.unit, "g/L");
        assert_eq!(updated.normal_range, "120-160");
    }

    #[test]
    fn update_test_parameter_rejects_non_existent() {
        let conn = test_db();
        let result = update_test_parameter(&conn, 999, "Ghost".into(), "u".into(), "r".into());
        assert!(result.is_err());
    }

    // ── delete_test_parameter ──

    #[test]
    fn delete_test_parameter_removes() {
        let conn = test_db();
        delete_test_parameter(&conn, 11).unwrap();
        let params = get_test_parameters(&conn, 1).unwrap();
        assert_eq!(params.len(), 1);
        assert_eq!(params[0].id, 10);
    }

    #[test]
    fn delete_test_parameter_rejects_non_existent() {
        let conn = test_db();
        let result = delete_test_parameter(&conn, 999);
        assert!(result.is_err());
    }
}
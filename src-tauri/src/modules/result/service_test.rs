/// Result module integration tests.
#[cfg(test)]
mod tests {
    use crate::errors::AppError;
    use crate::modules::result::model::ResultInput;
    use crate::modules::result::service::{
        get_parameters_by_order, get_results_by_order, save_result, save_results,
    };
    use rusqlite::Connection;

    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "
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
            CREATE TABLE order_parameters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                parameter_id INTEGER NOT NULL,
                parameter_name_snapshot TEXT,
                unit_snapshot TEXT,
                normal_range_snapshot TEXT,
                UNIQUE(order_id, parameter_id),
                FOREIGN KEY (order_id) REFERENCES orders(id),
                FOREIGN KEY (parameter_id) REFERENCES test_parameters(id)
            );
            CREATE TABLE results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                parameter_id INTEGER NOT NULL,
                value TEXT NOT NULL,
                UNIQUE(order_id, parameter_id),
                FOREIGN KEY (order_id) REFERENCES orders(id),
                FOREIGN KEY (parameter_id) REFERENCES test_parameters(id)
            );

            INSERT INTO patients (id, patient_code, name) VALUES (1, 'P001', 'Test Patient');
            INSERT INTO tests (id, name, price) VALUES (10, 'CBC', 500.00);
            INSERT INTO test_parameters (id, test_id, name, unit, normal_range)
            VALUES (100, 10, 'Hemoglobin', 'g/dL', '12-16');
            INSERT INTO test_parameters (id, test_id, name, unit, normal_range)
            VALUES (101, 10, 'WBC', '/uL', '4000-11000');
            INSERT INTO orders (id, patient_id, total_amount_paise, invoice_no) VALUES (200, 1, 50000, 'INV-200');
            INSERT INTO order_tests (order_id, test_id, test_name_snapshot, price_paise)
            VALUES (200, 10, 'CBC', 50000);
            INSERT INTO order_parameters (order_id, parameter_id, parameter_name_snapshot, unit_snapshot, normal_range_snapshot)
            VALUES (200, 100, 'Hemoglobin', 'g/dL', '12-16');
            INSERT INTO order_parameters (order_id, parameter_id, parameter_name_snapshot, unit_snapshot, normal_range_snapshot)
            VALUES (200, 101, 'WBC', '/uL', '4000-11000');
            INSERT INTO results (order_id, parameter_id, value) VALUES (200, 100, '14.2');
        ",
        )
        .unwrap();
        conn
    }

    // ── save_result ──

    #[test]
    fn save_result_inserts_new_value() {
        let mut conn = test_db();
        let result = save_result(&mut conn, 200, 101, "7500".into());
        assert!(result.is_ok());
    }

    #[test]
    fn save_result_updates_existing_value() {
        let mut conn = test_db();
        let result = save_result(&mut conn, 200, 100, "15.0".into());
        assert!(result.is_ok());
    }

    #[test]
    fn save_result_rejects_non_existent_order() {
        let mut conn = test_db();
        let result = save_result(&mut conn, 999, 100, "14.2".into());
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::NotFound(msg) => assert!(msg.contains("not found")),
            _ => panic!("expected NotFound error"),
        }
    }

    #[test]
    fn save_result_rejects_parameter_not_in_order() {
        let mut conn = test_db();
        conn.execute(
            "INSERT INTO test_parameters (id, test_id, name) VALUES (999, 10, 'Unknown')",
            [],
        )
        .unwrap();
        let result = save_result(&mut conn, 200, 999, "value".into());
        assert!(result.is_err());
    }

    // ── save_results ──

    #[test]
    fn save_results_inserts_multiple() {
        let mut conn = test_db();
        let inputs = vec![
            ResultInput {
                parameter_id: 100,
                value: "15.0".to_string(),
            },
            ResultInput {
                parameter_id: 101,
                value: "8000".to_string(),
            },
        ];
        let count = save_results(&mut conn, 200, inputs).unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn save_results_rejects_non_existent_order() {
        let mut conn = test_db();
        let inputs = vec![ResultInput {
            parameter_id: 100,
            value: "15.0".to_string(),
        }];
        let result = save_results(&mut conn, 999, inputs);
        assert!(result.is_err());
    }

    #[test]
    fn save_results_with_empty_list_returns_error() {
        let mut conn = test_db();
        let result = save_results(&mut conn, 200, vec![]);
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::ValidationError(msg) => assert!(msg.contains("At least one")),
            _ => panic!("expected ValidationError"),
        }
    }

    #[test]
    fn save_results_rejects_parameter_not_in_order() {
        let mut conn = test_db();
        conn.execute(
            "INSERT INTO test_parameters (id, test_id, name) VALUES (999, 10, 'Unknown')",
            [],
        )
        .unwrap();
        let inputs = vec![ResultInput {
            parameter_id: 999,
            value: "value".to_string(),
        }];
        let result = save_results(&mut conn, 200, inputs);
        assert!(result.is_err());
    }

    // ── get_parameters_by_order ──

    #[test]
    fn get_parameters_returns_linked_params() {
        let conn = test_db();
        let params = get_parameters_by_order(&conn, 200).unwrap();
        assert_eq!(params.len(), 2);
        let ids: Vec<i32> = params.iter().map(|p| p.id).collect();
        assert!(ids.contains(&100));
        assert!(ids.contains(&101));
    }

    #[test]
    fn get_parameters_includes_existing_result_values() {
        let conn = test_db();
        let params = get_parameters_by_order(&conn, 200).unwrap();
        let hb = params.iter().find(|p| p.id == 100).unwrap();
        assert_eq!(hb.value, "14.2");
        assert!(hb.is_entered);
        let wbc = params.iter().find(|p| p.id == 101).unwrap();
        assert_eq!(wbc.value, "");
        assert!(!wbc.is_entered);
    }

    #[test]
    fn get_parameters_non_existent_order_returns_error() {
        let conn = test_db();
        let result = get_parameters_by_order(&conn, 999);
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::NotFound(msg) => assert!(msg.contains("not found")),
            _ => panic!("expected NotFound error"),
        }
    }

    // ── get_results_by_order ──

    #[test]
    fn get_results_returns_existing_results() {
        let conn = test_db();
        let results = get_results_by_order(&conn, 200).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].0, 100);
        assert_eq!(results[0].1, "14.2");
    }

    #[test]
    fn get_results_non_existent_order_returns_error() {
        let conn = test_db();
        let result = get_results_by_order(&conn, 999);
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::NotFound(msg) => assert!(msg.contains("not found")),
            _ => panic!("expected NotFound error"),
        }
    }
}
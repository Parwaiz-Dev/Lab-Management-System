/// Order service integration tests.
///
/// These tests verify:
/// 1. Creating orders with valid data, edge cases, and error conditions
/// 2. Retrieving orders in various ways (all, by date range, by status)
/// 3. Doctor revenue aggregation
/// 4. Cancelling orders (valid and invalid states)
/// 5. Updating orders
/// 6. Business logic validations (total mismatch, discount > subtotal, etc.)
#[cfg(test)]
mod tests {
    use crate::modules::order::service;

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

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
            CREATE TABLE IF NOT EXISTS tests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                price REAL NOT NULL DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS test_parameters (
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
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                total_amount_paise INTEGER DEFAULT 0,
                discount_amount_paise INTEGER DEFAULT 0,
                paid_amount_paise INTEGER DEFAULT 0,
                invoice_no TEXT,
                status TEXT DEFAULT 'Pending',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id)
            );
            CREATE TABLE IF NOT EXISTS order_tests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                test_id INTEGER NOT NULL,
                test_name_snapshot TEXT,
                price_paise INTEGER DEFAULT 0,
                UNIQUE(order_id, test_id),
                FOREIGN KEY (order_id) REFERENCES orders(id),
                FOREIGN KEY (test_id) REFERENCES tests(id)
            );
            CREATE TABLE IF NOT EXISTS order_parameters (
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
            CREATE TABLE IF NOT EXISTS results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                parameter_id INTEGER NOT NULL,
                value TEXT NOT NULL,
                UNIQUE(order_id, parameter_id),
                FOREIGN KEY (order_id) REFERENCES orders(id),
                FOREIGN KEY (parameter_id) REFERENCES test_parameters(id)
            );
            ",
        )
        .unwrap();

        // Seed data
        conn.execute("INSERT INTO patients (id, patient_code, name, referred_by) VALUES (1, 'P001', 'John Doe', 'Dr. Smith')", []).unwrap();
        conn.execute("INSERT INTO patients (id, patient_code, name, referred_by) VALUES (2, 'P002', 'Jane Doe', 'Dr. Smith')", []).unwrap();
        conn.execute("INSERT INTO tests (id, name, price) VALUES (1, 'CBC', 500.00)", []).unwrap();
        conn.execute("INSERT INTO tests (id, name, price) VALUES (2, 'Lipid Profile', 800.00)", []).unwrap();
        conn.execute("INSERT INTO tests (id, name, price, is_active) VALUES (3, 'Inactive Test', 300.00, 0)", []).unwrap();
        conn.execute("INSERT INTO test_parameters (id, test_id, name, unit, normal_range) VALUES (1, 1, 'Hemoglobin', 'g/dL', '13-17')", []).unwrap();
        conn.execute("INSERT INTO test_parameters (id, test_id, name, unit, normal_range) VALUES (2, 1, 'WBC', 'K/uL', '4-11')", []).unwrap();
        conn.execute("INSERT INTO test_parameters (id, test_id, name, unit, normal_range) VALUES (3, 2, 'Total Cholesterol', 'mg/dL', '<200')", []).unwrap();

        // Pre-create one completed order with results for get_orders / cancel tests
        conn.execute("INSERT INTO orders (id, patient_id, total_amount_paise, discount_amount_paise, paid_amount_paise, invoice_no, status) VALUES (100, 1, 50000, 0, 50000, 'INV-100', 'Completed')", []).unwrap();
        conn.execute("INSERT INTO order_tests (order_id, test_id, test_name_snapshot, price_paise) VALUES (100, 1, 'CBC', 50000)", []).unwrap();
        conn.execute("INSERT INTO order_parameters (order_id, parameter_id, parameter_name_snapshot, unit_snapshot, normal_range_snapshot) VALUES (100, 1, 'Hemoglobin', 'g/dL', '13-17')", []).unwrap();
        conn.execute("INSERT INTO order_parameters (order_id, parameter_id, parameter_name_snapshot, unit_snapshot, normal_range_snapshot) VALUES (100, 2, 'WBC', 'K/uL', '4-11')", []).unwrap();
        conn.execute("INSERT INTO results (order_id, parameter_id, value) VALUES (100, 1, '15.0')", []).unwrap();
        conn.execute("INSERT INTO results (order_id, parameter_id, value) VALUES (100, 2, '7.5')", []).unwrap();

        conn
    }

    // ------------------------------------------------------------------
    // 1. create_order — happy path (auto-select all parameters)
    // ------------------------------------------------------------------

    #[test]
    fn create_order_with_auto_parameters() {
        let mut conn = test_db();

        let order_id = service::create_order(
            &mut conn,
            1,          // patient_id
            vec![1],    // test_ids (CBC)
            vec![],     // parameter_ids empty = auto-select all
            500.00,     // total_amount (matches 1×CBC at ₹500)
            0.00,       // discount
        )
        .unwrap();

        assert!(order_id > 0);

        // Verify order was created
        let total: i64 = conn
            .query_row("SELECT total_amount_paise FROM orders WHERE id = ?1", [order_id], |row| row.get(0))
            .unwrap();
        assert_eq!(total, 50000); // 500.00 × 100 = 50000 paise

        // Verify order_tests
        let test_count: i32 = conn
            .query_row("SELECT COUNT(*) FROM order_tests WHERE order_id = ?1", [order_id], |row| row.get(0))
            .unwrap();
        assert_eq!(test_count, 1);

        // Verify order_parameters were auto-selected (2 params for CBC)
        let param_count: i32 = conn
            .query_row("SELECT COUNT(*) FROM order_parameters WHERE order_id = ?1", [order_id], |row| row.get(0))
            .unwrap();
        assert_eq!(param_count, 2);

        // Verify invoice number
        let invoice: String = conn
            .query_row("SELECT invoice_no FROM orders WHERE id = ?1", [order_id], |row| row.get(0))
            .unwrap();
        assert!(invoice.contains("INV-"));
    }

    // ------------------------------------------------------------------
    // 2. create_order — with explicit parameter selection
    // ------------------------------------------------------------------

    #[test]
    fn create_order_with_explicit_parameters() {
        let mut conn = test_db();

        let order_id = service::create_order(
            &mut conn,
            1,
            vec![1],    // CBC
            vec![1],    // only Hemoglobin, skip WBC
            500.00,
            0.00,
        )
        .unwrap();

        let param_count: i32 = conn
            .query_row("SELECT COUNT(*) FROM order_parameters WHERE order_id = ?1", [order_id], |row| row.get(0))
            .unwrap();
        assert_eq!(param_count, 1);
    }

    // ------------------------------------------------------------------
    // 3. create_order — multiple tests
    // ------------------------------------------------------------------

    #[test]
    fn create_order_with_multiple_tests() {
        let mut conn = test_db();

        let order_id = service::create_order(
            &mut conn,
            1,
            vec![1, 2], // CBC + Lipid Profile
            vec![],     // auto-select all
            1300.00,    // 500 + 800
            0.00,
        )
        .unwrap();

        let test_count: i32 = conn
            .query_row("SELECT COUNT(*) FROM order_tests WHERE order_id = ?1", [order_id], |row| row.get(0))
            .unwrap();
        assert_eq!(test_count, 2);

        let param_count: i32 = conn
            .query_row("SELECT COUNT(*) FROM order_parameters WHERE order_id = ?1", [order_id], |row| row.get(0))
            .unwrap();
        assert_eq!(param_count, 3); // 2 CBC + 1 Lipid
    }

    // ------------------------------------------------------------------
    // 4. create_order — with discount
    // ------------------------------------------------------------------

    #[test]
    fn create_order_with_discount() {
        let mut conn = test_db();

        let order_id = service::create_order(
            &mut conn,
            1,
            vec![1],
            vec![],
            400.00,     // total after ₹100 discount
            100.00,     // discount amount
        )
        .unwrap();

        let (total, discount): (i64, i64) = conn
            .query_row(
                "SELECT total_amount_paise, discount_amount_paise FROM orders WHERE id = ?1",
                [order_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(total, 40000);
        assert_eq!(discount, 10000);
    }

    // ------------------------------------------------------------------
    // 5. create_order — patient not found
    // ------------------------------------------------------------------

    #[test]
    fn create_order_nonexistent_patient() {
        let mut conn = test_db();
        let err = service::create_order(&mut conn, 999, vec![1], vec![], 500.00, 0.00).unwrap_err();
        assert!(err.to_string().contains("not found"));
    }

    // ------------------------------------------------------------------
    // 6. create_order — inactive test rejected
    // ------------------------------------------------------------------

    #[test]
    fn create_order_with_inactive_test() {
        let mut conn = test_db();
        let err = service::create_order(&mut conn, 1, vec![3], vec![], 300.00, 0.00).unwrap_err();
        assert!(err.to_string().contains("not found") || err.to_string().contains("inactive"));
    }

    // ------------------------------------------------------------------
    // 7. create_order — total mismatch
    // ------------------------------------------------------------------

    #[test]
    fn create_order_total_mismatch() {
        let mut conn = test_db();
        let err = service::create_order(&mut conn, 1, vec![1], vec![], 999.99, 0.00).unwrap_err();
        assert!(err.to_string().contains("mismatch"));
    }

    // ------------------------------------------------------------------
    // 8. create_order — discount exceeds subtotal
    // ------------------------------------------------------------------

    #[test]
    fn create_order_discount_exceeds_subtotal() {
        let mut conn = test_db();
        let err = service::create_order(&mut conn, 1, vec![1], vec![], 0.00, 600.00).unwrap_err();
        assert!(err.to_string().contains("Discount cannot exceed"));
    }

    // ------------------------------------------------------------------
    // 9. create_order — empty test_ids
    // ------------------------------------------------------------------

    #[test]
    fn create_order_with_empty_tests() {
        let mut conn = test_db();
        let err = service::create_order(&mut conn, 1, vec![], vec![], 0.00, 0.00).unwrap_err();
        assert!(err.to_string().contains("At least one sub test") || err.to_string().contains("test"));
    }

    // ------------------------------------------------------------------
    // 10. get_orders — returns all orders with correct payment status
    // ------------------------------------------------------------------

    #[test]
    fn get_orders_returns_all() {
        let conn = test_db();
        let orders = service::get_orders(&conn).unwrap();
        assert!(!orders.is_empty());
    }

    // ------------------------------------------------------------------
    // 11. get_order_status
    // ------------------------------------------------------------------

    #[test]
    fn get_order_status_for_completed_order() {
        let conn = test_db();
        let status = service::get_order_status(&conn, 100).unwrap();
        assert_eq!(status, "Completed"); // both params have results
    }

    #[test]
    fn get_order_status_for_nonexistent_order() {
        let conn = test_db();
        // Non-existent order returns "Pending" since both counts are 0
        let status = service::get_order_status(&conn, 999).unwrap();
        assert_eq!(status, "Pending");
    }

    // ------------------------------------------------------------------
    // 12. get_orders_by_date_range
    // ------------------------------------------------------------------

    #[test]
    fn get_orders_by_date_range() {
        let conn = test_db();
        // Broad date range should include our seed order
        let orders = service::get_orders_by_date_range(&conn, "2000-01-01", "2099-12-31").unwrap();
        assert!(!orders.is_empty());
    }

    // ------------------------------------------------------------------
    // 13. get_doctor_revenue
    // ------------------------------------------------------------------

    #[test]
    fn get_doctor_revenue_aggregates() {
        let conn = test_db();
        let revenue = service::get_doctor_revenue(&conn, "2000-01-01", "2099-12-31").unwrap();
        assert!(!revenue.is_empty());

        // Both patients referred by Dr. Smith
        let dr_smith = revenue.iter().find(|r| r.doctor_name == "Dr. Smith").unwrap();
        assert!(dr_smith.order_count >= 1);
        assert!(dr_smith.total_amount > 0.0);
    }

    // ------------------------------------------------------------------
    // 14. cancel_order — happy path
    // ------------------------------------------------------------------

    #[test]
    fn cancel_order_success() {
        let mut conn = test_db();
        // Order 100 is "Completed" — can't cancel
        // Create a fresh pending order
        conn.execute("INSERT INTO orders (id, patient_id, total_amount_paise, paid_amount_paise, status, invoice_no) VALUES (200, 1, 50000, 0, 'Pending', 'INV-200')", []).unwrap();
        conn.execute("INSERT INTO order_tests (order_id, test_id, test_name_snapshot, price_paise) VALUES (200, 1, 'CBC', 50000)", []).unwrap();
        conn.execute("INSERT INTO order_parameters (order_id, parameter_id, parameter_name_snapshot) VALUES (200, 1, 'Hemoglobin')", []).unwrap();

        service::cancel_order(&mut conn, 200).unwrap();

        let status: String = conn
            .query_row("SELECT status FROM orders WHERE id = ?1", [200], |row| row.get(0))
            .unwrap();
        assert_eq!(status, "Cancelled");
    }

    // ------------------------------------------------------------------
    // 15. cancel_order — already cancelled
    // ------------------------------------------------------------------

    #[test]
    fn cancel_order_already_cancelled() {
        let mut conn = test_db();
        conn.execute("INSERT INTO orders (id, patient_id, total_amount_paise, status, invoice_no) VALUES (300, 1, 50000, 'Cancelled', 'INV-300')", []).unwrap();
        conn.execute("INSERT INTO order_tests (order_id, test_id, test_name_snapshot, price_paise) VALUES (300, 1, 'CBC', 50000)", []).unwrap();
        conn.execute("INSERT INTO order_parameters (order_id, parameter_id, parameter_name_snapshot) VALUES (300, 1, 'Hemoglobin')", []).unwrap();

        let err = service::cancel_order(&mut conn, 300).unwrap_err();
        assert!(err.to_string().contains("already cancelled"));
    }

    // ------------------------------------------------------------------
    // 16. cancel_order — cannot cancel completed
    // ------------------------------------------------------------------

    #[test]
    fn cancel_order_completed_rejected() {
        let mut conn = test_db();
        // Order 100 is seeded with status='Completed'
        let err = service::cancel_order(&mut conn, 100).unwrap_err();
        assert!(err.to_string().contains("Cannot cancel a completed"));
    }

    // ------------------------------------------------------------------
    // 17. update_order_status — valid transitions
    // ------------------------------------------------------------------

    #[test]
    fn update_order_status_success() {
        let mut conn = test_db();
        // Create a pending order
        conn.execute("INSERT INTO orders (id, patient_id, total_amount_paise, status, invoice_no) VALUES (400, 1, 50000, 'Pending', 'INV-400')", []).unwrap();
        conn.execute("INSERT INTO order_tests (order_id, test_id, test_name_snapshot, price_paise) VALUES (400, 1, 'CBC', 50000)", []).unwrap();
        conn.execute("INSERT INTO order_parameters (order_id, parameter_id, parameter_name_snapshot) VALUES (400, 1, 'Hemoglobin')", []).unwrap();

        service::update_order_status(&mut conn, 400, "In Progress").unwrap();

        let status: String = conn
            .query_row("SELECT status FROM orders WHERE id = ?1", [400], |row| row.get(0))
            .unwrap();
        assert_eq!(status, "In Progress");
    }

    // ------------------------------------------------------------------
    // 18. update_order_status — invalid status string
    // ------------------------------------------------------------------

    #[test]
    fn update_order_status_invalid_status() {
        let mut conn = test_db();
        let err = service::update_order_status(&mut conn, 100, "BogusStatus").unwrap_err();
        assert!(err.to_string().contains("Invalid status"));
    }

    // ------------------------------------------------------------------
    // 19. update_order_status — cancelled order rejected
    // ------------------------------------------------------------------

    #[test]
    fn update_order_status_cancelled_rejected() {
        let mut conn = test_db();
        conn.execute("INSERT INTO orders (id, patient_id, total_amount_paise, status, invoice_no) VALUES (500, 1, 50000, 'Cancelled', 'INV-500')", []).unwrap();
        conn.execute("INSERT INTO order_tests (order_id, test_id, test_name_snapshot, price_paise) VALUES (500, 1, 'CBC', 50000)", []).unwrap();
        conn.execute("INSERT INTO order_parameters (order_id, parameter_id, parameter_name_snapshot) VALUES (500, 1, 'Hemoglobin')", []).unwrap();

        let err = service::update_order_status(&mut conn, 500, "Completed").unwrap_err();
        assert!(err.to_string().contains("cancelled"));
    }

    // ------------------------------------------------------------------
    // 20. update_order — modifies existing order
    // ------------------------------------------------------------------

    #[test]
    fn update_order_changes_tests() {
        let mut conn = test_db();
        // Create a pending order with CBC
        conn.execute("INSERT INTO orders (id, patient_id, total_amount_paise, paid_amount_paise, status, invoice_no) VALUES (600, 1, 50000, 0, 'Pending', 'INV-600')", []).unwrap();
        conn.execute("INSERT INTO order_tests (order_id, test_id, test_name_snapshot, price_paise) VALUES (600, 1, 'CBC', 50000)", []).unwrap();
        conn.execute("INSERT INTO order_parameters (order_id, parameter_id, parameter_name_snapshot) VALUES (600, 1, 'Hemoglobin')", []).unwrap();

        // Update to Lipid Profile instead
        service::update_order(&mut conn, 600, vec![2], vec![], 800.00, 0.00).unwrap();

        let test_count: i32 = conn
            .query_row("SELECT COUNT(*) FROM order_tests WHERE order_id = ?1", [600], |row| row.get(0))
            .unwrap();
        assert_eq!(test_count, 1);

        let test_name: String = conn
            .query_row("SELECT test_name_snapshot FROM order_tests WHERE order_id = ?1", [600], |row| row.get(0))
            .unwrap();
        assert_eq!(test_name, "Lipid Profile");
    }

    // ------------------------------------------------------------------
    // 21. update_order — cannot edit cancelled
    // ------------------------------------------------------------------

    #[test]
    fn update_order_cancelled_rejected() {
        let mut conn = test_db();
        conn.execute("INSERT INTO orders (id, patient_id, total_amount_paise, status, invoice_no) VALUES (700, 1, 50000, 'Cancelled', 'INV-700')", []).unwrap();
        conn.execute("INSERT INTO order_tests (order_id, test_id, test_name_snapshot, price_paise) VALUES (700, 1, 'CBC', 50000)", []).unwrap();
        conn.execute("INSERT INTO order_parameters (order_id, parameter_id, parameter_name_snapshot) VALUES (700, 1, 'Hemoglobin')", []).unwrap();

        let err = service::update_order(&mut conn, 700, vec![2], vec![], 800.00, 0.00).unwrap_err();
        assert!(err.to_string().contains("cancelled"));
    }
}
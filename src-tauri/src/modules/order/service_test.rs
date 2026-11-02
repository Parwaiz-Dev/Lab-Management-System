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
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
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
                order_number TEXT,
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
            CREATE TABLE IF NOT EXISTS doctors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            ",
        )
        .unwrap();

        crate::db::migrations::run_migrations(&mut conn).unwrap();

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

    #[test]
    fn get_doctor_revenue_includes_registered_doctors_and_calculates_share() {
        let conn = test_db();
        // Insert a new registered doctor with 0 orders
        conn.execute("INSERT INTO doctors (name) VALUES ('Dr. NewRegistered')", []).unwrap();
        // Set doctor share to 25% (0.25)
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('doctor_share', '0.25')", []).unwrap();

        let revenue = service::get_doctor_revenue(&conn, "2000-01-01", "2099-12-31").unwrap();
        
        // 1. Verify newly registered doctor appears even with 0 orders
        let new_doc = revenue.iter().find(|r| r.doctor_name == "Dr. NewRegistered");
        assert!(new_doc.is_some(), "Registered doctor must appear even with 0 orders");
        let new_doc = new_doc.unwrap();
        assert_eq!(new_doc.order_count, 0);
        assert_eq!(new_doc.total_amount, 0.0);
        assert_eq!(new_doc.share_amount, 0.0);
        assert_eq!(new_doc.share_percentage, 25.0);

        // Legacy orders have no saved rate and are not retroactively assigned one.
        let dr_smith = revenue.iter().find(|r| r.doctor_name == "Dr. Smith").unwrap();
        assert_eq!(dr_smith.share_percentage, 25.0);
        assert_eq!(dr_smith.share_amount, 0.0);
        assert!(dr_smith.legacy_order_count > 0);
    }

    #[test]
    fn create_order_snapshots_discounted_commission_basis_and_rate() {
        let mut conn = test_db();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('doctor_share', '0.25')",
            [],
        ).unwrap();

        let order_id = service::create_order(&mut conn, 1, vec![1], vec![], 400.0, 100.0).unwrap();
        let snapshot: (String, i64, i64, i64) = conn.query_row(
            "SELECT doctor_name_snapshot, eligible_amount_paise, commission_paise, share_rate_basis_points
             FROM doctor_commissions WHERE order_id = ?1",
            [order_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        ).unwrap();
        assert_eq!(snapshot, ("Dr. Smith".to_string(), 40_000, 10_000, 2_500));
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('doctor_share', '0.4')",
            [],
        ).unwrap();

        let patient_total: i64 = conn.query_row(
            "SELECT total_amount_paise FROM orders WHERE id = ?1",
            [order_id],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(patient_total, 40_000);

        let revenue = service::get_doctor_revenue(&conn, "", "").unwrap();
        let dr_smith = revenue.iter().find(|row| row.doctor_name == "Dr. Smith").unwrap();
        assert_eq!(dr_smith.commission_earned, 100.0, "revenue row: {:?}", dr_smith);
        assert_eq!(dr_smith.commission_outstanding, 100.0);
        assert_eq!(dr_smith.eligible_amount, 900.0);
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
    fn cancel_order_completed_succeeds() {
        let mut conn = test_db();
        // Order 100 is seeded with status='Completed'
        service::cancel_order(&mut conn, 100).unwrap();
        let status = service::get_order_status(&conn, 100).unwrap();
        assert_eq!(status, "Cancelled");
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

    // ------------------------------------------------------------------
    // 22. create_order_with_prices - patient-specific custom price override
    // ------------------------------------------------------------------

    #[test]
    fn create_order_with_custom_price_patient_a_and_patient_b() {
        let mut conn = test_db();

        // Standard CBC price in test_db is 500.00
        let master_price_before: f64 = conn
            .query_row("SELECT price FROM tests WHERE id = 1", [], |row| row.get(0))
            .unwrap();
        assert_eq!(master_price_before, 500.00);

        // Patient A receives CBC at custom Rs 250.00
        let mut custom_prices = std::collections::HashMap::new();
        custom_prices.insert(1, 250.00);

        let order_a_id = service::create_order_with_prices(
            &mut conn,
            1, // patient_id
            vec![1],
            vec![],
            250.00, // total_amount matches custom price
            0.00,
            Some(custom_prices),
        )
        .unwrap();

        // Verify Patient A order has 25000 paise in order and order_tests
        let total_a: i64 = conn
            .query_row("SELECT total_amount_paise FROM orders WHERE id = ?1", [order_a_id], |row| row.get(0))
            .unwrap();
        assert_eq!(total_a, 25000);

        let test_price_a: i64 = conn
            .query_row("SELECT price_paise FROM order_tests WHERE order_id = ?1 AND test_id = 1", [order_a_id], |row| row.get(0))
            .unwrap();
        assert_eq!(test_price_a, 25000);

        // CRUCIAL: Verify master CBC price in tests table is STILL 500.00
        let master_price_after: f64 = conn
            .query_row("SELECT price FROM tests WHERE id = 1", [], |row| row.get(0))
            .unwrap();
        assert_eq!(master_price_after, 500.00);

        // Patient B creates an order without custom price override -> gets standard Rs 500.00
        let order_b_id = service::create_order(
            &mut conn,
            1, // patient_id
            vec![1],
            vec![],
            500.00,
            0.00,
        )
        .unwrap();

        let total_b: i64 = conn
            .query_row("SELECT total_amount_paise FROM orders WHERE id = ?1", [order_b_id], |row| row.get(0))
            .unwrap();
        assert_eq!(total_b, 50000);

        let test_price_b: i64 = conn
            .query_row("SELECT price_paise FROM order_tests WHERE order_id = ?1 AND test_id = 1", [order_b_id], |row| row.get(0))
            .unwrap();
        assert_eq!(test_price_b, 50000);
    }

    // ------------------------------------------------------------------
    // 23. create_order_with_prices - free test (Rs 0 price)
    // ------------------------------------------------------------------

    #[test]
    fn create_order_with_zero_price_free_test() {
        let mut conn = test_db();

        let mut custom_prices = std::collections::HashMap::new();
        custom_prices.insert(1, 0.0);

        let order_id = service::create_order_with_prices(
            &mut conn,
            1,
            vec![1],
            vec![],
            0.00,
            0.00,
            Some(custom_prices),
        )
        .unwrap();

        let total: i64 = conn
            .query_row("SELECT total_amount_paise FROM orders WHERE id = ?1", [order_id], |row| row.get(0))
            .unwrap();
        assert_eq!(total, 0);

        let test_price: i64 = conn
            .query_row("SELECT price_paise FROM order_tests WHERE order_id = ?1", [order_id], |row| row.get(0))
            .unwrap();
        assert_eq!(test_price, 0);

        // Master price unchanged
        let master_price: f64 = conn
            .query_row("SELECT price FROM tests WHERE id = 1", [], |row| row.get(0))
            .unwrap();
        assert_eq!(master_price, 500.00);
    }

    // ------------------------------------------------------------------
    // 24. create_order_with_prices - mixed custom and standard prices
    // ------------------------------------------------------------------

    #[test]
    fn create_order_with_mixed_prices() {
        let mut conn = test_db();

        // CBC (id 1, standard 500) overridden to 350
        // Lipid (id 2, standard 800) kept at standard
        let mut custom_prices = std::collections::HashMap::new();
        custom_prices.insert(1, 350.00);

        // Expected subtotal = 350 + 800 = 1150.00
        let order_id = service::create_order_with_prices(
            &mut conn,
            1,
            vec![1, 2],
            vec![],
            1150.00,
            0.00,
            Some(custom_prices),
        )
        .unwrap();

        let total: i64 = conn
            .query_row("SELECT total_amount_paise FROM orders WHERE id = ?1", [order_id], |row| row.get(0))
            .unwrap();
        assert_eq!(total, 115000);

        let price_cbc: i64 = conn
            .query_row("SELECT price_paise FROM order_tests WHERE order_id = ?1 AND test_id = 1", [order_id], |row| row.get(0))
            .unwrap();
        assert_eq!(price_cbc, 35000);

        let price_lipid: i64 = conn
            .query_row("SELECT price_paise FROM order_tests WHERE order_id = ?1 AND test_id = 2", [order_id], |row| row.get(0))
            .unwrap();
        assert_eq!(price_lipid, 80000);
    }

    // ------------------------------------------------------------------
    // 25. create_order_with_prices - negative price rejected
    // ------------------------------------------------------------------

    #[test]
    fn create_order_rejects_negative_custom_price() {
        let mut conn = test_db();

        let mut custom_prices = std::collections::HashMap::new();
        custom_prices.insert(1, -50.00);

        let err = service::create_order_with_prices(
            &mut conn,
            1,
            vec![1],
            vec![],
            0.00,
            0.00,
            Some(custom_prices),
        )
        .unwrap_err();

        assert!(err.to_string().contains("positive") || err.to_string().contains("Amount") || err.to_string().contains("invalid"));
    }

    // ------------------------------------------------------------------
    // 26. add_tests_to_order - happy path single test
    // ------------------------------------------------------------------

    #[test]
    fn add_test_to_order_success() {
        let mut conn = test_db();

        // Create order with test 1 (CBC, 500.00)
        let order_id = service::create_order(&mut conn, 1, vec![1], vec![], 500.00, 0.00).unwrap();

        // Add test 2 (Lipid Profile, 800.00)
        service::add_tests_to_order(&mut conn, order_id, vec![2], None).unwrap();

        // Total should now be 50000 + 80000 = 130000
        let total: i64 = conn
            .query_row("SELECT total_amount_paise FROM orders WHERE id = ?1", [order_id], |row| row.get(0))
            .unwrap();
        assert_eq!(total, 130000);

        // Check order_tests count is 2
        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM order_tests WHERE order_id = ?1", [order_id], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 2);

        // Check order_parameters has parameters for both tests
        let param_count: i32 = conn
            .query_row("SELECT COUNT(*) FROM order_parameters WHERE order_id = ?1", [order_id], |row| row.get(0))
            .unwrap();
        assert!(param_count >= 2);
    }

    // ------------------------------------------------------------------
    // 27. add_tests_to_order - multiple tests added together
    // ------------------------------------------------------------------

    #[test]
    fn add_multiple_tests_to_order() {
        let mut conn = test_db();

        // Add test 4 to test catalog for this test
        conn.execute("INSERT INTO tests (id, name, price) VALUES (4, 'TSH', 300.00)", []).unwrap();
        conn.execute("INSERT INTO test_parameters (id, test_id, name, unit, normal_range) VALUES (4, 4, 'TSH', 'uIU/mL', '0.4-4.5')", []).unwrap();

        let order_id = service::create_order(&mut conn, 1, vec![1], vec![], 500.00, 0.00).unwrap();

        // Add tests 2 and 4 together (800 + 300 = 1100.00)
        service::add_tests_to_order(&mut conn, order_id, vec![2, 4], None).unwrap();

        let total: i64 = conn
            .query_row("SELECT total_amount_paise FROM orders WHERE id = ?1", [order_id], |row| row.get(0))
            .unwrap();
        assert_eq!(total, 160000); // 50000 + 80000 + 30000
    }

    // ------------------------------------------------------------------
    // 28. add_tests_to_order - patient-specific custom pricing
    // ------------------------------------------------------------------

    #[test]
    fn add_test_with_custom_pricing() {
        let mut conn = test_db();

        let order_id = service::create_order(&mut conn, 1, vec![1], vec![], 500.00, 0.00).unwrap();

        // Add test 2 (Lipid Profile, standard 800.00) at custom price 650.00
        let mut custom = std::collections::HashMap::new();
        custom.insert(2, 650.00);

        service::add_tests_to_order(&mut conn, order_id, vec![2], Some(custom)).unwrap();

        let total: i64 = conn
            .query_row("SELECT total_amount_paise FROM orders WHERE id = ?1", [order_id], |row| row.get(0))
            .unwrap();
        assert_eq!(total, 115000); // 50000 + 65000

        let lipid_price: i64 = conn
            .query_row("SELECT price_paise FROM order_tests WHERE order_id = ?1 AND test_id = 2", [order_id], |row| row.get(0))
            .unwrap();
        assert_eq!(lipid_price, 65000);

        // Master catalog remains 800.00
        let master_price: f64 = conn
            .query_row("SELECT price FROM tests WHERE id = 2", [], |row| row.get(0))
            .unwrap();
        assert_eq!(master_price, 800.00);
    }

    // ------------------------------------------------------------------
    // 29. add_tests_to_order - duplicate test rejected
    // ------------------------------------------------------------------

    #[test]
    fn add_test_rejects_duplicate_test() {
        let mut conn = test_db();

        let order_id = service::create_order(&mut conn, 1, vec![1], vec![], 500.00, 0.00).unwrap();

        // Attempt to add test 1 again
        let err = service::add_tests_to_order(&mut conn, order_id, vec![1], None).unwrap_err();
        assert!(err.to_string().contains("already attached"));
    }

    // ------------------------------------------------------------------
    // 30. add_tests_to_order - cancelled order rejected
    // ------------------------------------------------------------------

    #[test]
    fn add_test_rejects_cancelled_order() {
        let mut conn = test_db();

        let order_id = service::create_order(&mut conn, 1, vec![1], vec![], 500.00, 0.00).unwrap();
        service::cancel_order(&mut conn, order_id).unwrap();

        let err = service::add_tests_to_order(&mut conn, order_id, vec![2], None).unwrap_err();
        assert!(err.to_string().contains("cancelled"));
    }

    // ------------------------------------------------------------------
    // 31. add_tests_to_order - preserves existing clinical results
    // ------------------------------------------------------------------

    #[test]
    fn add_test_preserves_existing_results() {
        let mut conn = test_db();

        let order_id = service::create_order(&mut conn, 1, vec![1], vec![], 500.00, 0.00).unwrap();

        // Enter result for parameter 1 on order
        conn.execute("INSERT INTO results (order_id, parameter_id, value) VALUES (?1, 1, '14.2')", [order_id]).unwrap();

        // Add test 2
        service::add_tests_to_order(&mut conn, order_id, vec![2], None).unwrap();

        // Check that existing result is STILL present and unchanged
        let val: String = conn
            .query_row("SELECT value FROM results WHERE order_id = ?1 AND parameter_id = 1", [order_id], |row| row.get(0))
            .unwrap();
        assert_eq!(val, "14.2");
    }

    // ------------------------------------------------------------------
    // 32. Migration 16 duplicate detection & rollback verification
    // ------------------------------------------------------------------

    #[test]
    fn test_migration_16_transaction_rollback_on_duplicate_keys() {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();

        // Construct anomalous database at user_version 15
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
            CREATE TABLE orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                order_number TEXT UNIQUE,
                invoice_no TEXT UNIQUE,
                total_amount_paise INTEGER DEFAULT 0,
                discount_amount_paise INTEGER DEFAULT 0,
                paid_amount_paise INTEGER DEFAULT 0,
                status TEXT DEFAULT 'Pending',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE order_tests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                test_id INTEGER NOT NULL,
                test_name_snapshot TEXT,
                price_paise INTEGER DEFAULT 0
            );
            CREATE TABLE order_parameters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                parameter_id INTEGER NOT NULL,
                parameter_name_snapshot TEXT,
                unit_snapshot TEXT,
                normal_range_snapshot TEXT
            );
            CREATE TABLE results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                parameter_id INTEGER NOT NULL,
                value TEXT NOT NULL
            );
            PRAGMA user_version = 15;
            "
        ).unwrap();

        // Insert anomalous duplicate intra-order records with conflicting clinical values
        conn.execute("INSERT INTO orders (id, patient_id) VALUES (1, 1)", []).unwrap();
        conn.execute("INSERT INTO order_tests (id, order_id, test_id, test_name_snapshot, price_paise) VALUES (10, 1, 5, 'CBC', 30000)", []).unwrap();
        conn.execute("INSERT INTO order_tests (id, order_id, test_id, test_name_snapshot, price_paise) VALUES (11, 1, 5, 'CBC Updated', 35000)", []).unwrap();

        conn.execute("INSERT INTO results (id, order_id, parameter_id, value) VALUES (20, 1, 8, '12.0')", []).unwrap();
        conn.execute("INSERT INTO results (id, order_id, parameter_id, value) VALUES (21, 1, 8, '14.5')", []).unwrap();

        // Run migrations
        let res = crate::db::migrations::run_migrations(&mut conn);
        assert!(res.is_err(), "Migration 16 MUST fail when duplicate intra-order keys exist");

        let err_msg = res.unwrap_err().to_string();
        assert!(err_msg.contains("order_tests"), "Error must name affected table order_tests");
        assert!(err_msg.contains("order_id: 1, test_id: 5"), "Error must name exact duplicate keys for order_tests");
        assert!(err_msg.contains("results"), "Error must name affected table results");
        assert!(err_msg.contains("order_id: 1, parameter_id: 8"), "Error must name exact duplicate keys for results");

        // Verify transaction rollback: user_version is STILL 15
        let v: i32 = conn.query_row("PRAGMA user_version", [], |row| row.get(0)).unwrap();
        assert_eq!(v, 15, "user_version must remain 15 after rollback");

        // Verify index was not created
        let idx_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_patients_referred_by'",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(idx_count, 0, "idx_patients_referred_by must not exist after rollback");

        // Verify zero deletions or overwrites: all original records and values remain unchanged
        let ot_rows: Vec<(i32, String, i64)> = conn.prepare("SELECT id, test_name_snapshot, price_paise FROM order_tests ORDER BY id ASC")
            .unwrap()
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .unwrap()
            .collect::<rusqlite::Result<Vec<_>>>()
            .unwrap();
        assert_eq!(ot_rows.len(), 2, "Both order_tests rows must be preserved");
        assert_eq!(ot_rows[0], (10, "CBC".to_string(), 30000));
        assert_eq!(ot_rows[1], (11, "CBC Updated".to_string(), 35000));

        let res_rows: Vec<(i32, String)> = conn.prepare("SELECT id, value FROM results ORDER BY id ASC")
            .unwrap()
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap()
            .collect::<rusqlite::Result<Vec<_>>>()
            .unwrap();
        assert_eq!(res_rows.len(), 2, "Both clinical results rows must be preserved");
        assert_eq!(res_rows[0], (20, "12.0".to_string()));
        assert_eq!(res_rows[1], (21, "14.5".to_string()));
    }

    // ------------------------------------------------------------------
    // 33. Date filtering fractional seconds and boundary exclusion
    // ------------------------------------------------------------------

    #[test]
    fn test_date_filtering_fractional_seconds_and_next_day_exclusion() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();

        conn.execute_batch(
            "
            CREATE TABLE patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_code TEXT,
                name TEXT NOT NULL
            );
            CREATE TABLE tests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                price REAL DEFAULT 0
            );
            CREATE TABLE order_tests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                test_id INTEGER NOT NULL,
                test_name_snapshot TEXT,
                price_paise INTEGER DEFAULT 0
            );
            CREATE TABLE order_parameters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                parameter_id INTEGER NOT NULL
            );
            CREATE TABLE results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                parameter_id INTEGER NOT NULL,
                value TEXT NOT NULL
            );
            CREATE TABLE orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                order_number TEXT,
                invoice_no TEXT,
                total_amount_paise INTEGER DEFAULT 0,
                paid_amount_paise INTEGER DEFAULT 0,
                status TEXT DEFAULT 'Completed',
                created_at TEXT
            );
            CREATE INDEX idx_orders_created_at ON orders(created_at);
            "
        ).unwrap();

        conn.execute("INSERT INTO patients (id, name) VALUES (1, 'Test Patient')", []).unwrap();
        conn.execute("INSERT INTO tests (id, name, price) VALUES (1, 'CBC', 300.0)", []).unwrap();

        // Insert timestamps around 2026-11-02
        let timestamps = [
            (1, "2026-11-01 23:59:59.999"), // previous day fractional
            (2, "2026-11-02 00:00:00.000"), // target day midnight
            (3, "2026-11-02 14:15:30.456"), // target day fractional mid-day
            (4, "2026-11-02 23:59:59.999"), // target day final millisecond
            (5, "2026-11-03 00:00:00.000"), // next day midnight
            (6, "2026-11-03 00:00:00.001"), // next day early millisecond
        ];

        for (id, ts) in timestamps {
            conn.execute("INSERT INTO orders (id, patient_id, created_at) VALUES (?1, 1, ?2)", rusqlite::params![id, ts]).unwrap();
            conn.execute("INSERT INTO order_tests (order_id, test_id, test_name_snapshot, price_paise) VALUES (?1, 1, 'CBC', 30000)", rusqlite::params![id]).unwrap();
        }

        // 1. Both dates: single day 2026-11-02 to 2026-11-02
        let orders_single_day = service::get_orders_by_date_range(&conn, "2026-11-02", "2026-11-02").unwrap();
        let ids: Vec<i32> = orders_single_day.into_iter().map(|o| o.id).collect();
        assert_eq!(ids, vec![4, 3, 2], "Must include 2, 3, 4 and strictly exclude 1, 5, 6");

        // 2. Only date_from: >= 2026-11-02
        let orders_from = service::get_orders_by_date_range(&conn, "2026-11-02", "").unwrap();
        let ids_from: Vec<i32> = orders_from.into_iter().map(|o| o.id).collect();
        assert_eq!(ids_from, vec![6, 5, 4, 3, 2], "Must include all >= 2026-11-02");

        // 3. Only date_to: < 2026-11-03
        let orders_to = service::get_orders_by_date_range(&conn, "", "2026-11-02").unwrap();
        let ids_to: Vec<i32> = orders_to.into_iter().map(|o| o.id).collect();
        assert_eq!(ids_to, vec![4, 3, 2, 1], "Must include all up to end of 2026-11-02");

        // 4. Neither date: all orders
        let orders_all = service::get_orders_by_date_range(&conn, "", "").unwrap();
        assert_eq!(orders_all.len(), 6, "Must return all 6 orders when no date filter is supplied");
    }

    // ------------------------------------------------------------------
    // 34. Multi-visit patient records preserved independently
    // ------------------------------------------------------------------

    #[test]
    fn test_multi_visit_patient_records_preserved() {
        let mut conn = test_db();

        conn.execute("INSERT INTO patients (id, patient_code, name, referred_by) VALUES (10, 'PID-2026-0099', 'Rohit Sharma', 'Dr. Smith')", []).unwrap();

        // Single patient visits lab on multiple occasions
        let visit_1 = service::create_order(&mut conn, 10, vec![1], vec![], 500.00, 0.00).unwrap();
        let visit_2 = service::create_order(&mut conn, 10, vec![2], vec![], 800.00, 0.00).unwrap();
        let visit_3 = service::create_order(&mut conn, 10, vec![1, 2], vec![], 1300.00, 0.00).unwrap();

        assert_ne!(visit_1, visit_2);
        assert_ne!(visit_2, visit_3);

        // Fetch patient orders
        let orders = service::get_orders(&conn).unwrap();
        let patient_orders: Vec<_> = orders.into_iter().filter(|o| o.patient_name == "Rohit Sharma").collect();
        assert_eq!(patient_orders.len(), 3, "All three visits must exist as separate orders");

        // Ensure patient code is identical across all three visits
        let patient_codes: Vec<String> = patient_orders.iter().map(|o| o.patient_code.clone()).collect();
        assert_eq!(patient_codes[0], "PID-2026-0099");
        assert_eq!(patient_codes[1], "PID-2026-0099");
        assert_eq!(patient_codes[2], "PID-2026-0099");

        // Ensure each visit has distinct order number and invoice number
        let order_numbers: Vec<String> = patient_orders.iter().map(|o| o.order_number.clone()).collect();
        assert_ne!(order_numbers[0], order_numbers[1]);
        assert_ne!(order_numbers[1], order_numbers[2]);
        assert_ne!(order_numbers[0], order_numbers[2]);
    }

    // ------------------------------------------------------------------
    // 35. Existing admin password preserved on startup
    // ------------------------------------------------------------------

    #[test]
    fn test_existing_admin_password_preserved() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE IF NOT EXISTS doctors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL);
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'staff',
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS tests (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, price REAL NOT NULL DEFAULT 0, is_active INTEGER DEFAULT 1, updated_at TEXT);
            CREATE TABLE IF NOT EXISTS test_parameters (id INTEGER PRIMARY KEY AUTOINCREMENT, test_id INTEGER NOT NULL, name TEXT NOT NULL, unit TEXT, normal_range TEXT, is_active INTEGER DEFAULT 1, updated_at TEXT, UNIQUE(test_id, name));
            "
        ).unwrap();

        // Custom password hash previously set by admin
        let custom_hash = "$2b$10$custom_admin_hash_that_should_never_be_overwritten";
        conn.execute("INSERT INTO users (username, password_hash, role) VALUES ('admin', ?1, 'admin')", [custom_hash]).unwrap();

        // Run seed_data
        crate::db::seeds::seed_data(&conn).unwrap();

        // Verify password hash was NOT overwritten or reset
        let current_hash: String = conn.query_row("SELECT password_hash FROM users WHERE username = 'admin'", [], |r| r.get(0)).unwrap();
        assert_eq!(current_hash, custom_hash, "Admin's custom password hash must NEVER be overwritten");
    }

    // ------------------------------------------------------------------
    // 36. Migration 16 clean upgrade and idempotency verification
    // ------------------------------------------------------------------

    #[test]
    fn test_migration_16_clean_upgrade_and_idempotence() {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();

        // Construct clean database at user_version 15
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
            CREATE TABLE orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                order_number TEXT UNIQUE,
                invoice_no TEXT UNIQUE,
                total_amount_paise INTEGER DEFAULT 0,
                discount_amount_paise INTEGER DEFAULT 0,
                paid_amount_paise INTEGER DEFAULT 0,
                status TEXT DEFAULT 'Pending',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE order_tests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                test_id INTEGER NOT NULL,
                test_name_snapshot TEXT,
                price_paise INTEGER DEFAULT 0
            );
            CREATE TABLE order_parameters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                parameter_id INTEGER NOT NULL,
                parameter_name_snapshot TEXT,
                unit_snapshot TEXT,
                normal_range_snapshot TEXT
            );
            CREATE TABLE results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                parameter_id INTEGER NOT NULL,
                value TEXT NOT NULL
            );
            PRAGMA user_version = 15;
            "
        ).unwrap();

        conn.execute("INSERT INTO patients (id, name, referred_by) VALUES (1, 'Dr Patient', 'Dr. Smith')", []).unwrap();
        conn.execute("INSERT INTO orders (id, patient_id) VALUES (10, 1)", []).unwrap();
        conn.execute("INSERT INTO order_tests (id, order_id, test_id, test_name_snapshot, price_paise) VALUES (1, 10, 1, 'CBC', 50000)", []).unwrap();
        conn.execute("INSERT INTO order_parameters (id, order_id, parameter_id, parameter_name_snapshot) VALUES (1, 10, 1, 'Hb')", []).unwrap();
        conn.execute("INSERT INTO results (id, order_id, parameter_id, value) VALUES (1, 10, 1, '14.5')", []).unwrap();

        // 1. Run migrations: should succeed cleanly
        let res = crate::db::migrations::run_migrations(&mut conn);
        assert!(res.is_ok(), "Clean migration 16 must succeed");

        // Verify version advanced past 16
        let v: i32 = conn.query_row("PRAGMA user_version", [], |row| row.get(0)).unwrap();
        assert!(v >= 16);

        // Verify index exists
        let idx_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_patients_referred_by'",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(idx_count, 1);

        // Verify all rows preserved
        let p_count: i64 = conn.query_row("SELECT COUNT(*) FROM patients", [], |row| row.get(0)).unwrap();
        let o_count: i64 = conn.query_row("SELECT COUNT(*) FROM orders", [], |row| row.get(0)).unwrap();
        let ot_count: i64 = conn.query_row("SELECT COUNT(*) FROM order_tests", [], |row| row.get(0)).unwrap();
        let op_count: i64 = conn.query_row("SELECT COUNT(*) FROM order_parameters", [], |row| row.get(0)).unwrap();
        let r_count: i64 = conn.query_row("SELECT COUNT(*) FROM results", [], |row| row.get(0)).unwrap();
        assert_eq!(p_count, 1);
        assert_eq!(o_count, 1);
        assert_eq!(ot_count, 1);
        assert_eq!(op_count, 1);
        assert_eq!(r_count, 1);

        // 2. Second migration run is idempotent
        let res2 = crate::db::migrations::run_migrations(&mut conn);
        assert!(res2.is_ok(), "Second migration run must be a no-op");
        let v2: i32 = conn.query_row("PRAGMA user_version", [], |row| row.get(0)).unwrap();
        assert_eq!(v2, v);
    }
}

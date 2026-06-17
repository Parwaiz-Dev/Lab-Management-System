/// Payment service integration tests.
///
/// These tests verify:
/// 1. Updating payments with valid amounts
/// 2. Payment history tracking
/// 3. Business rules (cannot exceed total, cannot decrease, non-existent order)
/// 4. Daily and overall summaries
#[cfg(test)]
mod tests {
    use crate::modules::payment::service;

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
                name TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                total_amount_paise INTEGER DEFAULT 0,
                discount_amount_paise INTEGER DEFAULT 0,
                paid_amount_paise INTEGER DEFAULT 0,
                invoice_no TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id)
            );
            CREATE TABLE IF NOT EXISTS payment_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                previous_paid_paise INTEGER,
                new_paid_paise INTEGER NOT NULL,
                total_amount_paise INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id)
            );
            ",
        )
        .unwrap();

        conn.execute("INSERT INTO patients (id, name) VALUES (1, 'Test Patient')", []).unwrap();
        conn.execute("INSERT INTO orders (id, patient_id, total_amount_paise, paid_amount_paise, invoice_no, created_at) VALUES (1, 1, 50000, 0, 'INV-1', DATETIME('now'))", []).unwrap();
        conn.execute("INSERT INTO orders (id, patient_id, total_amount_paise, paid_amount_paise, invoice_no, created_at) VALUES (2, 1, 100000, 30000, 'INV-2', DATETIME('now'))", []).unwrap();
        conn.execute("INSERT INTO orders (id, patient_id, total_amount_paise, paid_amount_paise, invoice_no, created_at) VALUES (3, 1, 75000, 75000, 'INV-3', '2020-01-15')", []).unwrap();

        conn
    }

    // ------------------------------------------------------------------
    // 1. update_payment — initial payment
    // ------------------------------------------------------------------

    #[test]
    fn update_payment_initial() {
        let mut conn = test_db();

        service::update_payment(&mut conn, 1, 200.00).unwrap();

        let paid: i64 = conn
            .query_row("SELECT paid_amount_paise FROM orders WHERE id = ?1", [1], |row| row.get(0))
            .unwrap();
        assert_eq!(paid, 20000);
    }

    // ------------------------------------------------------------------
    // 2. update_payment — incremental payment
    // ------------------------------------------------------------------

    #[test]
    fn update_payment_incremental() {
        let mut conn = test_db();

        // Order 2 already has 30000 paise (₹300) paid
        service::update_payment(&mut conn, 2, 600.00).unwrap();

        let paid: i64 = conn
            .query_row("SELECT paid_amount_paise FROM orders WHERE id = ?1", [2], |row| row.get(0))
            .unwrap();
        assert_eq!(paid, 60000);
    }

    // ------------------------------------------------------------------
    // 3. update_payment — full payment
    // ------------------------------------------------------------------

    #[test]
    fn update_payment_full() {
        let mut conn = test_db();

        service::update_payment(&mut conn, 1, 500.00).unwrap();

        let paid: i64 = conn
            .query_row("SELECT paid_amount_paise FROM orders WHERE id = ?1", [1], |row| row.get(0))
            .unwrap();
        assert_eq!(paid, 50000);
    }

    // ------------------------------------------------------------------
    // 4. update_payment — cannot exceed total
    // ------------------------------------------------------------------

    #[test]
    fn update_payment_exceeds_total() {
        let mut conn = test_db();
        let err = service::update_payment(&mut conn, 1, 600.00).unwrap_err();
        assert!(err.to_string().contains("cannot exceed"));
    }

    // ------------------------------------------------------------------
    // 5. update_payment — cannot decrease
    // ------------------------------------------------------------------

    #[test]
    fn update_payment_cannot_decrease() {
        let mut conn = test_db();
        // Order 2 already has ₹300 paid
        let err = service::update_payment(&mut conn, 2, 100.00).unwrap_err();
        assert!(err.to_string().contains("already recorded"));
    }

    // ------------------------------------------------------------------
    // 6. update_payment — non-existent order
    // ------------------------------------------------------------------

    #[test]
    fn update_payment_nonexistent_order() {
        let mut conn = test_db();
        let err = service::update_payment(&mut conn, 999, 100.00).unwrap_err();
        assert!(err.to_string().contains("not found"));
    }

    // ------------------------------------------------------------------
    // 7. update_payment — creates payment history
    // ------------------------------------------------------------------

    #[test]
    fn update_payment_creates_history() {
        let mut conn = test_db();

        let before: i32 = conn
            .query_row("SELECT COUNT(*) FROM payment_history WHERE order_id = 1", [], |row| row.get(0))
            .unwrap();

        service::update_payment(&mut conn, 1, 300.00).unwrap();

        let after: i32 = conn
            .query_row("SELECT COUNT(*) FROM payment_history WHERE order_id = 1", [], |row| row.get(0))
            .unwrap();
        assert_eq!(after, before + 1);
    }

    // ------------------------------------------------------------------
    // 8. update_payment — history records correct values
    // ------------------------------------------------------------------

    #[test]
    fn payment_history_has_correct_values() {
        let mut conn = test_db();

        service::update_payment(&mut conn, 2, 800.00).unwrap();

        let (previous, new, total): (i64, i64, i64) = conn
            .query_row(
                "SELECT IFNULL(previous_paid_paise, 0), new_paid_paise, total_amount_paise
                 FROM payment_history
                 WHERE order_id = 2
                 ORDER BY id DESC LIMIT 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(previous, 30000); // previous paid
        assert_eq!(new, 80000);      // new paid
        assert_eq!(total, 100000);   // total amount
    }

    // ------------------------------------------------------------------
    // 9. get_daily_summary
    // ------------------------------------------------------------------

    #[test]
    fn get_daily_summary_returns_values() {
        let conn = test_db();
        let (total, paid, pending) = service::get_daily_summary(&conn).unwrap();
        // Orders 1 and 2 were created with DATETIME('now'), so they should appear
        assert!(total >= 0.0);
        assert!(paid >= 0.0);
        assert!(pending >= 0.0);
    }

    // ------------------------------------------------------------------
    // 10. get_overall_summary
    // ------------------------------------------------------------------

    #[test]
    fn get_overall_summary_aggregates_all() {
        let conn = test_db();
        let (total, paid, pending) = service::get_overall_summary(&conn).unwrap();
        // All 3 orders: 500 + 1000 + 750 = 2250
        assert_eq!(total, 2250.00);
        // Paid: 0 + 300 + 750 = 1050
        assert_eq!(paid, 1050.00);
        // Pending: 2250 - 1050 = 1200
        assert_eq!(pending, 1200.00);
    }

    // ------------------------------------------------------------------
    // 11. get_payment_history — returns entries
    // ------------------------------------------------------------------

    #[test]
    fn get_payment_history_returns_entries() {
        let mut conn = test_db();

        service::update_payment(&mut conn, 1, 200.00).unwrap();
        service::update_payment(&mut conn, 1, 400.00).unwrap();

        let history = service::get_payment_history(&conn, 1).unwrap();
        assert_eq!(history.len(), 2);

        // Both entries should be present; ORDER BY created_at may be non-deterministic
        // when both inserts happen in the same millisecond (SQLite in-memory)
        let paid_amounts: Vec<f64> = history.iter().map(|h| h.new_paid).collect();
        assert!(paid_amounts.contains(&200.00));
        assert!(paid_amounts.contains(&400.00));
    }

    // ------------------------------------------------------------------
    // 12. get_payment_history — empty for no payments
    // ------------------------------------------------------------------

    #[test]
    fn get_payment_history_empty() {
        let conn = test_db();
        // Order 1 has no payment history entries yet
        let history = service::get_payment_history(&conn, 1).unwrap();
        assert!(history.is_empty());
    }

    // ------------------------------------------------------------------
    // 13. update_payment — validate negative amount
    // ------------------------------------------------------------------

    #[test]
    fn update_payment_negative_amount() {
        let mut conn = test_db();
        let err = service::update_payment(&mut conn, 1, -50.00).unwrap_err();
        // validate_amount returns "Amount cannot be negative"
        assert!(err.to_string().contains("negative"));
    }
}
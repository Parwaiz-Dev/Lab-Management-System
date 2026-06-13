use rusqlite::{Connection, Result};

fn table_has_column(conn: &Connection, table: &str, column: &str) -> Result<bool> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
    let mut rows = stmt.query([])?;

    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?;
        if name == column {
            return Ok(true);
        }
    }

    Ok(false)
}

fn ensure_column(conn: &Connection, table: &str, column_def: &str) -> Result<()> {
    let column_name = column_def
        .split_whitespace()
        .next()
        .ok_or_else(|| rusqlite::Error::InvalidColumnName(format!(
            "invalid column definition: '{}'",
            column_def
        )))?;

    if !table_has_column(conn, table, column_name)? {
        conn.execute(
            &format!("ALTER TABLE {} ADD COLUMN {}", table, column_def),
            [],
        )?;
    }

    Ok(())
}

pub fn run_migrations(conn: &Connection) -> Result<()> {
    let mut version: i32 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;

    if version < 1 {
        ensure_column(conn, "orders", "invoice_no TEXT")?;
        ensure_column(conn, "orders", "paid_amount REAL DEFAULT 0")?;
        ensure_column(conn, "orders", "discount_amount REAL DEFAULT 0")?;
        ensure_column(conn, "orders", "total_amount REAL DEFAULT 0")?;

        ensure_column(conn, "orders", "total_amount_paise INTEGER DEFAULT 0")?;
        ensure_column(conn, "orders", "discount_amount_paise INTEGER DEFAULT 0")?;
        ensure_column(conn, "orders", "paid_amount_paise INTEGER DEFAULT 0")?;

        ensure_column(conn, "tests", "is_active INTEGER DEFAULT 1")?;
        ensure_column(conn, "tests", "updated_at TEXT")?;

        ensure_column(conn, "test_parameters", "is_active INTEGER DEFAULT 1")?;
        ensure_column(conn, "test_parameters", "updated_at TEXT")?;

        conn.execute(
            "UPDATE orders
             SET total_amount_paise = ROUND(IFNULL(total_amount, 0) * 100)
             WHERE IFNULL(total_amount_paise, 0) = 0",
            [],
        )?;

        conn.execute(
            "UPDATE orders
             SET discount_amount_paise = ROUND(IFNULL(discount_amount, 0) * 100)
             WHERE IFNULL(discount_amount_paise, 0) = 0",
            [],
        )?;

        conn.execute(
            "UPDATE orders
             SET paid_amount_paise = ROUND(IFNULL(paid_amount, 0) * 100)
             WHERE IFNULL(paid_amount_paise, 0) = 0",
            [],
        )?;

        conn.pragma_update(None, "user_version", 1)?;
        version = 1;
    }

    if version < 2 {
        conn.execute_batch(
            "
            CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
            CREATE INDEX IF NOT EXISTS idx_patients_code ON patients(patient_code);

            CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
            CREATE INDEX IF NOT EXISTS idx_orders_patient_id ON orders(patient_id);

            CREATE INDEX IF NOT EXISTS idx_order_tests_order_id ON order_tests(order_id);
            CREATE INDEX IF NOT EXISTS idx_order_tests_test_id ON order_tests(test_id);

            CREATE INDEX IF NOT EXISTS idx_order_parameters_order_id ON order_parameters(order_id);
            CREATE INDEX IF NOT EXISTS idx_order_parameters_parameter_id ON order_parameters(parameter_id);

            CREATE INDEX IF NOT EXISTS idx_results_order_id ON results(order_id);
            CREATE INDEX IF NOT EXISTS idx_results_parameter_id ON results(parameter_id);

            CREATE INDEX IF NOT EXISTS idx_test_parameters_test_id ON test_parameters(test_id);
            ",
        )?;

        conn.pragma_update(None, "user_version", 2)?;
        version = 2;
    }

    if version < 3 {
        ensure_column(conn, "order_tests", "test_name_snapshot TEXT")?;
        ensure_column(conn, "order_tests", "price_paise INTEGER DEFAULT 0")?;

        ensure_column(conn, "order_parameters", "parameter_name_snapshot TEXT")?;
        ensure_column(conn, "order_parameters", "unit_snapshot TEXT")?;
        ensure_column(conn, "order_parameters", "normal_range_snapshot TEXT")?;

        conn.execute(
            "
            UPDATE order_tests
            SET test_name_snapshot = (
                SELECT name FROM tests WHERE tests.id = order_tests.test_id
            )
            WHERE test_name_snapshot IS NULL OR test_name_snapshot = ''
            ",
            [],
        )?;

        conn.execute(
            "
            UPDATE order_tests
            SET price_paise = ROUND((
                SELECT IFNULL(price, 0) FROM tests WHERE tests.id = order_tests.test_id
            ) * 100)
            WHERE IFNULL(price_paise, 0) = 0
            ",
            [],
        )?;

        conn.execute(
            "
            UPDATE order_parameters
            SET parameter_name_snapshot = (
                SELECT name FROM test_parameters WHERE test_parameters.id = order_parameters.parameter_id
            )
            WHERE parameter_name_snapshot IS NULL OR parameter_name_snapshot = ''
            ",
            [],
        )?;

        conn.execute(
            "
            UPDATE order_parameters
            SET unit_snapshot = (
                SELECT unit FROM test_parameters WHERE test_parameters.id = order_parameters.parameter_id
            )
            WHERE unit_snapshot IS NULL
            ",
            [],
        )?;

        conn.execute(
            "
            UPDATE order_parameters
            SET normal_range_snapshot = (
                SELECT normal_range FROM test_parameters WHERE test_parameters.id = order_parameters.parameter_id
            )
            WHERE normal_range_snapshot IS NULL
            ",
            [],
        )?;

        conn.pragma_update(None, "user_version", 3)?;
    }

    if version < 4 {
        conn.execute_batch(
            "
            CREATE INDEX IF NOT EXISTS idx_tests_active_name
            ON tests(is_active, name);

            CREATE INDEX IF NOT EXISTS idx_test_parameters_active_test
            ON test_parameters(test_id, is_active);

            CREATE INDEX IF NOT EXISTS idx_doctors_name
            ON doctors(name);
            ",
        )?;

        conn.pragma_update(None, "user_version", 4)?;
    }

    if version < 5 {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS payment_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                previous_paid_paise INTEGER,
                new_paid_paise INTEGER NOT NULL,
                total_amount_paise INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id)
            );

            CREATE INDEX IF NOT EXISTS idx_payment_history_order_id
            ON payment_history(order_id);
            ",
        )?;

        conn.pragma_update(None, "user_version", 5)?;
    }

    if version < 6 {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'staff',
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_users_username
            ON users(username);
            ",
        )?;

        conn.pragma_update(None, "user_version", 6)?;
    }

    if version < 7 {
        // Migrate legacy roles (technician, receptionist) → staff
        conn.execute(
            "UPDATE users SET role = 'staff' WHERE role IN ('technician', 'receptionist')",
            [],
        )?;

        conn.pragma_update(None, "user_version", 7)?;
    }

    if version < 8 {
        conn.execute_batch(
            "
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

            CREATE INDEX IF NOT EXISTS idx_audit_logs_user
            ON audit_logs(user_id);

            CREATE INDEX IF NOT EXISTS idx_audit_logs_table
            ON audit_logs(table_name, record_id);

            CREATE INDEX IF NOT EXISTS idx_audit_logs_created
            ON audit_logs(created_at);
            ",
        )?;

        conn.pragma_update(None, "user_version", 8)?;
    }

    if version < 9 {
        ensure_column(conn, "orders", "status TEXT DEFAULT 'Pending'")?;

        conn.pragma_update(None, "user_version", 9)?;
    }

    Ok(())
}
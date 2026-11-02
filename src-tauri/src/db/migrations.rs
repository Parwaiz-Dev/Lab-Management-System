use chrono::Datelike;
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

pub fn run_migrations(conn: &mut Connection) -> Result<()> {
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

    if version < 10 {
        // Drop REAL money columns — all reads use _paise INTEGER columns exclusively
        if table_has_column(conn, "orders", "total_amount")? {
            conn.execute("ALTER TABLE orders DROP COLUMN total_amount", [])?;
        }
        if table_has_column(conn, "orders", "discount_amount")? {
            conn.execute("ALTER TABLE orders DROP COLUMN discount_amount", [])?;
        }
        if table_has_column(conn, "orders", "paid_amount")? {
            conn.execute("ALTER TABLE orders DROP COLUMN paid_amount", [])?;
        }

        conn.pragma_update(None, "user_version", 10)?;
        version = 10;
    }

    if version < 11 {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS doctor_commissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL UNIQUE,
                doctor_id INTEGER,
                doctor_name_snapshot TEXT NOT NULL,
                eligible_amount_paise INTEGER NOT NULL,
                share_rate_basis_points INTEGER NOT NULL,
                commission_paise INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id),
                FOREIGN KEY (doctor_id) REFERENCES doctors(id)
            );

            CREATE TABLE IF NOT EXISTS doctor_commission_adjustments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                commission_id INTEGER NOT NULL,
                amount_delta_paise INTEGER NOT NULL,
                reason TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (commission_id) REFERENCES doctor_commissions(id)
            );

            CREATE TABLE IF NOT EXISTS doctor_commission_settlements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doctor_id INTEGER NOT NULL,
                doctor_name_snapshot TEXT NOT NULL,
                amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
                idempotency_key TEXT NOT NULL UNIQUE,
                note TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (doctor_id) REFERENCES doctors(id)
            );

            CREATE INDEX IF NOT EXISTS idx_doctor_commissions_doctor
            ON doctor_commissions(doctor_id, created_at);

            CREATE INDEX IF NOT EXISTS idx_doctor_commission_adjustments_commission
            ON doctor_commission_adjustments(commission_id, created_at);

            CREATE INDEX IF NOT EXISTS idx_doctor_commission_settlements_doctor
            ON doctor_commission_settlements(doctor_id, created_at);
            ",
        )?;

        conn.pragma_update(None, "user_version", 11)?;
        version = 11;
    }

    if version < 12 {
        // Migration 12: Upgrade local clinical reference ranges to standard Indian laboratory norms
        let updates = [
            (1, "Hemoglobin", "g/dL", "11.0-16.5"),
            (1, "Haemoglobin", "g/dL", "11.0-16.5"),
            (1, "Total WBC Count", "/uL", "4000-11000"),
            (1, "Total W.B.C Count", "/uL", "4000-11000"),
            (1, "RBC Count", "million/uL", "3.80-5.80"),
            (1, "Total R.B.C Count", "million/uL", "3.80-5.80"),
            (1, "Platelet Count", "/uL", "150000-450000"),
            (1, "Total Platelet Count", "/uL", "150000-450000"),
            (2, "Hemoglobin", "g/dL", "11.0-16.5"),
            (12, "TSH", "uIU/mL", "0.4-4.5"),
            (13, "TSH", "uIU/mL", "0.4-4.5"),
            (24, "Calcium", "mg/dL", "8.5-10.5"),
            (5, "Glucose Fasting", "mg/dL", "70-100"),
            (6, "Glucose PP", "mg/dL", "70-140"),
            (7, "Glucose Random", "mg/dL", "70-140"),
            (9, "Total Cholesterol", "mg/dL", "<200"),
            (9, "Triglycerides", "mg/dL", "<150"),
            (9, "HDL Cholesterol", "mg/dL", ">40"),
            (9, "LDL Cholesterol", "mg/dL", "<100"),
            (9, "VLDL Cholesterol", "mg/dL", "10-30"),
            (10, "Bilirubin Total", "mg/dL", "0.3-1.2"),
            (10, "Bilirubin Direct", "mg/dL", "0.0-0.3"),
            (10, "SGOT/AST", "U/L", "0-40"),
            (10, "SGPT/ALT", "U/L", "0-45"),
            (10, "Alkaline Phosphatase", "U/L", "44-147"),
            (10, "Total Protein", "g/dL", "6.0-8.3"),
            (10, "Albumin", "g/dL", "3.5-5.2"),
            (11, "Urea", "mg/dL", "15-45"),
            (11, "Creatinine", "mg/dL", "0.6-1.3"),
            (11, "Uric Acid", "mg/dL", "3.5-7.2"),
            (11, "BUN", "mg/dL", "7-20"),
            (67, "Magnesium", "mg/dL", "1.7-2.4"),
        ];

        for (test_id, name, unit, range) in updates {
            conn.execute(
                "UPDATE test_parameters
                 SET unit = ?1, normal_range = ?2
                 WHERE test_id = ?3 AND (name = ?4 OR name LIKE ?4 || '%')",
                rusqlite::params![unit, range, test_id, name],
            )?;

            conn.execute(
                "UPDATE order_parameters
                 SET unit_snapshot = ?1, normal_range_snapshot = ?2
                 WHERE parameter_name_snapshot = ?3 OR parameter_name_snapshot LIKE ?3 || '%'",
                rusqlite::params![unit, range, name],
            )?;
        }

        let cbc_params = [
            (1, "Neutrophils", "%", "40-75"),
            (1, "Lymphocytes", "%", "20-45"),
            (1, "Eosinophils", "%", "1-6"),
            (1, "Monocytes", "%", "2-8"),
            (1, "Basophils", "%", "0-1"),
            (1, "P.C.V (Haematocrit)", "%", "35-50"),
            (1, "M.C.V", "fL", "80-97"),
            (1, "M.C.H", "pg", "26.5-33.5"),
            (1, "M.C.H.C", "g/dL", "31.5-35.0"),
            (1, "R.D.W.", "%", "10-15"),
            (1, "AEC Count", "/cumm", "0-420"),
            (10, "Bilirubin Indirect", "mg/dL", "0.2-0.8"),
            (10, "Globulin", "g/dL", "2.0-3.5"),
            (10, "A:G Ratio", "", "1.2-2.2"),
            (11, "Sodium", "mmol/L", "135-145"),
            (11, "Potassium", "mmol/L", "3.5-5.1"),
            (11, "Chloride", "mmol/L", "98-107"),
            (14, "Reaction (pH)", "", "5.0-7.5"),
            (14, "Specific Gravity", "", "1.005-1.030"),
            (14, "Ketone Bodies", "", "Negative"),
            (14, "Bile Salts", "", "Negative"),
            (14, "Bile Pigments", "", "Negative"),
            (14, "Epithelial Cells", "/HPF", "0-5"),
            (14, "Casts", "", "Nil"),
            (14, "Crystals", "", "Nil"),
        ];

        for (test_id, name, unit, range) in cbc_params {
            conn.execute(
                "INSERT INTO test_parameters (test_id, name, unit, normal_range, is_active)
                 SELECT ?1, ?2, ?3, ?4, 1
                 WHERE EXISTS (
                     SELECT 1 FROM tests WHERE id = ?1
                 )
                 AND NOT EXISTS (
                     SELECT 1 FROM test_parameters WHERE test_id = ?1 AND name = ?2
                 )",
                rusqlite::params![test_id, name, unit, range],
            )?;
        }

        conn.pragma_update(None, "user_version", 12)?;
        version = 12;
    }

    if version < 13 {
        ensure_column(conn, "payment_history", "payment_method TEXT")?;

        conn.pragma_update(None, "user_version", 13)?;
        version = 13;
    }

    if version < 14 {
        ensure_column(conn, "orders", "status TEXT DEFAULT 'Pending'")?;
        conn.execute(
            "UPDATE orders SET status = 'Pending' WHERE status IS NULL OR TRIM(status) = ''",
            [],
        )?;

        conn.pragma_update(None, "user_version", 14)?;
        version = 14;
    }

    if version < 15 {
        ensure_column(conn, "orders", "order_number TEXT")?;

        let mut stmt = conn.prepare(
            "SELECT id, IFNULL(created_at, '') FROM orders ORDER BY created_at ASC, id ASC",
        )?;
        let orders: Vec<(i32, String)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .collect::<Result<Vec<_>, _>>()?;

        let current_year = chrono::Local::now().year();
        let mut yearly_order_seq: std::collections::HashMap<i32, i32> = std::collections::HashMap::new();
        let mut yearly_invoice_seq: std::collections::HashMap<i32, i32> = std::collections::HashMap::new();

        // 1. Scan existing valid order_number and invoice_no to find max seq per year
        for (order_id, created_at) in &orders {
            let year = if created_at.len() >= 4 {
                created_at[0..4].parse::<i32>().unwrap_or(current_year)
            } else {
                current_year
            };

            let existing_order_number: Option<String> = conn
                .query_row("SELECT order_number FROM orders WHERE id = ?1", [order_id], |row| row.get(0))
                .unwrap_or(None);

            if let Some(on) = existing_order_number.as_deref().filter(|s| !s.trim().is_empty()) {
                let prefix = format!("LAB-{}-", year);
                if on.starts_with(&prefix) && on.len() >= 10 {
                    if let Ok(seq) = on[prefix.len()..].parse::<i32>() {
                        let cur = yearly_order_seq.entry(year).or_insert(0);
                        if seq > *cur { *cur = seq; }
                    }
                }
            }

            let existing_invoice_no: Option<String> = conn
                .query_row("SELECT invoice_no FROM orders WHERE id = ?1", [order_id], |row| row.get(0))
                .unwrap_or(None);

            if let Some(inv) = existing_invoice_no.as_deref().filter(|s| !s.trim().is_empty()) {
                let prefix = format!("INV-{}-", year);
                if inv.starts_with(&prefix) && inv.len() >= 10 {
                    if let Ok(seq) = inv[prefix.len()..].parse::<i32>() {
                        let cur = yearly_invoice_seq.entry(year).or_insert(0);
                        if seq > *cur { *cur = seq; }
                    }
                }
            }
        }

        // 2. Backfill missing order_numbers and migrate legacy/missing invoice_nos
        for (order_id, created_at) in &orders {
            let year = if created_at.len() >= 4 {
                created_at[0..4].parse::<i32>().unwrap_or(current_year)
            } else {
                current_year
            };

            let existing_order_number: Option<String> = conn
                .query_row("SELECT order_number FROM orders WHERE id = ?1", [order_id], |row| row.get(0))
                .unwrap_or(None);

            if existing_order_number.as_deref().map(|s| s.trim().is_empty()).unwrap_or(true) {
                let seq = yearly_order_seq.entry(year).or_insert(0);
                *seq += 1;
                let new_order_number = format!("LAB-{}-{:04}", year, *seq);
                conn.execute(
                    "UPDATE orders SET order_number = ?1 WHERE id = ?2",
                    rusqlite::params![new_order_number, order_id],
                )?;
            }

            let existing_invoice_no: Option<String> = conn
                .query_row("SELECT invoice_no FROM orders WHERE id = ?1", [order_id], |row| row.get(0))
                .unwrap_or(None);

            let needs_invoice_migration = match existing_invoice_no.as_deref() {
                None => true,
                Some(inv) if inv.trim().is_empty() => true,
                Some(inv) => {
                    let is_standard = inv.starts_with("INV-")
                        && inv.len() >= 13
                        && inv.chars().nth(8) == Some('-')
                        && inv[4..8].chars().all(|c| c.is_ascii_digit())
                        && inv[9..].chars().all(|c| c.is_ascii_digit());
                    !is_standard
                }
            };

            if needs_invoice_migration {
                let seq = yearly_invoice_seq.entry(year).or_insert(0);
                *seq += 1;
                let new_invoice_no = format!("INV-{}-{:04}", year, *seq);
                conn.execute(
                    "UPDATE orders SET invoice_no = ?1 WHERE id = ?2",
                    rusqlite::params![new_invoice_no, order_id],
                )?;
            }
        }

        conn.execute_batch(
            "
            CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_invoice_no ON orders(invoice_no);
            ",
        )?;

        conn.pragma_update(None, "user_version", 15)?;
        version = 15;
    }


    // Safety check: ensure doctor commissions tables exist unconditionally
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS doctor_commissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL UNIQUE,
            doctor_id INTEGER,
            doctor_name_snapshot TEXT NOT NULL,
            eligible_amount_paise INTEGER NOT NULL,
            share_rate_basis_points INTEGER NOT NULL,
            commission_paise INTEGER NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (doctor_id) REFERENCES doctors(id)
        );

        CREATE TABLE IF NOT EXISTS doctor_commission_adjustments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            commission_id INTEGER NOT NULL,
            amount_delta_paise INTEGER NOT NULL,
            reason TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (commission_id) REFERENCES doctor_commissions(id)
        );

        CREATE TABLE IF NOT EXISTS doctor_commission_settlements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doctor_id INTEGER NOT NULL,
            doctor_name_snapshot TEXT NOT NULL,
            amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
            idempotency_key TEXT NOT NULL UNIQUE,
            note TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (doctor_id) REFERENCES doctors(id)
        );

        CREATE INDEX IF NOT EXISTS idx_doctor_commissions_doctor
        ON doctor_commissions(doctor_id, created_at);

        CREATE INDEX IF NOT EXISTS idx_doctor_commission_adjustments_commission
        ON doctor_commission_adjustments(commission_id, created_at);

        CREATE INDEX IF NOT EXISTS idx_doctor_commission_settlements_doctor
        ON doctor_commission_settlements(doctor_id, created_at);
        ",
    )?;

    Ok(())
}
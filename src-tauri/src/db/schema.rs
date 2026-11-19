use crate::db::connection::get_connection;
use crate::db::migrations::run_migrations;
use crate::db::seeds::seed_data;
use rusqlite::Result;

pub fn init_db() -> Result<()> {
    let mut conn = get_connection()?;
    init_db_on_connection(&mut conn)
}

pub fn init_db_on_connection(conn: &mut rusqlite::Connection) -> Result<()> {
    let table_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        [],
        |row| row.get(0),
    )?;

    if table_count == 0 {
        // Fresh database: create all tables and indexes in latest schema, then mark user_version at 21
        create_tables(conn)?;
        conn.pragma_update(None, "user_version", 21)?;
    } else {
        // Existing database: run migrations first so that new columns exist before create_tables index verification
        run_migrations(conn)?;
        create_tables(conn)?;
    }

    seed_data(conn)?;

    Ok(())
}

fn create_tables(conn: &rusqlite::Connection) -> Result<()> {
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
            order_date TEXT,
            daily_sequence INTEGER,
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

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            is_default INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS payment_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            previous_paid_paise INTEGER,
            new_paid_paise INTEGER NOT NULL,
            total_amount_paise INTEGER NOT NULL,
            payment_method TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id)
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'staff',
            is_active INTEGER DEFAULT 1,
            must_change_password INTEGER NOT NULL DEFAULT 0,
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

        CREATE INDEX IF NOT EXISTS idx_orders_order_number
        ON orders(order_number);

        CREATE INDEX IF NOT EXISTS idx_orders_order_date_order_number
        ON orders(order_date, order_number);

        CREATE INDEX IF NOT EXISTS idx_orders_order_date_seq
        ON orders(order_date, daily_sequence);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_invoice_no
        ON orders(invoice_no);

        CREATE INDEX IF NOT EXISTS idx_doctors_active
        ON doctors(is_active);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_single_default
        ON doctors(is_default) WHERE is_default = 1;

        CREATE INDEX IF NOT EXISTS idx_patients_created_id
        ON patients(created_at DESC, id DESC);

        CREATE INDEX IF NOT EXISTS idx_patients_phone
        ON patients(phone);
        ",
    )?;

    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_fresh_database_initialization() {
        let mut conn = Connection::open_in_memory().unwrap();

        // Fresh database initialization
        init_db_on_connection(&mut conn).unwrap();

        // Verify schema version is 21
        let version: i32 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(
            version, 21,
            "Fresh database must be initialized to version 21"
        );

        // Verify orders table has order_date and daily_sequence
        let has_order_date: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name = 'order_date'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .unwrap()
            > 0;
        assert!(has_order_date, "orders table must have order_date column");

        let has_daily_seq: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name = 'daily_sequence'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .unwrap()
            > 0;
        assert!(
            has_daily_seq,
            "orders table must have daily_sequence column"
        );

        // Verify users table has must_change_password
        let has_must_change: bool = conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('users') WHERE name = 'must_change_password'",
            [],
            |row| row.get::<_, i64>(0),
        ).unwrap() > 0;
        assert!(
            has_must_change,
            "users table must have must_change_password column"
        );

        // Verify doctors table has is_active and is_default
        let has_active: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('doctors') WHERE name = 'is_active'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .unwrap()
            > 0;
        assert!(has_active, "doctors table must have is_active column");

        let has_default: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('doctors') WHERE name = 'is_default'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .unwrap()
            > 0;
        assert!(has_default, "doctors table must have is_default column");

        // Verify indexes exist
        let idx_orders_non_unique: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_orders_order_date_order_number'",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(
            idx_orders_non_unique, 1,
            "idx_orders_order_date_order_number must exist"
        );

        let idx_orders_unique: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_orders_date_order_number'",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(
            idx_orders_unique, 0,
            "idx_orders_date_order_number must be dropped"
        );

        let idx_active: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_doctors_active'",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(idx_active, 1);

        let idx_default: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_doctors_single_default'",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(idx_default, 1);

        let idx_patients_created: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_patients_created_id'",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(
            idx_patients_created, 1,
            "idx_patients_created_id must exist"
        );

        let idx_patients_phone: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_patients_phone'",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(idx_patients_phone, 1, "idx_patients_phone must exist");

        // Verify idempotence: second run succeeds with no errors
        init_db_on_connection(&mut conn).unwrap();
        let version2: i32 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version2, 21);
    }

    #[test]
    fn test_existing_version_16_database_upgrade() {
        let mut conn = Connection::open_in_memory().unwrap();

        // Pre-create an existing database simulating Version 16
        conn.execute_batch(
            "
            PRAGMA user_version = 16;

            CREATE TABLE patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_code TEXT UNIQUE,
                name TEXT NOT NULL,
                referred_by TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                order_number TEXT,
                invoice_no TEXT,
                total_amount_paise INTEGER DEFAULT 0,
                discount_amount_paise INTEGER DEFAULT 0,
                paid_amount_paise INTEGER DEFAULT 0,
                status TEXT DEFAULT 'Pending',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            -- Version 16 doctors table: only id and name (no is_active, no is_default)
            CREATE TABLE doctors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            );

            -- Version 16 users table without must_change_password
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'staff',
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            INSERT INTO users (id, username, password_hash, role, is_active) VALUES (1, 'legacyadmin', 'hash123', 'admin', 1);
            INSERT INTO doctors (id, name) VALUES (1, 'Dr. Legacy One');
            INSERT INTO doctors (id, name) VALUES (2, 'Dr. Legacy Two');
            INSERT INTO patients (id, name, referred_by) VALUES (1, 'John Patient', 'Dr. Legacy One');
            ",
        ).unwrap();

        // Initialize database: MUST succeed without crashing on missing is_active column
        init_db_on_connection(&mut conn).unwrap();

        // Verify schema version advanced to 21
        let version: i32 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(
            version, 21,
            "Existing database must be upgraded to version 21"
        );

        // Verify users table gained must_change_password column and legacy user defaulted to 0
        let must_change: i32 = conn
            .query_row(
                "SELECT must_change_password FROM users WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            must_change, 0,
            "Existing user must default to must_change_password = 0"
        );

        // Verify existing doctor records were preserved with is_active = 1 and is_default = 0
        let doc_one_preserved: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM doctors WHERE id = 1 AND name = 'Dr. Legacy One' AND is_active = 1 AND is_default = 0)",
            [],
            |row| row.get(0),
        ).unwrap();
        assert!(
            doc_one_preserved,
            "Dr. Legacy One must be preserved with is_active = 1 and is_default = 0"
        );

        let doc_two_preserved: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM doctors WHERE id = 2 AND name = 'Dr. Legacy Two' AND is_active = 1 AND is_default = 0)",
            [],
            |row| row.get(0),
        ).unwrap();
        assert!(
            doc_two_preserved,
            "Dr. Legacy Two must be preserved with is_active = 1 and is_default = 0"
        );

        // Verify historical patient referral is preserved
        let ref_by: String = conn
            .query_row("SELECT referred_by FROM patients WHERE id = 1", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(ref_by, "Dr. Legacy One");

        // Verify single default doctor constraint is active and enforced
        conn.execute("UPDATE doctors SET is_default = 1 WHERE id = 1", [])
            .unwrap();
        let duplicate_default = conn.execute("UPDATE doctors SET is_default = 1 WHERE id = 2", []);
        assert!(
            duplicate_default.is_err(),
            "Partial unique index must enforce single default doctor"
        );

        // Verify idempotence: second run succeeds with no errors
        init_db_on_connection(&mut conn).unwrap();
        let version2: i32 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version2, 21);
    }

    #[test]
    fn test_init_db_file_based_fresh_and_v16() {
        let temp_dir = std::env::temp_dir().join(format!(
            "localims_test_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&temp_dir).unwrap();

        // 1. Fresh file-based database
        let fresh_db_path = temp_dir.join("fresh_lab.db");
        std::env::set_var("DB_PATH", fresh_db_path.to_str().unwrap());

        // Startup application database initialization
        init_db().expect("init_db must succeed on fresh database");

        // Verify fresh database state
        {
            let conn = Connection::open(&fresh_db_path).unwrap();
            let v: i32 = conn
                .query_row("PRAGMA user_version", [], |row| row.get(0))
                .unwrap();
            assert_eq!(v, 21, "Fresh database version must be 21");

            let has_active: bool = conn
                .query_row(
                    "SELECT COUNT(*) FROM pragma_table_info('doctors') WHERE name = 'is_active'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .unwrap()
                > 0;
            assert!(has_active);

            let has_default: bool = conn
                .query_row(
                    "SELECT COUNT(*) FROM pragma_table_info('doctors') WHERE name = 'is_default'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .unwrap()
                > 0;
            assert!(has_default);
        }

        // 2. Existing Version 16 file-based database copy
        let v16_db_path = temp_dir.join("v16_lab.db");
        {
            let conn = Connection::open(&v16_db_path).unwrap();
            conn.execute_batch(
                "
                PRAGMA user_version = 16;

                CREATE TABLE patients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_code TEXT UNIQUE,
                    name TEXT NOT NULL,
                    referred_by TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id INTEGER NOT NULL,
                    order_number TEXT,
                    invoice_no TEXT,
                    total_amount_paise INTEGER DEFAULT 0,
                    discount_amount_paise INTEGER DEFAULT 0,
                    paid_amount_paise INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'Pending',
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE doctors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL
                );

                INSERT INTO doctors (id, name) VALUES (1, 'Dr. Production Senior');
                INSERT INTO doctors (id, name) VALUES (2, 'Dr. Production Associate');
                INSERT INTO patients (id, name, referred_by) VALUES (1, 'Jane Patient', 'Dr. Production Senior');
                ",
            ).unwrap();
        }

        std::env::set_var("DB_PATH", v16_db_path.to_str().unwrap());

        // Startup application database initialization on Version 16 DB: MUST succeed without crashing!
        init_db().expect("init_db must cleanly upgrade Version 16 database without error");

        // Verify upgraded database state
        {
            let conn = Connection::open(&v16_db_path).unwrap();
            let v: i32 = conn
                .query_row("PRAGMA user_version", [], |row| row.get(0))
                .unwrap();
            assert_eq!(v, 21, "Upgraded database version must be 21");

            // Verify must_change_password column added
            let has_must_change: bool = conn.query_row(
                "SELECT COUNT(*) FROM pragma_table_info('users') WHERE name = 'must_change_password'",
                [],
                |row| row.get::<_, i64>(0),
            ).unwrap() > 0;
            assert!(has_must_change);

            // Verify both existing doctors preserved
            let doc_one: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM doctors WHERE id = 1 AND name = 'Dr. Production Senior' AND is_active = 1 AND is_default = 0)",
                [],
                |row| row.get(0),
            ).unwrap();
            assert!(doc_one);

            let doc_two: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM doctors WHERE id = 2 AND name = 'Dr. Production Associate' AND is_active = 1 AND is_default = 0)",
                [],
                |row| row.get(0),
            ).unwrap();
            assert!(doc_two);

            // Verify patient referral preserved
            let ref_by: String = conn
                .query_row("SELECT referred_by FROM patients WHERE id = 1", [], |row| {
                    row.get(0)
                })
                .unwrap();
            assert_eq!(ref_by, "Dr. Production Senior");

            // Verify single default enforced
            conn.execute("UPDATE doctors SET is_default = 1 WHERE id = 1", [])
                .unwrap();
            let dup = conn.execute("UPDATE doctors SET is_default = 1 WHERE id = 2", []);
            assert!(dup.is_err());
        }

        // Cleanup temp files and reset DB_PATH
        std::env::remove_var("DB_PATH");
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}

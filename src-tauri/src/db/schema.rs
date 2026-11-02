use crate::db::connection::get_connection;
use crate::db::migrations::run_migrations;
use crate::db::seeds::seed_data;
use rusqlite::Result;

pub fn init_db() -> Result<()> {
    let mut conn = get_connection()?;

    create_tables(&conn)?;
    run_migrations(&mut conn)?;
    seed_data(&conn)?;

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
            name TEXT UNIQUE NOT NULL
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

        CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number
        ON orders(order_number);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_invoice_no
        ON orders(invoice_no);
        ",
    )?;

    Ok(())
}
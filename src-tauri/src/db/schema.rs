use crate::db::connection::get_connection;
use rusqlite::Result;

pub fn init_db() -> Result<()> {
    let conn = get_connection();

    create_tables(&conn)?;
    run_migrations(&conn)?;
    clean_duplicates(&conn)?;
    seed_data(&conn)?;

    Ok(())
}

//
// ----------------------------
// 🧱 CREATE TABLES
// ----------------------------
//
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
            name TEXT UNIQUE,
            price REAL
        );

        CREATE TABLE IF NOT EXISTS test_parameters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_id INTEGER,
            name TEXT,
            unit TEXT,
            normal_range TEXT,
            UNIQUE(test_id, name)
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            total_amount REAL,
            paid_amount REAL DEFAULT 0,
            invoice_no TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS order_tests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            test_id INTEGER,
            UNIQUE(order_id, test_id)
        );

        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            parameter_id INTEGER,
            value TEXT,
            UNIQUE(order_id, parameter_id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE
        );
        ",
    )?;

    Ok(())
}

//
// ----------------------------
// 🔄 MIGRATIONS (SAFE)
// ----------------------------
//
fn run_migrations(conn: &rusqlite::Connection) -> Result<()> {
    // Safe add (ignore if exists)
    conn.execute("ALTER TABLE orders ADD COLUMN paid_amount REAL DEFAULT 0", [])
        .ok();

    conn.execute("ALTER TABLE orders ADD COLUMN invoice_no TEXT", [])
        .ok();

    Ok(())
}

//
// ----------------------------
// 🧹 CLEAN DUPLICATES
// ----------------------------
//
fn clean_duplicates(conn: &rusqlite::Connection) -> Result<()> {
    conn.execute(
        "
        DELETE FROM order_tests
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM order_tests
            GROUP BY order_id, test_id
        )
        ",
        [],
    )?;

    conn.execute(
        "
        DELETE FROM results
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM results
            GROUP BY order_id, parameter_id
        )
        ",
        [],
    )?;

    Ok(())
}

//
// ----------------------------
// 🌱 SEED DEFAULT DATA
// ----------------------------
//
fn seed_data(conn: &rusqlite::Connection) -> Result<()> {
    // Tests
    conn.execute(
        "INSERT OR IGNORE INTO tests (id, name, price)
         VALUES (1, 'CBC', 200)",
        [],
    )?;

    // Parameters
    conn.execute(
        "
        INSERT OR IGNORE INTO test_parameters (test_id, name, unit, normal_range)
        VALUES 
        (1, 'Hemoglobin', 'g/dL', '12-16'),
        (1, 'WBC', '/µL', '4000-11000'),
        (1, 'RBC', 'million/µL', '4.5-5.9'),
        (1, 'Platelets', '/µL', '150000-450000')
        ",
        [],
    )?;

    // Settings
    conn.execute(
        "
        INSERT OR IGNORE INTO settings (key, value) VALUES
        ('lab_name', 'Your Lab'),
        ('lab_address', 'Your Address'),
        ('doctor_share', '0.4'),
        ('lab_logo', '')
        ",
        [],
    )?;

    // Doctors
    conn.execute(
        "INSERT OR IGNORE INTO doctors (name) VALUES ('Dr Default')",
        [],
    )?;

    Ok(())
}
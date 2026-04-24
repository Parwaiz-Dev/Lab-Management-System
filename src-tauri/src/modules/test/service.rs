use crate::db::connection::get_connection;
use rusqlite::{params, Result, OptionalExtension};

//
// 🧾 CREATE ORDER
//
pub fn create_order(patient_id: i32, test_ids: Vec<i32>, total_amount: f64) -> Result<()> {
    let conn = get_connection();

    // ✅ always set paid_amount = 0
    conn.execute(
        "INSERT INTO orders (patient_id, total_amount, paid_amount)
         VALUES (?1, ?2, 0)",
        params![patient_id, total_amount],
    )?;

    let order_id = conn.last_insert_rowid();

    for test_id in test_ids {
        conn.execute(
            "INSERT INTO order_tests (order_id, test_id)
             VALUES (?1, ?2)",
            params![order_id, test_id],
        )?;
    }

    Ok(())
}



pub fn get_tests() -> rusqlite::Result<Vec<(i32, String, f64)>> {
    let conn = get_connection();

    let mut stmt = conn.prepare(
        "SELECT id, name, price FROM tests"
    )?;

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
        ))
    })?;

    Ok(rows.filter_map(Result::ok).collect())
}


pub fn get_test_parameters(test_id: i32)
    -> rusqlite::Result<Vec<(i32, String, String, String)>>
{
    let conn = get_connection();

    let mut stmt = conn.prepare(
        "SELECT id, name, unit, normal_range
         FROM test_parameters
         WHERE test_id = ?1"
    )?;

    let rows = stmt.query_map([test_id], |row| {
        Ok((
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
        ))
    })?;

    Ok(rows.filter_map(Result::ok).collect())
}

//
// 📊 GET ORDERS (DASHBOARD)
//
pub fn get_orders() -> Result<Vec<(i32, String, String, f64, f64, String)>> {
    let conn = get_connection();

    let mut stmt = conn.prepare(
        "SELECT 
            o.id,
            p.name,
            GROUP_CONCAT(t.name),
            o.total_amount,
            IFNULL(o.paid_amount, 0),
            CASE
                WHEN IFNULL(o.paid_amount, 0) = 0 THEN 'Pending'
                WHEN IFNULL(o.paid_amount, 0) < o.total_amount THEN 'Partial'
                ELSE 'Completed'
            END
         FROM orders o
         JOIN patients p ON p.id = o.patient_id
         LEFT JOIN order_tests ot ON ot.order_id = o.id
         LEFT JOIN tests t ON t.id = ot.test_id
         GROUP BY o.id
         ORDER BY o.id DESC"
    )?;

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i32>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, f64>(3)?,
            row.get::<_, f64>(4)?,
            row.get::<_, String>(5)?,
        ))
    })?;

    Ok(rows.filter_map(Result::ok).collect())
}

//
// 📊 REPORT STATUS
//
pub fn get_order_status(order_id: i32) -> Result<String> {
    let conn = get_connection();

    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM test_parameters tp
         JOIN order_tests ot ON ot.test_id = tp.test_id
         WHERE ot.order_id = ?1",
        [order_id],
        |row| row.get(0),
    )?;

    let filled: i32 = conn.query_row(
        "SELECT COUNT(*) FROM results WHERE order_id = ?1",
        [order_id],
        |row| row.get(0),
    )?;

    if filled == 0 {
        Ok("Pending".into())
    } else if filled < count {
        Ok("Partial".into())
    } else {
        Ok("Completed".into())
    }
}

//
// 💰 UPDATE PAYMENT
//
pub fn update_payment(order_id: i32, paid_amount: f64) -> Result<()> {
    let conn = get_connection();

    conn.execute(
        "UPDATE orders
         SET paid_amount = ?1
         WHERE id = ?2",
        params![paid_amount, order_id],
    )?;

    Ok(())
}

//
// 💰 DAILY SUMMARY
//
pub fn get_daily_summary() -> Result<(f64, f64, f64)> {
    let conn = get_connection();

    let total: f64 = conn.query_row(
        "SELECT IFNULL(SUM(total_amount), 0) FROM orders",
        [],
        |row| row.get(0),
    )?;

    let paid: f64 = conn.query_row(
        "SELECT IFNULL(SUM(paid_amount), 0) FROM orders",
        [],
        |row| row.get(0),
    )?;

    let pending = total - paid;

    Ok((total, paid, pending))
}

//
// ⚙️ SETTINGS
//
pub fn get_setting(key: String) -> Result<String> {
    let conn = get_connection();

    let val: Option<String> = conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        [key],
        |row| row.get(0),
    ).optional()?;

    Ok(val.unwrap_or_default())
}

pub fn set_setting(key: String, value: String) -> Result<()> {
    let conn = get_connection();

    conn.execute(
        "INSERT INTO settings (key, value)
         VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;

    Ok(())
}

//
// 🧾 INVOICE NUMBER
//
pub fn generate_invoice_no(order_id: i32) -> String {
    format!("INV-{}", order_id)
}

pub fn ensure_invoice(order_id: i32) -> Result<String> {
    let conn = get_connection();

    let existing: Option<String> = conn.query_row(
        "SELECT invoice_no FROM orders WHERE id = ?1",
        [order_id],
        |row| row.get(0),
    ).optional()?;

    if let Some(inv) = existing {
        return Ok(inv);
    }

    let invoice = generate_invoice_no(order_id);

    conn.execute(
        "UPDATE orders SET invoice_no = ?1 WHERE id = ?2",
        params![invoice, order_id],
    )?;

    Ok(invoice)
}

//
// 🧾 RECEIPT DATA
//
pub fn get_receipt(order_id: i32)
    -> Result<(String, String, f64, f64, Vec<(String, f64)>)>
{
    let conn = get_connection();

    // 👤 patient
    let patient: String = conn.query_row(
        "SELECT p.name
         FROM orders o
         JOIN patients p ON p.id = o.patient_id
         WHERE o.id = ?1",
        [order_id],
        |row| row.get(0),
    )?;

    // 💰 totals
    let (total, paid): (f64, f64) = conn.query_row(
        "SELECT total_amount, IFNULL(paid_amount, 0)
         FROM orders WHERE id = ?1",
        [order_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;

    // 🧾 invoice
    let invoice: String = conn.query_row(
        "SELECT invoice_no FROM orders WHERE id = ?1",
        [order_id],
        |row| row.get::<_, Option<String>>(0),
    )?
    .unwrap_or_else(|| format!("INV-{}", order_id));

    // 🧪 tests
    let mut stmt = conn.prepare(
        "SELECT t.name, t.price
         FROM order_tests ot
         JOIN tests t ON t.id = ot.test_id
         WHERE ot.order_id = ?1"
    )?;

    let tests = stmt
        .query_map([order_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, f64>(1)?,
            ))
        })?
        .filter_map(Result::ok)
        .collect();

    Ok((patient, invoice, total, paid, tests))
}

// 🧪 SAVE RESULT
pub fn save_result(order_id: i32, parameter_id: i32, value: String) -> Result<()> {
    let conn = get_connection();

    conn.execute(
        "INSERT INTO results (order_id, parameter_id, value)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(order_id, parameter_id)
         DO UPDATE SET value = excluded.value",
        params![order_id, parameter_id, value],
    )?;

    Ok(())
}

// 📊 PARAMETERS BY ORDER
pub fn get_parameters_by_order(order_id: i32)
    -> Result<Vec<(i32, String, String, String)>>
{
    let conn = get_connection();

    let mut stmt = conn.prepare(
        "SELECT tp.id, tp.name, tp.unit, tp.normal_range
         FROM order_tests ot
         JOIN test_parameters tp ON tp.test_id = ot.test_id
         WHERE ot.order_id = ?1"
    )?;

    let rows = stmt.query_map([order_id], |row| {
        Ok((
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
        ))
    })?;

    Ok(rows.filter_map(Result::ok).collect())
}

// 📊 RESULTS BY ORDER
pub fn get_results_by_order(order_id: i32)
    -> Result<Vec<(i32, String)>>
{
    let conn = get_connection();

    let mut stmt = conn.prepare(
        "SELECT parameter_id, value FROM results WHERE order_id = ?1"
    )?;

    let rows = stmt.query_map([order_id], |row| {
        Ok((
            row.get(0)?,
            row.get(1)?,
        ))
    })?;

    Ok(rows.filter_map(Result::ok).collect())
}

// 📄 REPORT
pub fn get_report(order_id: i32)
    -> Result<Vec<(String, String, String, String)>>
{
    let conn = get_connection();

    let mut stmt = conn.prepare(
        "SELECT tp.name, r.value, tp.unit, tp.normal_range
         FROM results r
         JOIN test_parameters tp ON tp.id = r.parameter_id
         WHERE r.order_id = ?1"
    )?;

    let rows = stmt.query_map([order_id], |row| {
        Ok((
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
        ))
    })?;

    Ok(rows.filter_map(Result::ok).collect())
}

// 👤 PATIENT BY ORDER
pub fn get_patient_by_order(order_id: i32)
    -> Result<(String, i32, String)>
{
    let conn = get_connection();

    let res = conn.query_row(
        "SELECT p.name, p.age_value, p.gender
         FROM orders o
         JOIN patients p ON p.id = o.patient_id
         WHERE o.id = ?1",
        [order_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;

    Ok(res)
}


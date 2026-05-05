/// 🧪 Test & Order Service Module
/// Core business logic for:
/// - Test order creation and management
/// - Result entry and retrieval  
/// - Payment tracking
/// - Report generation
/// - Financial summaries
/// 
/// Database Tables:
/// - orders: Main order records
/// - order_tests: Line items linking orders to tests
/// - tests: Test definitions
/// - test_parameters: Measurements within tests
/// - results: Test result values
/// - settings: Key-value configuration

use crate::db::connection::get_connection;
use crate::errors::{AppError, AppResult};
use crate::utils::validation::{validate_amount, validate_test_ids, validate_parameter_value, validate_positive_id};
use rusqlite::{params, OptionalExtension};
use serde::Serialize;

#[derive(Serialize)]
pub struct TestParameterDto {
    pub id: i32,
    pub name: String,
    pub unit: String,
    pub normal_range: String,
}

#[derive(Serialize)]
pub struct TestCatalogItem {
    pub id: i32,
    pub name: String,
    pub price: f64,
    pub parameters: Vec<TestParameterDto>,
}

#[derive(Serialize)]
pub struct OrderParameterDto {
    pub id: i32,
    pub test_id: i32,
    pub test_name: String,
    pub name: String,
    pub unit: String,
    pub normal_range: String,
}

#[derive(Serialize)]
pub struct ReportRow {
    pub test_name: String,
    pub parameter_name: String,
    pub value: String,
    pub unit: String,
    pub normal_range: String,
}

#[derive(Serialize)]
pub struct ReceiptLine {
    pub test_name: String,
    pub price: f64,
    pub parameter_names: Vec<String>,
}

#[derive(Serialize)]
pub struct ReportPatientInfo {
    pub patient_name: String,
    pub patient_code: String,
    pub age_value: i32,
    pub age_unit: String,
    pub gender: String,
    pub phone: String,
    pub referred_by: String,
    pub invoice_no: String,
    pub order_date: String,
}

// ============================================================================
// 🧾 ORDER CREATION
// ============================================================================

/// Create a new test order
/// 
/// Flow:
/// 1. Insert order header (patient_id, total_amount, initial paid_amount=0)
/// 2. Insert order line items (one per test)
/// 
/// Parameters:
/// - patient_id: Valid patient record ID
/// - test_ids: List of test IDs to include (at least 1)
/// - total_amount: Total order amount (non-negative)
/// 
/// Returns:
/// - Error if validation fails or database error
/// 
/// Validations:
/// - Patient ID must be positive
/// - At least one test must be selected
/// - Total amount must be non-negative
pub fn create_order(
    patient_id: i32,
    test_ids: Vec<i32>,
    parameter_ids: Vec<i32>,
    total_amount: f64,
    discount_amount: f64,
) -> AppResult<i32> {
    // ✅ Validate inputs
    validate_positive_id(patient_id, "patient_id")?;
    validate_test_ids(&test_ids)?;
    validate_amount(total_amount)?;
    validate_amount(discount_amount)?;

    let conn = get_connection();

    // 📝 Insert order header (paid_amount starts at 0)
    conn.execute(
        "INSERT INTO orders (patient_id, total_amount, discount_amount, paid_amount)
         VALUES (?1, ?2, ?3, 0)",
        params![patient_id, total_amount, discount_amount],
    )
    .map_err(AppError::from)?;

    let order_id = conn.last_insert_rowid() as i32;

    // 📝 Insert order line items
    for test_id in &test_ids {
        conn.execute(
            "INSERT INTO order_tests (order_id, test_id)
             VALUES (?1, ?2)",
            params![order_id, test_id],
        )
        .map_err(AppError::from)?;
    }

    let selected_parameters = if parameter_ids.is_empty() {
        let placeholders = test_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT id FROM test_parameters WHERE test_id IN ({})",
            placeholders
        );
        let mut stmt = conn.prepare(&sql).map_err(AppError::from)?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(test_ids.iter()), |row| row.get::<_, i32>(0))
            .map_err(AppError::from)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)?
    } else {
        parameter_ids
    };

    for parameter_id in selected_parameters {
        conn.execute(
            "INSERT OR IGNORE INTO order_parameters (order_id, parameter_id)
             SELECT ?1, tp.id
             FROM test_parameters tp
             JOIN order_tests ot ON ot.test_id = tp.test_id AND ot.order_id = ?1
             WHERE tp.id = ?2",
            params![order_id, parameter_id],
        )
        .map_err(AppError::from)?;
    }

    log::info!("Created order {} for patient {} with amount {}", order_id, patient_id, total_amount);
    Ok(order_id)
}

// ============================================================================
// 🧪 TEST RETRIEVAL
// ============================================================================

/// Get all available tests in the system
/// 
/// Returns:
/// - Vector of (id, name, price) tuples
/// - Sorted by ID
/// 
/// Used for:
/// - Test selection dropdown during order creation
/// - Test catalog display
pub fn get_tests() -> AppResult<Vec<TestCatalogItem>> {
    let conn = get_connection();

    let mut stmt = conn
        .prepare("SELECT id, name, price FROM tests ORDER BY id ASC")
        .map_err(AppError::from)?;

    let rows = stmt
        .query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .map_err(AppError::from)?;

    let tests: Vec<(i32, String, f64)> = rows
        .map(|r| r.map_err(AppError::from))
        .collect::<AppResult<Vec<_>>>()?;

    tests
        .into_iter()
        .map(|(id, name, price)| {
            Ok(TestCatalogItem {
                id,
                name,
                price,
                parameters: get_test_parameters(id)?,
            })
        })
        .collect()
}

pub fn add_test(name: String, price: f64) -> AppResult<i32> {
    validate_test_name(&name)?;
    validate_amount(price)?;

    let conn = get_connection();

    conn.execute(
        "INSERT INTO tests (name, price) VALUES (?1, ?2)",
        params![name.trim(), price],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            AppError::DuplicateError(format!("Test '{}' already exists", name.trim()))
        } else {
            AppError::from(e)
        }
    })?;

    Ok(conn.last_insert_rowid() as i32)
}

pub fn update_test(test_id: i32, name: String, price: f64) -> AppResult<()> {
    validate_positive_id(test_id, "test_id")?;
    validate_test_name(&name)?;
    validate_amount(price)?;

    let conn = get_connection();

    let updated = conn
        .execute(
            "UPDATE tests SET name = ?1, price = ?2 WHERE id = ?3",
            params![name.trim(), price, test_id],
        )
        .map_err(|e| {
            if e.to_string().contains("UNIQUE") {
                AppError::DuplicateError(format!("Test '{}' already exists", name.trim()))
            } else {
                AppError::from(e)
            }
        })?;

    if updated == 0 {
        return Err(AppError::NotFound(format!("Test {} not found", test_id)));
    }

    Ok(())
}

pub fn delete_test(test_id: i32) -> AppResult<()> {
    validate_positive_id(test_id, "test_id")?;

    let conn = get_connection();
    conn.execute(
        "DELETE FROM order_parameters
         WHERE parameter_id IN (SELECT id FROM test_parameters WHERE test_id = ?1)",
        [test_id],
    )
    .map_err(AppError::from)?;
    conn.execute("DELETE FROM test_parameters WHERE test_id = ?1", [test_id])
        .map_err(AppError::from)?;
    conn.execute("DELETE FROM tests WHERE id = ?1", [test_id])
        .map_err(AppError::from)?;

    Ok(())
}

fn validate_test_name(name: &str) -> AppResult<()> {
    let trimmed = name.trim();

    if trimmed.len() < 2 {
        return Err(AppError::ValidationError(
            "Test name must be at least 2 characters".to_string(),
        ));
    }

    if trimmed.len() > 120 {
        return Err(AppError::ValidationError(
            "Test name must be less than 120 characters".to_string(),
        ));
    }

    Ok(())
}

/// Get parameters for a specific test
/// 
/// Parameters:
/// - test_id: ID of the test
/// 
/// Returns:
/// - Vector of (id, name, unit, normal_range) tuples
/// 
/// Example return:
/// ```
/// [
///   (1, "Hemoglobin", "g/dL", "12-16"),
///   (2, "RBC Count", "cells/μL", "4.5-5.5M"),
/// ]
/// ```
pub fn get_test_parameters(test_id: i32) -> AppResult<Vec<TestParameterDto>> {
    validate_positive_id(test_id, "test_id")?;
    
    let conn = get_connection();

    let mut stmt = conn
        .prepare(
            "SELECT id, name, unit, normal_range
         FROM test_parameters
         WHERE test_id = ?1
         ORDER BY id ASC"
        )
        .map_err(AppError::from)?;

    let rows = stmt
        .query_map([test_id], |row| {
            Ok(TestParameterDto {
                id: row.get(0)?,
                name: row.get(1)?,
                unit: row.get(2)?,
                normal_range: row.get(3)?,
            })
        })
        .map_err(AppError::from)?;

    let results: AppResult<Vec<_>> = rows.map(|r| r.map_err(AppError::from)).collect();
    results
}

pub fn add_test_parameter(
    test_id: i32,
    name: String,
    unit: String,
    normal_range: String,
) -> AppResult<i32> {
    validate_positive_id(test_id, "test_id")?;
    validate_test_name(&name)?;

    let conn = get_connection();
    conn.execute(
        "INSERT INTO test_parameters (test_id, name, unit, normal_range)
         VALUES (?1, ?2, ?3, ?4)",
        params![test_id, name.trim(), unit.trim(), normal_range.trim()],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            AppError::DuplicateError(format!("Parameter '{}' already exists", name.trim()))
        } else {
            AppError::from(e)
        }
    })?;

    Ok(conn.last_insert_rowid() as i32)
}

pub fn update_test_parameter(
    parameter_id: i32,
    name: String,
    unit: String,
    normal_range: String,
) -> AppResult<()> {
    validate_positive_id(parameter_id, "parameter_id")?;
    validate_test_name(&name)?;

    let conn = get_connection();
    let updated = conn
        .execute(
            "UPDATE test_parameters
             SET name = ?1, unit = ?2, normal_range = ?3
             WHERE id = ?4",
            params![name.trim(), unit.trim(), normal_range.trim(), parameter_id],
        )
        .map_err(AppError::from)?;

    if updated == 0 {
        return Err(AppError::NotFound(format!("Parameter {} not found", parameter_id)));
    }

    Ok(())
}

pub fn delete_test_parameter(parameter_id: i32) -> AppResult<()> {
    validate_positive_id(parameter_id, "parameter_id")?;

    let conn = get_connection();
    conn.execute("DELETE FROM order_parameters WHERE parameter_id = ?1", [parameter_id])
        .map_err(AppError::from)?;
    conn.execute("DELETE FROM results WHERE parameter_id = ?1", [parameter_id])
        .map_err(AppError::from)?;
    conn.execute("DELETE FROM test_parameters WHERE id = ?1", [parameter_id])
        .map_err(AppError::from)?;

    Ok(())
}

// ============================================================================
// 📊 DASHBOARD & ORDER LIST
// ============================================================================

/// Get all orders with aggregated information for dashboard display
/// 
/// Returns:
/// - Vector of tuples: (order_id, patient_name, test_names, total_amount, paid_amount, payment_status)
/// - Sorted newest first
/// 
/// Status Logic:
/// - Pending: paid_amount = 0
/// - Partial: 0 < paid_amount < total_amount
/// - Completed: paid_amount >= total_amount
/// 
/// Performance Note:
/// - Uses GROUP_CONCAT which may be slow with many tests per order
/// - Consider pagination for large datasets
pub fn get_orders() -> AppResult<Vec<(i32, String, String, f64, f64, String)>> {
    let conn = get_connection();

    let mut stmt = conn
        .prepare(
            "SELECT 
            o.id,
            p.name,
            COALESCE(GROUP_CONCAT(t.name, ', '), 'No tests'),
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
        )
        .map_err(AppError::from)?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i32>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, f64>(4)?,
                row.get::<_, String>(5)?,
            ))
        })
        .map_err(AppError::from)?;

    let results: AppResult<Vec<_>> = rows.map(|r| r.map_err(AppError::from)).collect();
    results
}

// ============================================================================
// 📊 ORDER STATUS & COMPLETION TRACKING
// ============================================================================

/// Get the completion status of an order's result entry
/// 
/// Status Logic:
/// - Pending: No results entered yet
/// - Partial: Some parameters have values
/// - Completed: All parameters have values
/// 
/// Parameters:
/// - order_id: ID of the order to check
/// 
/// Returns:
/// - Status string: "Pending", "Partial", or "Completed"
pub fn get_order_status(order_id: i32) -> AppResult<String> {
    validate_positive_id(order_id, "order_id")?;
    
    let conn = get_connection();

    // Count total parameters in all tests for this order
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM order_parameters WHERE order_id = ?1",
            [order_id],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    // Count filled results
    let filled: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM results WHERE order_id = ?1",
            [order_id],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    // Determine status
    let status = if filled == 0 {
        "Pending"
    } else if filled < count {
        "Partial"
    } else {
        "Completed"
    };

    Ok(status.to_string())
}

// ============================================================================
// 💰 PAYMENT MANAGEMENT
// ============================================================================

/// Update payment amount for an order
/// 
/// Parameters:
/// - order_id: ID of the order
/// - paid_amount: New paid amount (non-negative)
/// 
/// Validations:
/// - paid_amount must be non-negative
/// - Note: Does NOT validate against total_amount (UI should handle)
/// 
/// Use Cases:
/// - Record partial payment
/// - Record full payment
/// - Correct previous payment entry
pub fn update_payment(order_id: i32, paid_amount: f64) -> AppResult<()> {
    validate_positive_id(order_id, "order_id")?;
    validate_amount(paid_amount)?;

    let conn = get_connection();

    conn.execute(
        "UPDATE orders
         SET paid_amount = ?1
         WHERE id = ?2",
        params![paid_amount, order_id],
    )
    .map_err(AppError::from)?;

    log::info!("Updated payment for order {} to {}", order_id, paid_amount);
    Ok(())
}

// ============================================================================
// 💰 FINANCIAL REPORTING
// ============================================================================

/// Get daily/total financial summary
/// 
/// Returns:
/// - (total_revenue, paid_amount, pending_amount)
/// - All amounts in currency (e.g., INR)
/// 
/// Used for:
/// - Dashboard summary cards
/// - Daily closing reports
pub fn get_daily_summary() -> AppResult<(f64, f64, f64)> {
    let conn = get_connection();

    // Total revenue from all orders
    let total: f64 = conn
        .query_row(
            "SELECT IFNULL(SUM(total_amount), 0) FROM orders",
            [],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    // Total collected payments
    let paid: f64 = conn
        .query_row(
            "SELECT IFNULL(SUM(paid_amount), 0) FROM orders",
            [],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    // Calculate pending (difference)
    let pending = total - paid;

    log::debug!("Daily summary - Total: {}, Paid: {}, Pending: {}", total, paid, pending);
    Ok((total, paid, pending))
}

// ============================================================================
// ⚙️ SETTINGS (Key-Value Store)
// ============================================================================

/// Get a setting value by key
/// 
/// Parameters:
/// - key: Setting key (e.g., "lab_name", "default_currency")
/// 
/// Returns:
/// - Setting value or empty string if not found
/// 
/// Note:
/// - Used for storing system configuration
/// - Non-existent keys return empty string (not an error)
pub fn get_setting(key: String) -> AppResult<String> {
    let conn = get_connection();

    let val: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [key],
            |row| row.get(0),
        )
        .optional()
        .map_err(AppError::from)?;

    Ok(val.unwrap_or_default())
}

/// Set or update a setting value
/// 
/// Parameters:
/// - key: Setting key
/// - value: Setting value
/// 
/// Behavior:
/// - If key exists: updates value
/// - If key doesn't exist: creates new record (INSERT OR REPLACE)
pub fn set_setting(key: String, value: String) -> AppResult<()> {
    let conn = get_connection();

    conn.execute(
        "INSERT INTO settings (key, value)
         VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(AppError::from)?;

    log::info!("Set setting {} = {}", key, value);
    Ok(())
}

// ============================================================================
// 🧾 INVOICE MANAGEMENT
// ============================================================================

/// Generate a unique invoice number
/// 
/// Format: INV-{order_id}
/// 
/// Could be enhanced to include:
/// - Date prefix: INV-2024-001234
/// - Custom prefix from settings
pub fn generate_invoice_no(order_id: i32) -> String {
    format!("INV-{}", order_id)
}

/// Ensure an order has an invoice number
/// 
/// - If invoice_no already exists: returns it
/// - If missing: generates, saves, and returns new invoice_no
pub fn ensure_invoice(order_id: i32) -> AppResult<String> {
    validate_positive_id(order_id, "order_id")?;
    
    let conn = get_connection();

    // Check if invoice already exists
    let existing: Option<String> = conn
        .query_row(
            "SELECT invoice_no FROM orders WHERE id = ?1",
            [order_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(AppError::from)?;

    if let Some(inv) = existing {
        return Ok(inv);
    }

    // Generate new invoice
    let invoice = generate_invoice_no(order_id);

    conn.execute(
        "UPDATE orders SET invoice_no = ?1 WHERE id = ?2",
        params![&invoice, order_id],
    )
    .map_err(AppError::from)?;

    Ok(invoice)
}

// ============================================================================
// 🧾 RECEIPT GENERATION
// ============================================================================

/// Get complete receipt data for an order
/// 
/// Returns:
/// - (patient_name, invoice_no, total_amount, paid_amount, tests_list)
/// 
/// Tests list contains:
/// - (test_name, test_price)
/// 
/// Used for:
/// - Receipt display
/// - Receipt printing
/// - Receipt PDF generation
pub fn get_receipt(order_id: i32) -> AppResult<(String, String, f64, f64, f64, Vec<ReceiptLine>)> {
    validate_positive_id(order_id, "order_id")?;
    
    let conn = get_connection();

    // Get patient name
    let patient: String = conn
        .query_row(
            "SELECT p.name
         FROM orders o
         JOIN patients p ON p.id = o.patient_id
         WHERE o.id = ?1",
            [order_id],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    // Get financial totals
    let (total, paid, discount): (f64, f64, f64) = conn
        .query_row(
            "SELECT total_amount, IFNULL(paid_amount, 0), IFNULL(discount_amount, 0)
         FROM orders WHERE id = ?1",
            [order_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(AppError::from)?;

    // Get or generate invoice number
    let invoice: String = conn
        .query_row(
            "SELECT invoice_no FROM orders WHERE id = ?1",
            [order_id],
            |row| row.get::<_, Option<String>>(0),
        )
        .map_err(AppError::from)?
        .unwrap_or_else(|| format!("INV-{}", order_id));

    // Get tests and prices
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.name, t.price
         FROM order_tests ot
         JOIN tests t ON t.id = ot.test_id
         WHERE ot.order_id = ?1
         ORDER BY ot.id ASC"
        )
        .map_err(AppError::from)?;

    let tests: Vec<(i32, String, f64)> = stmt
        .query_map([order_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .map_err(AppError::from)?
        .filter_map(Result::ok)
        .collect();

    let mut lines = Vec::new();
    for (test_id, test_name, price) in tests {
        let mut param_stmt = conn
            .prepare(
                "SELECT tp.name
                 FROM order_parameters op
                 JOIN test_parameters tp ON tp.id = op.parameter_id
                 WHERE op.order_id = ?1 AND tp.test_id = ?2
                 ORDER BY tp.id ASC",
            )
            .map_err(AppError::from)?;
        let parameter_names = param_stmt
            .query_map(params![order_id, test_id], |row| row.get::<_, String>(0))
            .map_err(AppError::from)?
            .filter_map(Result::ok)
            .collect();

        lines.push(ReceiptLine {
            test_name,
            price,
            parameter_names,
        });
    }

    Ok((patient, invoice, total, paid, discount, lines))
}

// ============================================================================
// 🧬 RESULT ENTRY & RETRIEVAL
// ============================================================================

/// Save a test result value
/// 
/// Parameters:
/// - order_id: ID of the order
/// - parameter_id: ID of the test parameter (from test_parameters table)
/// - value: Result value as string (e.g., "14.5", "Normal", "Positive")
/// 
/// Behavior:
/// - If result already exists: updates it
/// - If new: creates it
/// 
/// Validations:
/// - Value must not be empty
/// - Value must be < 500 characters
pub fn save_result(order_id: i32, parameter_id: i32, value: String) -> AppResult<()> {
    validate_positive_id(order_id, "order_id")?;
    validate_positive_id(parameter_id, "parameter_id")?;
    validate_parameter_value(&value)?;

    let conn = get_connection();

    conn.execute(
        "INSERT INTO results (order_id, parameter_id, value)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(order_id, parameter_id)
         DO UPDATE SET value = excluded.value",
        params![order_id, parameter_id, value],
    )
    .map_err(AppError::from)?;

    log::debug!("Saved result for order {} parameter {}", order_id, parameter_id);
    Ok(())
}

/// Get all parameters for an order's tests
/// 
/// Returns:
/// - Vector of (parameter_id, parameter_name, unit, normal_range)
/// 
/// Used for:
/// - Result entry form (list of fields to fill)
pub fn get_parameters_by_order(order_id: i32) -> AppResult<Vec<OrderParameterDto>> {
    validate_positive_id(order_id, "order_id")?;
    
    let conn = get_connection();

    let mut stmt = conn
        .prepare(
            "SELECT tp.id, tp.test_id, t.name, tp.name, tp.unit, tp.normal_range
         FROM order_parameters op
         JOIN test_parameters tp ON tp.id = op.parameter_id
         JOIN tests t ON t.id = tp.test_id
         JOIN order_tests ot ON ot.order_id = op.order_id AND ot.test_id = tp.test_id
         WHERE op.order_id = ?1
         ORDER BY ot.id ASC, tp.id ASC"
        )
        .map_err(AppError::from)?;

    let rows = stmt
        .query_map([order_id], |row| {
            Ok(OrderParameterDto {
                id: row.get(0)?,
                test_id: row.get(1)?,
                test_name: row.get(2)?,
                name: row.get(3)?,
                unit: row.get(4)?,
                normal_range: row.get(5)?,
            })
        })
        .map_err(AppError::from)?;

    let results: AppResult<Vec<_>> = rows.map(|r| r.map_err(AppError::from)).collect();
    results
}

/// Get all entered results for an order
/// 
/// Returns:
/// - Vector of (parameter_id, result_value)
pub fn get_results_by_order(order_id: i32) -> AppResult<Vec<(i32, String)>> {
    validate_positive_id(order_id, "order_id")?;
    
    let conn = get_connection();

    let mut stmt = conn
        .prepare("SELECT parameter_id, value FROM results WHERE order_id = ?1 ORDER BY parameter_id ASC")
        .map_err(AppError::from)?;

    let rows = stmt
        .query_map([order_id], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(AppError::from)?;

    let results: AppResult<Vec<_>> = rows.map(|r| r.map_err(AppError::from)).collect();
    results
}

// ============================================================================
// 📄 REPORT GENERATION
// ============================================================================

/// Get formatted report for an order
/// 
/// Returns:
/// - Vector of (parameter_name, result_value, unit, normal_range)
/// - All information needed for displaying/printing report
/// 
/// Used for:
/// - Report page display
/// - Report PDF generation
pub fn get_report(order_id: i32) -> AppResult<Vec<ReportRow>> {
    validate_positive_id(order_id, "order_id")?;
    
    let conn = get_connection();

    let mut stmt = conn
        .prepare(
            "SELECT t.name, tp.name, r.value, tp.unit, tp.normal_range
         FROM results r
         JOIN test_parameters tp ON tp.id = r.parameter_id
         JOIN tests t ON t.id = tp.test_id
         JOIN order_parameters op ON op.parameter_id = tp.id AND op.order_id = r.order_id
         JOIN order_tests ot ON ot.order_id = op.order_id AND ot.test_id = tp.test_id
         WHERE r.order_id = ?1
         ORDER BY ot.id ASC, tp.id ASC"
        )
        .map_err(AppError::from)?;

    let rows = stmt
        .query_map([order_id], |row| {
            Ok(ReportRow {
                test_name: row.get(0)?,
                parameter_name: row.get(1)?,
                value: row.get(2)?,
                unit: row.get(3)?,
                normal_range: row.get(4)?,
            })
        })
        .map_err(AppError::from)?;

    let results: AppResult<Vec<_>> = rows.map(|r| r.map_err(AppError::from)).collect();
    results
}

// ============================================================================
// 👤 PATIENT INFORMATION
// ============================================================================

/// Get patient information by order ID
/// 
/// Returns:
/// - (patient_name, age_value, gender)
pub fn get_patient_by_order(order_id: i32) -> AppResult<ReportPatientInfo> {
    validate_positive_id(order_id, "order_id")?;
    
    let conn = get_connection();

    let res = conn
        .query_row(
            "SELECT
                p.name,
                IFNULL(p.patient_code, ''),
                IFNULL(p.age_value, 0),
                IFNULL(p.age_unit, ''),
                IFNULL(p.gender, 'Unknown'),
                IFNULL(p.phone, ''),
                IFNULL(p.referred_by, ''),
                IFNULL(o.invoice_no, 'INV-' || o.id),
                IFNULL(o.created_at, '')
         FROM orders o
         JOIN patients p ON p.id = o.patient_id
         WHERE o.id = ?1",
            [order_id],
            |row| {
                Ok(ReportPatientInfo {
                    patient_name: row.get(0)?,
                    patient_code: row.get(1)?,
                    age_value: row.get(2)?,
                    age_unit: row.get(3)?,
                    gender: row.get(4)?,
                    phone: row.get(5)?,
                    referred_by: row.get(6)?,
                    invoice_no: row.get(7)?,
                    order_date: row.get(8)?,
                })
            },
        )
        .map_err(AppError::from)?;

    Ok(res)
}


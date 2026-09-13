use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use crate::errors::{AppError, AppResult};
use crate::modules::auth::commands::AuthState;

// ── Summary data returned to the frontend ──

#[derive(Debug, Serialize)]
pub struct AnalyticsSummary {
    pub total_revenue: f64,
    pub collected_amount: f64,
    pub pending_amount: f64,
    pub total_patients: i64,
    pub total_orders: i64,
    pub total_tests_ordered: i64,
}

#[derive(Debug, Serialize)]
pub struct ChartImage {
    pub name: String,
    pub base64: String,
}

// ── Chart data structures for Recharts ──

#[derive(Debug, Serialize)]
pub struct MonthlyRevenuePoint {
    pub month: String,       // "2025-01"
    pub revenue: f64,        // total_amount in rupees
    pub collected: f64,      // paid_amount in rupees
    pub pending: f64,        // revenue - collected
}

#[derive(Debug, Serialize)]
pub struct TopTestItem {
    pub test_name: String,
    pub order_count: i64,
    pub total_revenue: f64,  // in rupees
}

#[derive(Debug, Serialize)]
pub struct DoctorRevenueItem {
    pub doctor_name: String,
    pub patient_count: i64,
    pub order_count: i64,
    pub total_revenue: f64,  // in rupees
    pub collected: f64,      // in rupees
    pub pending: f64,        // in rupees
}

#[derive(Debug, Serialize)]
pub struct PatientGrowthPoint {
    pub month: String,       // "2025-01"
    pub new_patients: i64,
}

// ── Helpers ──

fn require_auth(auth: &AuthState) -> AppResult<crate::modules::auth::model::SessionInfo> {
    crate::modules::auth::commands::require_auth(auth)
}

/// Resolve the project root directory (where python_analytics lives).
/// Uses CARGO_MANIFEST_DIR (src-tauri/) and goes up one level to the workspace root.
fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .to_path_buf()
}

/// Find a working Python executable.
fn python_exe() -> &'static str {
    // Try `python` first (works on Windows with Python in PATH);
    // fall back to `python3` for Unix systems.
    if cfg!(windows) {
        "python"
    } else {
        // Check if python3 exists
        match Command::new("python3").arg("--version").output() {
            Ok(_) => "python3",
            Err(_) => "python",
        }
    }
}

/// Run a Python analytics subcommand and return stdout + stderr.
fn run_python(args: &[&str]) -> AppResult<String> {
    let root = project_root();
    let script = root.join("python_analytics").join("main.py");

    if !script.exists() {
        return Err(AppError::FileError(format!(
            "Python analytics script not found at: {}",
            script.display()
        )));
    }

    let output = Command::new(python_exe())
        .args(args)
        .current_dir(&root)
        .output()
        .map_err(|e| {
            AppError::FileError(format!(
                "Failed to run Python ({}). Is Python installed and in PATH? {}",
                python_exe(),
                e
            ))
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        return Err(AppError::FileError(format!(
            "Python script exited with code {:?}.\n\nSTDOUT:\n{}\n\nSTDERR:\n{}",
            output.status.code(),
            stdout,
            stderr
        )));
    }

    Ok(format!("{}\n{}", stdout, stderr))
}

// ── Tauri Commands ──

#[tauri::command]
pub fn get_analytics_summary(
    db: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
) -> AppResult<AnalyticsSummary> {
    require_auth(&auth)?;

    let conn = db.lock().map_err(|e| {
        AppError::InternalError(format!("DB lock error: {}", e))
    })?;

    // Total revenue: sum of total_amount_paise from orders (in paise)
    let total_revenue_paise: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total_amount_paise), 0) FROM orders",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Collected amount: sum of paid_amount_paise from orders (in paise)
    let collected_paise: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(paid_amount_paise), 0) FROM orders",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Pending = total - collected
    let pending_paise = total_revenue_paise - collected_paise;

    // Total patients
    let total_patients: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM patients",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Total orders
    let total_orders: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM orders",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Total tests ordered
    let total_tests_ordered: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM order_parameters",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(AnalyticsSummary {
        total_revenue: total_revenue_paise as f64 / 100.0,
        collected_amount: collected_paise as f64 / 100.0,
        pending_amount: pending_paise as f64 / 100.0,
        total_patients,
        total_orders,
        total_tests_ordered,
    })
}

#[tauri::command]
pub fn run_analytics_excel(auth: State<'_, AuthState>) -> AppResult<String> {
    require_auth(&auth)?;
    run_python(&["python_analytics/main.py", "--excel"])
}

#[tauri::command]
pub fn run_analytics_charts(auth: State<'_, AuthState>) -> AppResult<String> {
    require_auth(&auth)?;
    run_python(&["python_analytics/main.py", "--charts"])
}

#[tauri::command]
pub fn run_analytics_all(auth: State<'_, AuthState>) -> AppResult<String> {
    require_auth(&auth)?;
    run_python(&["python_analytics/main.py", "--excel", "--charts", "--summary"])
}

#[tauri::command]
pub fn read_chart_image(
    name: String,
    auth: State<'_, AuthState>,
) -> AppResult<ChartImage> {
    require_auth(&auth)?;

    // Sanitize the filename: only allow known chart names
    let allowed = [
        "daily_revenue.png",
        "monthly_revenue.png",
        "top_tests.png",
        "doctor_revenue.png",
        "patient_growth.png",
    ];

    if !allowed.contains(&name.as_str()) {
        return Err(AppError::ValidationError(format!(
            "Unknown chart image: {}. Allowed: {:?}",
            name, allowed
        )));
    }

    let path = project_root()
        .join("python_analytics")
        .join("output")
        .join(&name);

    if !path.exists() {
        return Err(AppError::FileError(format!(
            "Chart image not found: {}. Generate charts first.",
            path.display()
        )));
    }

    let bytes = fs::read(&path).map_err(|e| {
        AppError::FileError(format!("Failed to read {}: {}", path.display(), e))
    })?;

    let b64 = BASE64.encode(&bytes);

    Ok(ChartImage {
        name,
        base64: format!("data:image/png;base64,{}", b64),
    })
}

#[tauri::command]
pub fn open_analytics_folder(auth: State<'_, AuthState>) -> AppResult<String> {
    require_auth(&auth)?;

    let path = project_root()
        .join("python_analytics")
        .join("output");

    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| {
            AppError::FileError(format!("Cannot create output folder: {}", e))
        })?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| AppError::FileError(format!("Failed to open folder: {}", e)))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| AppError::FileError(format!("Failed to open folder: {}", e)))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| AppError::FileError(format!("Failed to open folder: {}", e)))?;
    }

    Ok(format!("Opened folder: {}", path.display()))
}

// ── Chart Data Commands (Recharts) ──

/// Monthly revenue data for the last 12 months (bar chart).
#[tauri::command]
pub fn get_monthly_revenue(
    db: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
) -> AppResult<Vec<MonthlyRevenuePoint>> {
    require_auth(&auth)?;
    let conn = db.lock().map_err(|e| AppError::InternalError(format!("DB lock error: {}", e)))?;

    let mut stmt = conn
        .prepare(
            "SELECT strftime('%Y-%m', created_at) AS month,
                    COALESCE(SUM(total_amount_paise), 0) AS total_paise,
                    COALESCE(SUM(paid_amount_paise), 0) AS paid_paise
             FROM orders
             WHERE created_at >= DATE('now', '-12 months')
             GROUP BY month
             ORDER BY month",
        )
        .map_err(|e| AppError::InternalError(format!("SQL prepare error: {}", e)))?;

    let rows = stmt
        .query_map([], |row| {
            let month: String = row.get(0)?;
            let total_paise: i64 = row.get(1)?;
            let paid_paise: i64 = row.get(2)?;
            Ok(MonthlyRevenuePoint {
                month,
                revenue: total_paise as f64 / 100.0,
                collected: paid_paise as f64 / 100.0,
                pending: (total_paise - paid_paise) as f64 / 100.0,
            })
        })
        .map_err(|e| AppError::InternalError(format!("SQL query error: {}", e)))?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| AppError::InternalError(format!("Row error: {}", e)))?);
    }
    Ok(result)
}

/// Top 10 most-ordered tests (horizontal bar chart).
#[tauri::command]
pub fn get_top_tests(
    db: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
) -> AppResult<Vec<TopTestItem>> {
    require_auth(&auth)?;
    let conn = db.lock().map_err(|e| AppError::InternalError(format!("DB lock error: {}", e)))?;

    let mut stmt = conn
        .prepare(
            "SELECT IFNULL(ot.test_name_snapshot, t.name) AS test_name,
                    COUNT(DISTINCT ot.order_id) AS order_count,
                    COALESCE(SUM(ot.price_paise), 0) AS total_paise
             FROM order_tests ot
             JOIN orders o ON o.id = ot.order_id
             LEFT JOIN tests t ON t.id = ot.test_id
             WHERE o.created_at >= DATE('now', '-12 months')
             GROUP BY ot.test_id, test_name
             ORDER BY order_count DESC
             LIMIT 10",
        )
        .map_err(|e| AppError::InternalError(format!("SQL prepare error: {}", e)))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(TopTestItem {
                test_name: row.get(0)?,
                order_count: row.get(1)?,
                total_revenue: row.get::<_, i64>(2)? as f64 / 100.0,
            })
        })
        .map_err(|e| AppError::InternalError(format!("SQL query error: {}", e)))?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| AppError::InternalError(format!("Row error: {}", e)))?);
    }
    Ok(result)
}

/// Top 10 referring doctors by revenue (horizontal bar chart).
#[tauri::command]
pub fn get_doctor_revenue_chart(
    db: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
) -> AppResult<Vec<DoctorRevenueItem>> {
    require_auth(&auth)?;
    let conn = db.lock().map_err(|e| AppError::InternalError(format!("DB lock error: {}", e)))?;

    let mut stmt = conn
        .prepare(
            "SELECT IFNULL(p.referred_by, 'Self/Unknown') AS doctor_name,
                    COUNT(DISTINCT p.id) AS patient_count,
                    COUNT(DISTINCT o.id) AS order_count,
                    COALESCE(SUM(o.total_amount_paise), 0) AS total_paise,
                    COALESCE(SUM(o.paid_amount_paise), 0) AS paid_paise
             FROM patients p
             JOIN orders o ON o.patient_id = p.id
             WHERE o.created_at >= DATE('now', '-12 months')
             GROUP BY p.referred_by
             ORDER BY total_paise DESC
             LIMIT 10",
        )
        .map_err(|e| AppError::InternalError(format!("SQL prepare error: {}", e)))?;

    let rows = stmt
        .query_map([], |row| {
            let total_paise: i64 = row.get(3)?;
            let paid_paise: i64 = row.get(4)?;
            Ok(DoctorRevenueItem {
                doctor_name: row.get(0)?,
                patient_count: row.get(1)?,
                order_count: row.get(2)?,
                total_revenue: total_paise as f64 / 100.0,
                collected: paid_paise as f64 / 100.0,
                pending: (total_paise - paid_paise) as f64 / 100.0,
            })
        })
        .map_err(|e| AppError::InternalError(format!("SQL query error: {}", e)))?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| AppError::InternalError(format!("Row error: {}", e)))?);
    }
    Ok(result)
}

/// Monthly patient registrations for the last 12 months (line chart).
#[tauri::command]
pub fn get_patient_growth(
    db: State<'_, Mutex<Connection>>,
    auth: State<'_, AuthState>,
) -> AppResult<Vec<PatientGrowthPoint>> {
    require_auth(&auth)?;
    let conn = db.lock().map_err(|e| AppError::InternalError(format!("DB lock error: {}", e)))?;

    let mut stmt = conn
        .prepare(
            "SELECT strftime('%Y-%m', created_at) AS month,
                    COUNT(*) AS new_patients
             FROM patients
             WHERE created_at >= DATE('now', '-12 months')
             GROUP BY month
             ORDER BY month",
        )
        .map_err(|e| AppError::InternalError(format!("SQL prepare error: {}", e)))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(PatientGrowthPoint {
                month: row.get(0)?,
                new_patients: row.get(1)?,
            })
        })
        .map_err(|e| AppError::InternalError(format!("SQL query error: {}", e)))?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| AppError::InternalError(format!("Row error: {}", e)))?);
    }
    Ok(result)
}
/// 🧪 Lab Management System Backend
/// Tauri-based desktop application for local laboratory operations.

mod config;
mod db;
mod errors;
mod modules;
mod utils;

use std::sync::Mutex;

use db::connection::{export_backup, restore_backup, get_connection};
use db::schema::init_db;
use modules::auth::commands::AuthState;

pub fn run() -> Result<(), String> {
    dotenvy::dotenv().ok();

    let config = config::Config::from_env();

    init_logging(&config);

    log::info!(
        "🧪 {} v{} starting in {:?} mode",
        config.app_name,
        config.app_version,
        config.environment
    );

    init_db().map_err(|e| format!("failed to initialize database: {}", e))?;

    log::info!("✅ Database initialized");

    let db_conn = get_connection()
        .map_err(|e| format!("failed to create DB connection: {}", e))?;
    log::info!("🔗 Shared database connection ready");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(db_conn))
        .manage(AuthState::new(None))
        .invoke_handler(tauri::generate_handler![
            // 🔐 Auth
            modules::auth::commands::login,
            modules::auth::commands::logout,
            modules::auth::commands::get_current_session,
            modules::auth::commands::create_user,
            modules::auth::commands::list_users,
            modules::auth::commands::toggle_user_active,

            // 💾 Backup/Restore
            export_backup,
            restore_backup,

            // 👤 Patient Management
            modules::patient::commands::create_patient,
            modules::patient::commands::search_patients,
            modules::patient::commands::get_doctors,
            modules::patient::commands::add_doctor,

            // 🧪 Catalog Management
            modules::catalog::commands::get_tests,
            modules::catalog::commands::get_test_parameters,
            modules::catalog::commands::add_test,
            modules::catalog::commands::update_test,
            modules::catalog::commands::delete_test,
            modules::catalog::commands::add_test_parameter,
            modules::catalog::commands::update_test_parameter,
            modules::catalog::commands::delete_test_parameter,

            // 📦 Order Management
            modules::order::commands::create_order,
            modules::order::commands::get_orders,
            modules::order::commands::get_order_status,

            // 🧬 Results & Entry
            modules::result::commands::save_result,
            modules::result::commands::save_results,
            modules::result::commands::get_parameters_by_order,
            modules::result::commands::get_results_by_order,

            // 📄 Report & Receipt
            modules::report::commands::get_report,
            modules::report::commands::get_patient_by_order,
            modules::receipt::commands::get_receipt,

            // 💰 Payment & Billing
            modules::payment::commands::update_payment,
            modules::payment::commands::get_daily_summary,
            modules::payment::commands::get_overall_summary,
            modules::payment::commands::get_payment_history,

            // ⚙️ Settings
            modules::settings::commands::get_setting,
            modules::settings::commands::set_setting,
            modules::settings::commands::get_all_settings,
            modules::settings::commands::save_lab_settings,

            // 📜 Audit Logs (admin-only)
            modules::audit::commands::get_audit_logs,
            modules::audit::commands::get_record_history,
            modules::audit::commands::get_user_activity,
        ])
        .run(tauri::generate_context!())
        .map_err(|e| format!("error while running Tauri application: {}", e))
}

fn init_logging(config: &config::Config) {
    use tracing_subscriber::{fmt, prelude::*, EnvFilter};
    use tracing_appender::rolling::{RollingFileAppender, Rotation};
    use std::io;

    let file_appender = RollingFileAppender::new(
        Rotation::DAILY,
        crate::db::connection::get_db_dir()
            .unwrap_or_else(|_| std::path::PathBuf::from("."))
            .join("logs"),
        "app.log",
    );

    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    // Keep the guard around for the lifetime of the app — leak it intentionally
    // so the non-blocking writer stays alive.
    std::mem::forget(_guard);

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| {
            let level = match config.log_level.as_str() {
                "trace" => "trace",
                "debug" => "debug",
                "warn" => "warn",
                "error" => "error",
                _ => "info",
            };
            EnvFilter::new(level)
        });

    let stderr_layer = fmt::layer()
        .with_writer(io::stderr)
        .with_target(true)
        .with_thread_ids(false);

    let file_layer = fmt::layer()
        .json()
        .with_writer(non_blocking)
        .with_target(true)
        .with_file(true)
        .with_line_number(true);

    tracing_subscriber::registry()
        .with(env_filter)
        .with(stderr_layer)
        .with(file_layer)
        .init();

    // Bridge log crate macros (info!, warn!, etc.) → tracing
    tracing_log::LogTracer::init().ok();

    log::info!("📝 Logging initialized at {:?} level", config.log_level);
}
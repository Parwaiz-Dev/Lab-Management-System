/// 🧪 Lab Management System Backend
/// Tauri-based desktop application for laboratory operations management
/// 
/// Module Structure:
/// - db: Database setup, migrations, and connection management
/// - modules: Feature-specific business logic (patient, test, order, report)
/// - errors: Structured error handling and type definitions
/// - utils: Validation, helpers, and utilities
/// - config: Application configuration management

mod config;
mod db;
mod errors;
mod modules;
mod utils;

use db::schema::init_db;
use db::connection::{export_backup, restore_backup};

fn main() {
    // ⚙️ Initialize configuration
    let config = config::Config::from_env();
    
    // 🔍 Initialize logging
    init_logging(&config);
    
    log::info!(
        "🧪 {} v{} starting in {:?} mode",
        config.app_name,
        config.app_version,
        config.environment
    );

    // 📁 Initialize database
    init_db().expect("failed to initialize database");

    log::info!("✅ Database initialized");

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // 💾 Backup/Restore
            export_backup,
            restore_backup,

            // 👤 Patient Management
            modules::patient::commands::create_patient,
            modules::patient::commands::search_patients,
            modules::patient::commands::get_doctors,
            modules::patient::commands::add_doctor,

            // 🧪 Test & Order Management
            modules::test::commands::get_tests,
            modules::test::commands::add_test,
            modules::test::commands::update_test,
            modules::test::commands::delete_test,
            modules::test::commands::get_test_parameters,
            modules::test::commands::add_test_parameter,
            modules::test::commands::update_test_parameter,
            modules::test::commands::delete_test_parameter,
            modules::test::commands::create_order,
            modules::test::commands::get_orders,
            modules::test::commands::get_order_status,

            // 🧬 Results & Reports
            modules::test::commands::save_result,
            modules::test::commands::get_parameters_by_order,
            modules::test::commands::get_results_by_order,

            // 📄 Report & Receipt
            modules::test::commands::get_report,
            modules::test::commands::get_patient_by_order,
            modules::test::commands::get_receipt,

            // 💰 Payment & Billing
            modules::test::commands::update_payment,
            modules::test::commands::get_daily_summary,

            // ⚙️ Settings
            modules::test::commands::get_setting,
            modules::test::commands::set_setting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Initialize logging system
fn init_logging(config: &config::Config) {
    use log::LevelFilter;

    // Parse log level from config
    let level = match config.log_level.to_lowercase().as_str() {
        "trace" => LevelFilter::Trace,
        "debug" => LevelFilter::Debug,
        "info" => LevelFilter::Info,
        "warn" => LevelFilter::Warn,
        "error" => LevelFilter::Error,
        _ => LevelFilter::Info,
    };

    // In development, use env_logger for pretty console output
    #[cfg(debug_assertions)]
    {
        env_logger::Builder::from_default_env()
            .filter_level(level)
            .format_timestamp_millis()
            .init();
    }

    #[cfg(not(debug_assertions))]
    {
        // In production, use Tauri's logging plugin
        // (configured through tauri.conf.json)
    }

    log::info!("📝 Logging initialized at {:?} level", level);
}

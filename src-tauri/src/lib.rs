/// 🧪 Lab Management System Backend
/// Tauri-based desktop application for local laboratory operations.

mod config;
mod db;
mod errors;
mod modules;
mod utils;

use db::connection::{export_backup, restore_backup};
use db::schema::init_db;

pub fn run() {
    dotenvy::dotenv().ok();

    let config = config::Config::from_env();

    init_logging(&config);

    log::info!(
        "🧪 {} v{} starting in {:?} mode",
        config.app_name,
        config.app_version,
        config.environment
    );

    init_db().expect("failed to initialize database");

    log::info!("✅ Database initialized");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
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

            // ⚙️ Settings
            modules::settings::commands::get_setting,
            modules::settings::commands::set_setting,
            modules::settings::commands::get_all_settings,
            modules::settings::commands::save_lab_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}

fn init_logging(config: &config::Config) {
    use log::LevelFilter;

    let level = match config.log_level.as_str() {
        "trace" => LevelFilter::Trace,
        "debug" => LevelFilter::Debug,
        "info" => LevelFilter::Info,
        "warn" => LevelFilter::Warn,
        "error" => LevelFilter::Error,
        _ => LevelFilter::Info,
    };

    let _ = env_logger::Builder::from_default_env()
        .filter_level(level)
        .format_timestamp_millis()
        .try_init();

    log::info!("📝 Logging initialized at {:?} level", level);
}
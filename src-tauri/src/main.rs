mod db;
mod modules;

use db::schema::init_db;

// ✅ ADD THIS LINE (FIX)
use db::connection::{export_backup, restore_backup};

fn main() {
    init_db();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // 💾 Backup
            export_backup,
            restore_backup,

            // 👤 Patient
            modules::patient::commands::create_patient,
            modules::patient::commands::search_patients,
            modules::patient::commands::get_doctors,
            modules::patient::commands::add_doctor,

            // 🧪 Test / Orders
            modules::test::commands::get_tests,
            modules::test::commands::get_test_parameters,
            modules::test::commands::create_order,
            modules::test::commands::get_orders,
            modules::test::commands::get_order_status,

            // 🧬 Results
            modules::test::commands::save_result,
            modules::test::commands::get_parameters_by_order,
            modules::test::commands::get_results_by_order,

            // 📄 Report
            modules::test::commands::get_report,
            modules::test::commands::get_patient_by_order,

            // 💰 Payment
            modules::test::commands::update_payment,
            modules::test::commands::get_daily_summary,

            // ⚙️ Settings
            modules::test::commands::get_setting,
            modules::test::commands::set_setting,

            //receipt
            modules::test::commands::get_receipt,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}
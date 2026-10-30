use std::sync::Mutex;
use std::time::Duration;
use rusqlite::Connection;
use tauri::Manager;

use super::config::BACKGROUND_CHECK_INTERVAL_SECS;
use super::storage::load_or_initialize_activation;
use super::uninstaller::trigger_uninstallation;

/// Spawns an internal background monitoring thread that runs periodically during
/// application runtime.
///
/// When expiration is detected:
/// 1. It acquires the database mutex to wait for any active data write in progress.
/// 2. It flushes the SQLite WAL cache cleanly.
/// 3. It triggers the official Windows uninstaller.
/// 4. It gracefully exits the process.
pub fn start_monitor(app_handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        log::info!("🕒 Expiration runtime monitor started (interval: {}s)", BACKGROUND_CHECK_INTERVAL_SECS);

        loop {
            std::thread::sleep(Duration::from_secs(BACKGROUND_CHECK_INTERVAL_SECS));

            match load_or_initialize_activation() {
                Ok(record) => {
                    if record.is_expired() {
                        log::warn!("⌛ Application evaluation timer expired during runtime!");

                        // Ensure any in-progress database writes are completed and lock DB
                        if let Some(db_state) = app_handle.try_state::<Mutex<Connection>>() {
                            if let Ok(conn) = db_state.lock() {
                                log::info!("🔒 Database locked for safe shutdown.");
                                let _ = trigger_uninstallation(Some(&conn));
                            } else {
                                let _ = trigger_uninstallation(None);
                            }
                        } else {
                            let _ = trigger_uninstallation(None);
                        }

                        // Exit application cleanly
                        app_handle.exit(0);
                        std::process::exit(0);
                    }
                }
                Err(e) => {
                    log::error!("Error reading activation state in background monitor: {}", e);
                }
            }
        }
    });
}

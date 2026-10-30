use std::path::PathBuf;
use rusqlite::Connection;

/// Resolves the absolute path to the official Windows uninstaller executable.
pub fn find_uninstaller_path() -> Option<PathBuf> {
    // 1. Check test/development override environment variable
    if let Ok(env_path) = std::env::var("LMS_UNINSTALLER_PATH") {
        let p = PathBuf::from(env_path);
        if p.exists() {
            return Some(p);
        }
    }

    // 2. Check adjacent to current running executable
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            let candidates = [
                parent.join("uninstall.exe"),
                parent.join("Uninstall.exe"),
                parent.join("Uninstall lms.exe"),
                parent.join("uninstall-lms.exe"),
            ];
            for candidate in &candidates {
                if candidate.exists() {
                    return Some(candidate.clone());
                }
            }
        }
    }

    // 3. Query Windows Registry for official UninstallString
    #[cfg(windows)]
    {
        if let Some(reg_path) = find_uninstaller_from_registry() {
            return Some(reg_path);
        }
    }

    None
}

/// Queries Windows Registry for the installed app's UninstallString.
#[cfg(windows)]
fn find_uninstaller_from_registry() -> Option<PathBuf> {
    use std::os::windows::process::CommandExt;

    let search_roots = [
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\lms",
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\com.faltu.dev",
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\lab-management-system",
        r"HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\lms",
        r"HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\com.faltu.dev",
        r"HKLM\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\lms",
        r"HKLM\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\com.faltu.dev",
    ];

    for root in &search_roots {
        let mut cmd = std::process::Command::new("reg");
        cmd.args(["query", root, "/v", "UninstallString"]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    if line.contains("REG_SZ") || line.contains("REG_EXPAND_SZ") {
                        let split_token = if line.contains("REG_SZ") { "REG_SZ" } else { "REG_EXPAND_SZ" };
                        if let Some(raw_val) = line.split(split_token).nth(1) {
                            let cleaned = raw_val.trim().trim_matches('"');
                            let path = PathBuf::from(cleaned);
                            if path.exists() {
                                return Some(path);
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

/// Triggers the official Windows uninstaller after ensuring active data operations
/// have completed safely.
pub fn trigger_uninstallation(db_conn: Option<&Connection>) -> Result<(), String> {
    log::warn!("⚠️ Auto-expiration triggered: Preparing for safe official uninstallation.");

    // 1. Data Safety: Flush SQLite WAL checkpoint before launching uninstaller
    if let Some(conn) = db_conn {
        log::info!("🛡️ Checkpointing database WAL prior to uninstaller execution...");
        let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
    }

    // 2. Mark state
    let _ = super::storage::mark_uninstallation_triggered();

    // 3. Remove scheduled task if registered
    let _ = super::scheduler::remove_scheduled_task();

    // 4. Locate official uninstaller
    let uninstaller_path = match find_uninstaller_path() {
        Some(p) => p,
        None => {
            log::warn!(
                "⚠️ Official uninstaller executable was not found. If running in a development or \
                 portable environment, actual uninstallation is skipped."
            );
            return Ok(());
        }
    };

    log::info!("🚀 Launching official Windows uninstaller at: {:?}", uninstaller_path);

    // 5. Spawn uninstaller process with standard Windows authorization
    // We intentionally do NOT use /S (silent mode) so that standard Windows
    // elevation prompts and user confirmation dialogs remain intact.
    let mut cmd = std::process::Command::new(&uninstaller_path);

    #[cfg(windows)]
    {
        // Allow the uninstaller process to detach and continue independently
        let spawn_result = cmd.spawn();
        match spawn_result {
            Ok(_) => {
                log::info!("✅ Uninstaller process dispatched successfully.");
                Ok(())
            }
            Err(e) => {
                Err(format!("Failed to spawn Windows uninstaller: {}", e))
            }
        }
    }

    #[cfg(not(windows))]
    {
        let spawn_result = cmd.spawn();
        match spawn_result {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to spawn uninstaller: {}", e)),
        }
    }
}

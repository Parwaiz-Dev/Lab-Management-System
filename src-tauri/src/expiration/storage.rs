use std::fs;
use std::path::PathBuf;
use chrono::{DateTime, Utc};
use rusqlite::params;

use super::config::{get_expiration_duration, ALLOW_ACTIVATION_RESET};
use super::state::ActivationRecord;

const ACTIVATION_FILE_NAME: &str = ".activation_lock.json";
const REGISTRY_PATH: &str = r"HKCU\Software\LabManagementSystem\Activation";
const REG_FIRST_ACTIVATED: &str = "FirstActivatedAt";
const REG_EXPIRES_AT: &str = "ExpiresAt";
const REG_INSTALL_ID: &str = "InstallationId";
const DB_KEY_FIRST_ACTIVATED: &str = "system_first_activated_at";
const DB_KEY_EXPIRES_AT: &str = "system_expires_at";

/// Returns the path to the persistent activation file in AppData.
pub fn get_activation_file_path() -> Result<PathBuf, String> {
    let dir = crate::db::connection::get_db_dir()?;
    Ok(dir.join(ACTIVATION_FILE_NAME))
}

/// Reads the activation record from the persistent file in AppData.
fn read_from_file() -> Option<ActivationRecord> {
    let path = get_activation_file_path().ok()?;
    if !path.exists() {
        return None;
    }
    let data = fs::read_to_string(&path).ok()?;
    serde_json::from_str::<ActivationRecord>(&data).ok()
}

/// Saves the activation record to the persistent file in AppData.
fn write_to_file(record: &ActivationRecord) -> Result<(), String> {
    let path = get_activation_file_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(record).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("Failed to write activation file: {}", e))?;
    Ok(())
}

/// Helper to execute Windows `reg` commands silently without flashing a command window.
#[cfg(windows)]
fn run_reg_command(args: &[&str]) -> Option<String> {
    use std::os::windows::process::CommandExt;
    let mut cmd = std::process::Command::new("reg");
    cmd.args(args);
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    let output = cmd.output().ok()?;
    if output.status.success() {
        Some(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        None
    }
}

/// Reads a value from the Windows Registry.
#[cfg(windows)]
fn read_from_registry(name: &str) -> Option<String> {
    let stdout = run_reg_command(&["query", REGISTRY_PATH, "/v", name])?;
    for line in stdout.lines() {
        if line.contains("REG_SZ") || line.contains("REG_EXPAND_SZ") {
            let split_token = if line.contains("REG_SZ") { "REG_SZ" } else { "REG_EXPAND_SZ" };
            if let Some(val) = line.split(split_token).nth(1) {
                let cleaned = val.trim().trim_matches('"');
                if !cleaned.is_empty() {
                    return Some(cleaned.to_string());
                }
            }
        }
    }
    None
}

#[cfg(not(windows))]
fn read_from_registry(_name: &str) -> Option<String> {
    None
}

/// Writes a string value to the Windows Registry.
#[cfg(windows)]
fn write_to_registry(name: &str, value: &str) -> Result<(), String> {
    let result = run_reg_command(&["add", REGISTRY_PATH, "/v", name, "/t", "REG_SZ", "/d", value, "/f"]);
    if result.is_some() {
        Ok(())
    } else {
        Err(format!("Failed to write {} to Windows Registry", name))
    }
}

#[cfg(not(windows))]
fn write_to_registry(_name: &str, _value: &str) -> Result<(), String> {
    Ok(())
}

/// Reads the activation timestamp from the Windows Registry.
fn read_registry_record() -> Option<DateTime<Utc>> {
    let date_str = read_from_registry(REG_FIRST_ACTIVATED)?;
    DateTime::parse_from_rfc3339(&date_str)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

/// Writes activation data to the Windows Registry.
fn write_registry_record(record: &ActivationRecord) -> Result<(), String> {
    write_to_registry(REG_FIRST_ACTIVATED, &record.first_activated_at)?;
    write_to_registry(REG_EXPIRES_AT, &record.expires_at)?;
    write_to_registry(REG_INSTALL_ID, &record.installation_id)?;
    Ok(())
}

/// Reads the activation timestamp from the SQLite database `settings` table.
fn read_from_db() -> Option<DateTime<Utc>> {
    let conn = crate::db::connection::get_connection().ok()?;
    let value: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [DB_KEY_FIRST_ACTIVATED],
            |row| row.get(0),
        )
        .ok();

    let date_str = value?;
    DateTime::parse_from_rfc3339(&date_str)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

/// Writes the activation timestamps to the SQLite database `settings` table.
pub fn sync_to_db(record: &ActivationRecord) -> Result<(), String> {
    let conn = crate::db::connection::get_connection().map_err(|e| e.to_string())?;
    
    // Ensure table exists just in case
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)",
        [],
    );

    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![DB_KEY_FIRST_ACTIVATED, &record.first_activated_at],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![DB_KEY_EXPIRES_AT, &record.expires_at],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

/// Loads or initializes the activation record with multi-layer persistence.
///
/// Ensures:
/// 1. If an activation timestamp already exists in AppData, Registry, or DB, it is preserved.
/// 2. The earliest timestamp across all stores is prioritized (anti-tamper / reinstall protection).
/// 3. Reinstallations cannot silently reset the timer unless ALLOW_ACTIVATION_RESET is explicitly enabled.
pub fn load_or_initialize_activation() -> Result<ActivationRecord, String> {
    let file_record = read_from_file();
    let reg_timestamp = read_registry_record();
    let db_timestamp = read_from_db();

    let mut timestamps: Vec<DateTime<Utc>> = Vec::new();
    if let Some(ref r) = file_record {
        timestamps.push(r.first_activated_at_datetime());
    }
    if let Some(t) = reg_timestamp {
        timestamps.push(t);
    }
    if let Some(t) = db_timestamp {
        timestamps.push(t);
    }

    let duration = get_expiration_duration();

    let record = if !timestamps.is_empty() && !ALLOW_ACTIVATION_RESET {
        // Reconcile to the earliest recorded activation timestamp across all layers
        let earliest = timestamps.into_iter().min().unwrap();
        
        let mut rec = if let Some(existing) = file_record {
            let mut modified = existing;
            let chrono_dur = chrono::Duration::from_std(duration)
                .unwrap_or_else(|_| chrono::Duration::hours(24));
            rec_check_expires(&mut modified, earliest, chrono_dur);
            modified
        } else {
            ActivationRecord::new(earliest, duration)
        };

        // Ensure expires_at matches earliest + configured duration
        let chrono_dur = chrono::Duration::from_std(duration)
            .unwrap_or_else(|_| chrono::Duration::hours(24));
        rec.first_activated_at = earliest.to_rfc3339();
        rec.expires_at = (earliest + chrono_dur).to_rfc3339();
        rec
    } else {
        // First ever activation on this machine
        log::info!("🌱 First activation detected. Initializing new timer...");
        let now = Utc::now();
        ActivationRecord::new(now, duration)
    };

    // Synchronize across all persistence stores
    let _ = write_to_file(&record);
    let _ = write_registry_record(&record);
    let _ = sync_to_db(&record);

    log::info!(
        "⏱️ Activation state verified: First activated: {}, Expires: {}, Remaining: {}s",
        record.first_activated_at,
        record.expires_at,
        record.remaining_seconds()
    );

    Ok(record)
}

fn rec_check_expires(rec: &mut ActivationRecord, earliest: DateTime<Utc>, chrono_dur: chrono::Duration) {
    rec.first_activated_at = earliest.to_rfc3339();
    rec.expires_at = (earliest + chrono_dur).to_rfc3339();
}

/// Marks the activation record as having triggered uninstallation.
pub fn mark_uninstallation_triggered() -> Result<(), String> {
    if let Some(mut record) = read_from_file() {
        record.uninstallation_triggered = true;
        let _ = write_to_file(&record);
    }
    Ok(())
}

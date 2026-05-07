use rusqlite::Connection;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

pub fn get_db_dir() -> PathBuf {
    if let Ok(custom_db_path) = env::var("DB_PATH") {
        let db_path = PathBuf::from(custom_db_path);

        if let Some(parent) = db_path.parent() {
            if !parent.as_os_str().is_empty() {
                fs::create_dir_all(parent).expect("Failed to create custom DB folder");
                return parent.to_path_buf();
            }
        }
    }

    let mut path = dirs::data_dir().expect("Failed to get data dir");
    path.push("lab-management-system");

    fs::create_dir_all(&path).expect("Failed to create app data folder");

    path
}

pub fn get_db_path() -> PathBuf {
    if let Ok(custom_db_path) = env::var("DB_PATH") {
        let db_path = PathBuf::from(custom_db_path);

        if let Some(parent) = db_path.parent() {
            if !parent.as_os_str().is_empty() {
                fs::create_dir_all(parent).expect("Failed to create custom DB folder");
            }
        }

        return db_path;
    }

    get_db_dir().join("lab_data.db")
}

pub fn get_connection() -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;

    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.busy_timeout(Duration::from_secs(5))?;

    Ok(conn)
}

fn max_backup_count() -> usize {
    env::var("MAX_BACKUPS")
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(5)
}

fn is_db_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("db"))
        .unwrap_or(false)
}

fn list_backups(backup_dir: &Path) -> Result<Vec<(PathBuf, SystemTime)>, String> {
    if !backup_dir.exists() {
        return Ok(Vec::new());
    }

    let mut backups = fs::read_dir(backup_dir)
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_file() && is_db_file(&entry.path()))
        .filter_map(|entry| {
            let modified = entry.metadata().ok()?.modified().ok()?;
            Some((entry.path(), modified))
        })
        .collect::<Vec<_>>();

    backups.sort_by_key(|(_, modified)| *modified);

    Ok(backups)
}

fn prune_old_backups(backup_dir: &Path) -> Result<(), String> {
    let keep = max_backup_count();
    let backups = list_backups(backup_dir)?;

    if backups.len() <= keep {
        return Ok(());
    }

    let remove_count = backups.len() - keep;

    for (path, _) in backups.into_iter().take(remove_count) {
        let _ = fs::remove_file(path);
    }

    Ok(())
}

#[tauri::command]
pub fn export_backup() -> Result<String, String> {
    let db_path = get_db_path();
    let backup_dir = get_db_dir().join("backups");

    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    let conn = get_connection().map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(|e| e.to_string())?;
    drop(conn);

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let backup_path = backup_dir.join(format!("lab_backup_{}.db", timestamp));

    fs::copy(&db_path, &backup_path).map_err(|e| e.to_string())?;

    prune_old_backups(&backup_dir)?;

    Ok(backup_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn restore_backup() -> Result<String, String> {
    let db_path = get_db_path();
    let backup_dir = get_db_dir().join("backups");

    if !backup_dir.exists() {
        return Err("Backup folder not found".into());
    }

    let backups = list_backups(&backup_dir)?;

    let latest_backup = backups
        .last()
        .ok_or_else(|| "No backup found".to_string())?
        .0
        .clone();

    let wal_path = db_path.with_extension("db-wal");
    let shm_path = db_path.with_extension("db-shm");

    let _ = fs::remove_file(&wal_path);
    let _ = fs::remove_file(&shm_path);

    fs::copy(&latest_backup, &db_path).map_err(|e| e.to_string())?;

    let _ = fs::remove_file(&wal_path);
    let _ = fs::remove_file(&shm_path);

    Ok(format!(
        "Database restored from {}. Please restart the application.",
        latest_backup.to_string_lossy()
    ))
}
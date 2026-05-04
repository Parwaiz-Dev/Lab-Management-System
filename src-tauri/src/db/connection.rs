use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;

// 📁 DB PATH (centralized)
pub fn get_db_path() -> PathBuf {
    let mut path = dirs::data_dir().expect("Failed to get data dir");

    path.push("lab-management-system");

    std::fs::create_dir_all(&path).expect("Failed to create folder");

    path.join("lab_data.db")
}

// 🔌 DB CONNECTION
pub fn get_connection() -> Connection {
    let db_path = get_db_path();

    println!("DB PATH: {:?}", db_path);

    Connection::open(db_path).expect("Failed to open DB")
}

// 📤 EXPORT BACKUP
#[tauri::command]
pub fn export_backup() -> Result<String, String> {
    let db_path = get_db_path();

    let backup_path = db_path.with_file_name("lab_backup.db");

    fs::copy(&db_path, &backup_path)
        .map_err(|e| e.to_string())?;

    Ok(backup_path.to_string_lossy().to_string())
}

// 📥 RESTORE BACKUP
#[tauri::command]
pub fn restore_backup() -> Result<String, String> {
    let db_path = get_db_path();

    let backup_path = db_path.with_file_name("lab_backup.db");

    if !backup_path.exists() {
        return Err("Backup not found".into());
    }

    fs::copy(&backup_path, &db_path)
        .map_err(|e| e.to_string())?;

    Ok("Database restored successfully".into())
}
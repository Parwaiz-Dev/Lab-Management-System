use std::sync::Mutex;

use tauri::State;

use super::model::{LoginRequest, LoginResponse, SessionInfo, User, UserRole};
use super::service;
use crate::errors::{AppError, AppResult};
use crate::modules::audit::service::create_audit_log;

/// Shared session state — None means no one is logged in.
pub type AuthState = Mutex<Option<SessionInfo>>;

/// Login with username and password. Returns user info on success and stores session.
#[tauri::command]
pub fn login(
    db: State<'_, Mutex<rusqlite::Connection>>,
    auth: State<'_, AuthState>,
    username: String,
    password: String,
) -> Result<LoginResponse, AppError> {
    let conn = db
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    let req = LoginRequest {
        username: username.clone(),
        password,
    };

    let response = service::login(&conn, &req)?;

    // Store session in state
    let mut session = auth
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;
    *session = Some(SessionInfo {
        user_id: response.user_id,
        username: response.username.clone(),
        role: UserRole::try_from(response.role.as_str()).unwrap_or(UserRole::Staff),
        must_change_password: response.must_change_password,
    });

    // Audit: user login — NEVER log password
    create_audit_log(
        &conn,
        response.user_id as i64,
        "login",
        "users",
        Some(response.user_id as i64),
        None,
        None,
    );

    Ok(response)
}

/// Logout — clears the current session and writes an audit entry.
#[tauri::command]
pub fn logout(
    db: State<'_, Mutex<rusqlite::Connection>>,
    auth: State<'_, AuthState>,
) -> Result<String, AppError> {
    let mut session = auth
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    let user_id = session.as_ref().map(|s| s.user_id);
    let username = session.as_ref().map(|s| s.username.clone());

    // Audit: user logout — BEFORE clearing the session
    if let Some(uid) = user_id {
        if let Ok(conn) = db.lock() {
            create_audit_log(&conn, uid as i64, "logout", "auth", None, None, None);
        }
    }

    *session = None;

    if let Some(name) = &username {
        log::info!("User '{}' logged out", name);
    }

    Ok("Logged out successfully".to_string())
}

/// Get the current session info (null if not logged in).
#[tauri::command]
pub fn get_current_session(auth: State<'_, AuthState>) -> Result<Option<SessionInfo>, AppError> {
    let session = auth
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;
    Ok(session.clone())
}

/// Create a new user (admin only).  Passwords are NEVER logged.
#[tauri::command]
pub fn create_user(
    db: State<'_, Mutex<rusqlite::Connection>>,
    auth: State<'_, AuthState>,
    username: String,
    password: String,
    role: String,
) -> Result<User, AppError> {
    let session = auth
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;
    let session = session
        .as_ref()
        .ok_or_else(|| AppError::AuthError("Not logged in".to_string()))?;

    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError(
            "Only admins can create users".to_string(),
        ));
    }

    let conn = db
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    let role_enum = UserRole::try_from(role.as_str()).map_err(|e| AppError::ValidationError(e))?;

    let user = service::create_user(&conn, &username, &password, role_enum)?;

    // Audit: user created — password hash is NEVER included
    let new_data = serde_json::json!({
        "username": &username,
        "role": user.role
    });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "create",
        "users",
        Some(user.id as i64),
        None,
        Some(&new_data.to_string()),
    );

    Ok(user)
}

/// List all users (admin only).
#[tauri::command]
pub fn list_users(
    db: State<'_, Mutex<rusqlite::Connection>>,
    auth: State<'_, AuthState>,
) -> Result<Vec<User>, AppError> {
    let session = auth
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;
    let session = session
        .as_ref()
        .ok_or_else(|| AppError::AuthError("Not logged in".to_string()))?;

    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError(
            "Only admins can list users".to_string(),
        ));
    }

    let conn = db
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    service::list_users(&conn)
}

/// Toggle user active/inactive (admin only).
#[tauri::command]
pub fn toggle_user_active(
    db: State<'_, Mutex<rusqlite::Connection>>,
    auth: State<'_, AuthState>,
    user_id: i32,
) -> Result<String, AppError> {
    let session = auth
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;
    let session = session
        .as_ref()
        .ok_or_else(|| AppError::AuthError("Not logged in".to_string()))?;

    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError(
            "Only admins can manage users".to_string(),
        ));
    }

    let mut conn = db
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    // Snapshot user active state before toggle
    let old_data = crate::modules::audit::service::snapshot_row(
        &conn,
        "users",
        "id",
        user_id as i64,
        &["is_active"],
    )
    .unwrap_or(None);

    let result = service::toggle_user_active(&mut conn, session.user_id, user_id)?;

    // Audit: user activated/deactivated
    create_audit_log(
        &conn,
        session.user_id as i64,
        "toggle_active",
        "users",
        Some(user_id as i64),
        old_data.as_deref(),
        None,
    );

    Ok(result)
}

/// Admin resets another user's password.
#[tauri::command]
pub fn admin_reset_password(
    db: State<'_, Mutex<rusqlite::Connection>>,
    auth: State<'_, AuthState>,
    target_user_id: i32,
    new_password: String,
) -> Result<String, AppError> {
    let session = auth
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;
    let session = session
        .as_ref()
        .ok_or_else(|| AppError::AuthError("Not logged in".to_string()))?;

    if !session.role.can_manage_settings() {
        return Err(AppError::AuthError(
            "Only admins can reset passwords".to_string(),
        ));
    }

    let mut conn = db
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    let result =
        service::admin_reset_password(&mut conn, session.user_id, target_user_id, &new_password)?;

    // Audit: reset password — NEVER log password or hash
    let new_data = serde_json::json!({
        "must_change_password": true
    });
    create_audit_log(
        &conn,
        session.user_id as i64,
        "reset_password",
        "users",
        Some(target_user_id as i64),
        None,
        Some(&new_data.to_string()),
    );

    Ok(result)
}

/// User changes their own password from Settings.
#[tauri::command]
pub fn change_password(
    db: State<'_, Mutex<rusqlite::Connection>>,
    auth: State<'_, AuthState>,
    current_password: String,
    new_password: String,
) -> Result<String, AppError> {
    let mut session = auth
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;
    let user_id = session
        .as_ref()
        .map(|s| s.user_id)
        .ok_or_else(|| AppError::AuthError("Not logged in".to_string()))?;

    let mut conn = db
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    let result = service::change_password(&mut conn, user_id, &current_password, &new_password)?;

    if let Some(s) = session.as_mut() {
        s.must_change_password = false;
    }

    // Audit: change password — NEVER log password or hash
    create_audit_log(
        &conn,
        user_id as i64,
        "change_password",
        "users",
        Some(user_id as i64),
        None,
        None,
    );

    Ok(result)
}

/// User completes forced password change after admin reset.
#[tauri::command]
pub fn force_change_password(
    db: State<'_, Mutex<rusqlite::Connection>>,
    auth: State<'_, AuthState>,
    current_password: String,
    new_password: String,
) -> Result<String, AppError> {
    let mut session = auth
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;
    let user_id = session
        .as_ref()
        .map(|s| s.user_id)
        .ok_or_else(|| AppError::AuthError("Not logged in".to_string()))?;

    let mut conn = db
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    let result =
        service::force_change_password(&mut conn, user_id, &current_password, &new_password)?;

    if let Some(s) = session.as_mut() {
        s.must_change_password = false;
    }

    // Audit: forced password change — NEVER log password or hash
    let old_data = serde_json::json!({ "must_change_password": true });
    let new_data = serde_json::json!({ "must_change_password": false });
    create_audit_log(
        &conn,
        user_id as i64,
        "force_change_password",
        "users",
        Some(user_id as i64),
        Some(&old_data.to_string()),
        Some(&new_data.to_string()),
    );

    Ok(result)
}

/// Helper: extract the current session from AuthState.
/// Returns AuthError if not logged in.
pub fn require_auth(auth: &AuthState) -> AppResult<SessionInfo> {
    let session = auth
        .lock()
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    session
        .clone()
        .ok_or_else(|| AppError::AuthError("Authentication required. Please log in.".to_string()))
}

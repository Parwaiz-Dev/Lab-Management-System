use bcrypt::{hash, verify, DEFAULT_COST};
use rusqlite::Connection;

use super::model::{LoginRequest, LoginResponse, User, UserRole};
use crate::errors::{AppError, AppResult};

/// Authenticate a user with username and password.
/// Returns LoginResponse with user info on success.
pub fn login(conn: &Connection, req: &LoginRequest) -> AppResult<LoginResponse> {
    let user = get_user_by_username(conn, &req.username)?
        .ok_or_else(|| AppError::AuthError("Invalid username or password".to_string()))?;

    if !user.is_active {
        return Err(AppError::AuthError(
            "This account has been deactivated".to_string(),
        ));
    }

    let password_valid = verify(&req.password, &user.password_hash)
        .map_err(|e| AppError::InternalError(format!("Password verification failed: {}", e)))?;

    if !password_valid {
        return Err(AppError::AuthError(
            "Invalid username or password".to_string(),
        ));
    }

    log::info!("User '{}' logged in as {}", user.username, user.role);

    Ok(LoginResponse {
        user_id: user.id,
        username: user.username,
        role: user.role.to_string(),
        must_change_password: user.must_change_password,
    })
}

/// Create a new user with hashed password.
/// Only admins should be able to call this.
pub fn create_user(
    conn: &Connection,
    username: &str,
    password: &str,
    role: UserRole,
) -> AppResult<User> {
    if username.trim().is_empty() {
        return Err(AppError::ValidationError(
            "Username cannot be empty".to_string(),
        ));
    }

    if password.len() < 8 {
        return Err(AppError::ValidationError(
            "Password must be at least 8 characters".to_string(),
        ));
    }

    let password_hash = hash(password, DEFAULT_COST)
        .map_err(|e| AppError::InternalError(format!("Password hashing failed: {}", e)))?;

    let role_str = role.to_string();

    conn.execute(
        "INSERT INTO users (username, password_hash, role, is_active, must_change_password) VALUES (?1, ?2, ?3, 1, 0)",
        rusqlite::params![username.trim(), password_hash, role_str],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            AppError::DuplicateError(format!("Username '{}' already exists", username))
        } else {
            AppError::from(e)
        }
    })?;

    let id = conn.last_insert_rowid() as i32;

    log::info!("Created new user '{}' with role {}", username, role);

    Ok(User {
        id,
        username: username.trim().to_string(),
        password_hash,
        role,
        is_active: true,
        must_change_password: false,
        created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

/// Fetch a user by username. Returns None if not found.
pub fn get_user_by_username(conn: &Connection, username: &str) -> AppResult<Option<User>> {
    let mut stmt = conn.prepare(
        "SELECT id, username, password_hash, role, is_active, must_change_password, created_at
         FROM users WHERE username = ?1",
    )?;

    let mut rows = stmt.query_map(rusqlite::params![username.trim()], |row| {
        let role_str: String = row.get(3)?;
        Ok(User {
            id: row.get(0)?,
            username: row.get(1)?,
            password_hash: row.get(2)?,
            role: UserRole::try_from(role_str.as_str()).unwrap_or(UserRole::Staff),
            is_active: row.get::<_, i32>(4)? == 1,
            must_change_password: row.get::<_, i32>(5)? == 1,
            created_at: row.get(6)?,
        })
    })?;

    match rows.next() {
        Some(Ok(user)) => Ok(Some(user)),
        Some(Err(e)) => Err(AppError::from(e)),
        None => Ok(None),
    }
}

/// List all users (passwords excluded).
pub fn list_users(conn: &Connection) -> AppResult<Vec<User>> {
    let mut stmt = conn.prepare(
        "SELECT id, username, password_hash, role, is_active, must_change_password, created_at
         FROM users ORDER BY id",
    )?;

    let users: Result<Vec<_>, _> = stmt
        .query_map([], |row| {
            let role_str: String = row.get(3)?;
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                password_hash: row.get(2)?,
                role: UserRole::try_from(role_str.as_str()).unwrap_or(UserRole::Staff),
                is_active: row.get::<_, i32>(4)? == 1,
                must_change_password: row.get::<_, i32>(5)? == 1,
                created_at: row.get(6)?,
            })
        })?
        .collect();

    users.map_err(AppError::from)
}

/// Toggle user active status. Admins only.
/// Enforces business rules:
/// 1. Administrator cannot deactivate their own account.
/// 2. The last active administrator cannot be deactivated.
pub fn toggle_user_active(
    conn: &mut Connection,
    acting_user_id: i32,
    target_user_id: i32,
) -> AppResult<String> {
    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;

    let (target_role_str, current_active): (String, i32) = tx
        .query_row(
            "SELECT role, is_active FROM users WHERE id = ?1",
            rusqlite::params![target_user_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| {
            if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
                AppError::NotFound(format!("User with ID {} not found", target_user_id))
            } else {
                AppError::from(e)
            }
        })?;

    let is_deactivating = current_active == 1;

    if is_deactivating {
        // Rule 1: Administrator cannot deactivate their own account
        if target_user_id == acting_user_id {
            return Err(AppError::ValidationError(
                "You cannot deactivate your own administrator account.".to_string(),
            ));
        }

        // Rule 2 & 3: Cannot deactivate the last active administrator
        let target_role = UserRole::try_from(target_role_str.as_str()).unwrap_or(UserRole::Staff);
        if target_role == UserRole::Admin {
            let active_admin_count: i64 = tx.query_row(
                "SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1",
                [],
                |row| row.get(0),
            )?;

            if active_admin_count <= 1 {
                return Err(AppError::ValidationError(
                    "The last active administrator cannot be deactivated. Create another administrator first.".to_string(),
                ));
            }
        }
    }

    let new_status = if is_deactivating { 0 } else { 1 };
    let label = if new_status == 1 {
        "activated"
    } else {
        "deactivated"
    };

    tx.execute(
        "UPDATE users SET is_active = ?1 WHERE id = ?2",
        rusqlite::params![new_status, target_user_id],
    )?;

    tx.commit()?;

    log::info!("User {} has been {}", target_user_id, label);

    Ok(format!("User {} successfully", label))
}

/// Admin resets another user's password.
/// Requires minimum 8 characters. Sets must_change_password = 1.
pub fn admin_reset_password(
    conn: &mut Connection,
    acting_user_id: i32,
    target_user_id: i32,
    new_password: &str,
) -> AppResult<String> {
    if new_password.len() < 8 {
        return Err(AppError::ValidationError(
            "Password must be at least 8 characters".to_string(),
        ));
    }

    if acting_user_id == target_user_id {
        return Err(AppError::ValidationError(
            "You cannot reset your own password here. Use 'Change Password' in Settings."
                .to_string(),
        ));
    }

    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;

    let target_exists: bool = tx
        .query_row(
            "SELECT 1 FROM users WHERE id = ?1",
            rusqlite::params![target_user_id],
            |_| Ok(true),
        )
        .unwrap_or(false);

    if !target_exists {
        return Err(AppError::NotFound(format!(
            "User with ID {} not found",
            target_user_id
        )));
    }

    let password_hash = hash(new_password, DEFAULT_COST)
        .map_err(|e| AppError::InternalError(format!("Password hashing failed: {}", e)))?;

    tx.execute(
        "UPDATE users SET password_hash = ?1, must_change_password = 1 WHERE id = ?2",
        rusqlite::params![password_hash, target_user_id],
    )?;

    tx.commit()?;

    log::info!(
        "Admin {} reset password for user {}",
        acting_user_id,
        target_user_id
    );
    Ok("Password reset successfully".to_string())
}

/// User changes their own password from Settings.
/// Verifies current password, enforces minimum 8 characters, hashes new password,
/// and clears must_change_password.
pub fn change_password(
    conn: &mut Connection,
    user_id: i32,
    current_password: &str,
    new_password: &str,
) -> AppResult<String> {
    if new_password.len() < 8 {
        return Err(AppError::ValidationError(
            "Password must be at least 8 characters".to_string(),
        ));
    }

    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;

    let current_hash: String = tx
        .query_row(
            "SELECT password_hash FROM users WHERE id = ?1",
            rusqlite::params![user_id],
            |row| row.get(0),
        )
        .map_err(|e| {
            if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
                AppError::NotFound(format!("User with ID {} not found", user_id))
            } else {
                AppError::from(e)
            }
        })?;

    let is_valid = verify(current_password, &current_hash)
        .map_err(|e| AppError::InternalError(format!("Password verification failed: {}", e)))?;

    if !is_valid {
        return Err(AppError::ValidationError(
            "Current password is incorrect".to_string(),
        ));
    }

    let new_hash = hash(new_password, DEFAULT_COST)
        .map_err(|e| AppError::InternalError(format!("Password hashing failed: {}", e)))?;

    tx.execute(
        "UPDATE users SET password_hash = ?1, must_change_password = 0 WHERE id = ?2",
        rusqlite::params![new_hash, user_id],
    )?;

    tx.commit()?;

    log::info!("User {} successfully changed their password", user_id);
    Ok("Password changed successfully".to_string())
}

/// User completes forced password change after admin reset.
/// Verifies current (temporary) password, enforces minimum 8 characters,
/// hashes new password, and clears must_change_password.
pub fn force_change_password(
    conn: &mut Connection,
    user_id: i32,
    current_password: &str,
    new_password: &str,
) -> AppResult<String> {
    if new_password.len() < 8 {
        return Err(AppError::ValidationError(
            "Password must be at least 8 characters".to_string(),
        ));
    }

    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;

    let current_hash: String = tx
        .query_row(
            "SELECT password_hash FROM users WHERE id = ?1",
            rusqlite::params![user_id],
            |row| row.get(0),
        )
        .map_err(|e| {
            if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
                AppError::NotFound(format!("User with ID {} not found", user_id))
            } else {
                AppError::from(e)
            }
        })?;

    let is_valid = verify(current_password, &current_hash)
        .map_err(|e| AppError::InternalError(format!("Password verification failed: {}", e)))?;

    if !is_valid {
        return Err(AppError::ValidationError(
            "Current password is incorrect".to_string(),
        ));
    }

    let new_hash = hash(new_password, DEFAULT_COST)
        .map_err(|e| AppError::InternalError(format!("Password hashing failed: {}", e)))?;

    tx.execute(
        "UPDATE users SET password_hash = ?1, must_change_password = 0 WHERE id = ?2",
        rusqlite::params![new_hash, user_id],
    )?;

    tx.commit()?;

    log::info!("User {} completed forced password change", user_id);
    Ok("Password updated successfully".to_string())
}

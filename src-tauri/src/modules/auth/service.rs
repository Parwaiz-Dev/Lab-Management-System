use bcrypt::{hash, verify, DEFAULT_COST};
use rusqlite::Connection;

use crate::errors::{AppError, AppResult};
use super::model::{LoginRequest, LoginResponse, User, UserRole};

/// Authenticate a user with username and password.
/// Returns LoginResponse with user info on success.
pub fn login(conn: &Connection, req: &LoginRequest) -> AppResult<LoginResponse> {
    let user = get_user_by_username(conn, &req.username)?
        .ok_or_else(|| AppError::AuthError("Invalid username or password".to_string()))?;

    if !user.is_active {
        return Err(AppError::AuthError("This account has been deactivated".to_string()));
    }

    let password_valid = verify(&req.password, &user.password_hash)
        .map_err(|e| AppError::InternalError(format!("Password verification failed: {}", e)))?;

    if !password_valid {
        return Err(AppError::AuthError("Invalid username or password".to_string()));
    }

    log::info!("User '{}' logged in as {}", user.username, user.role);

    Ok(LoginResponse {
        user_id: user.id,
        username: user.username,
        role: user.role.to_string(),
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
        return Err(AppError::ValidationError("Username cannot be empty".to_string()));
    }

    if password.len() < 6 {
        return Err(AppError::ValidationError(
            "Password must be at least 6 characters".to_string(),
        ));
    }

    let password_hash = hash(password, DEFAULT_COST)
        .map_err(|e| AppError::InternalError(format!("Password hashing failed: {}", e)))?;

    let role_str = role.to_string();

    conn.execute(
        "INSERT INTO users (username, password_hash, role, is_active) VALUES (?1, ?2, ?3, 1)",
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
        created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

/// Fetch a user by username. Returns None if not found.
pub fn get_user_by_username(conn: &Connection, username: &str) -> AppResult<Option<User>> {
    let mut stmt = conn.prepare(
        "SELECT id, username, password_hash, role, is_active, created_at
         FROM users WHERE username = ?1",
    )?;

    let mut rows = stmt.query_map(rusqlite::params![username.trim()], |row| {
        let role_str: String = row.get(3)?;
        Ok(User {
            id: row.get(0)?,
            username: row.get(1)?,
            password_hash: row.get(2)?,
            role: UserRole::try_from(role_str.as_str())
                .unwrap_or(UserRole::Staff),
            is_active: row.get::<_, i32>(4)? == 1,
            created_at: row.get(5)?,
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
        "SELECT id, username, password_hash, role, is_active, created_at
         FROM users ORDER BY id",
    )?;

    let users: Result<Vec<_>, _> = stmt
        .query_map([], |row| {
            let role_str: String = row.get(3)?;
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                password_hash: row.get(2)?,
                role: UserRole::try_from(role_str.as_str())
                    .unwrap_or(UserRole::Staff),
                is_active: row.get::<_, i32>(4)? == 1,
                created_at: row.get(5)?,
            })
        })?
        .collect();

    users.map_err(AppError::from)
}

/// Toggle user active status. Admins only.
pub fn toggle_user_active(conn: &Connection, user_id: i32) -> AppResult<String> {
    let current: i32 = conn.query_row(
        "SELECT is_active FROM users WHERE id = ?1",
        rusqlite::params![user_id],
        |row| row.get(0),
    )?;

    let new_status = if current == 1 { 0 } else { 1 };
    let label = if new_status == 1 { "activated" } else { "deactivated" };

    conn.execute(
        "UPDATE users SET is_active = ?1 WHERE id = ?2",
        rusqlite::params![new_status, user_id],
    )?;

    log::info!("User {} has been {}", user_id, label);

    Ok(format!("User {} successfully", label))
}
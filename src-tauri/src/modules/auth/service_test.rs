/// Auth service integration tests.
///
/// These tests verify that the auth system:
/// 1. Correctly authenticates users with valid credentials
/// 2. Rejects invalid passwords, inactive users, and non-existent accounts
/// 3. Properly creates users with password hashing
/// 4. Validates input (username, password length, duplicates)
/// 5. Lists users and toggles active status
#[cfg(test)]
mod tests {
    use crate::modules::auth::model::{LoginRequest, UserRole};
    use crate::modules::auth::service;

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    fn test_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'staff',
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            ",
        )
        .unwrap();

        // Seed: create 'admin' user with known password
        let hash = bcrypt::hash("admin123", bcrypt::DEFAULT_COST).unwrap();
        conn.execute(
            "INSERT INTO users (id, username, password_hash, role, is_active) VALUES (1, 'admin', ?1, 'admin', 1)",
            rusqlite::params![hash],
        )
        .unwrap();

        // Seed: create inactive user
        let hash2 = bcrypt::hash("inactive123", bcrypt::DEFAULT_COST).unwrap();
        conn.execute(
            "INSERT INTO users (id, username, password_hash, role, is_active) VALUES (2, 'inactive', ?1, 'staff', 0)",
            rusqlite::params![hash2],
        )
        .unwrap();

        conn
    }

    // ------------------------------------------------------------------
    // 1. Login — happy path
    // ------------------------------------------------------------------

    #[test]
    fn login_with_valid_credentials() {
        let conn = test_db();
        let req = LoginRequest {
            username: "admin".into(),
            password: "admin123".into(),
        };

        let result = service::login(&conn, &req).unwrap();
        assert_eq!(result.username, "admin");
        assert_eq!(result.role, "admin");
        assert_eq!(result.user_id, 1);
    }

    // ------------------------------------------------------------------
    // 2. Login — wrong password
    // ------------------------------------------------------------------

    #[test]
    fn login_with_wrong_password() {
        let conn = test_db();
        let req = LoginRequest {
            username: "admin".into(),
            password: "wrongpassword".into(),
        };

        let err = service::login(&conn, &req).unwrap_err();
        assert!(err.to_string().contains("Invalid username or password"));
    }

    // ------------------------------------------------------------------
    // 3. Login — non-existent user
    // ------------------------------------------------------------------

    #[test]
    fn login_with_nonexistent_user() {
        let conn = test_db();
        let req = LoginRequest {
            username: "ghost".into(),
            password: "anything".into(),
        };

        let err = service::login(&conn, &req).unwrap_err();
        assert!(err.to_string().contains("Invalid username or password"));
    }

    // ------------------------------------------------------------------
    // 4. Login — inactive user
    // ------------------------------------------------------------------

    #[test]
    fn login_with_inactive_user() {
        let conn = test_db();
        let req = LoginRequest {
            username: "inactive".into(),
            password: "inactive123".into(),
        };

        let err = service::login(&conn, &req).unwrap_err();
        assert!(err.to_string().contains("deactivated"));
    }

    // ------------------------------------------------------------------
    // 5. Create user — happy path
    // ------------------------------------------------------------------

    #[test]
    fn create_user_success() {
        let conn = test_db();

        let user = service::create_user(&conn, "staff1", "mypassword", UserRole::Staff).unwrap();

        assert_eq!(user.username, "staff1");
        assert_eq!(user.role, UserRole::Staff);
        assert!(user.is_active);

        // Verify password is hashed (not plaintext)
        assert!(!user.password_hash.is_empty());
        assert_ne!(user.password_hash, "mypassword");
        assert!(user.password_hash.starts_with("$2b$"));
    }

    // ------------------------------------------------------------------
    // 6. Create user — empty username rejected
    // ------------------------------------------------------------------

    #[test]
    fn create_user_with_empty_username() {
        let conn = test_db();
        let err = service::create_user(&conn, "   ", "password1", UserRole::Staff).unwrap_err();
        assert!(err.to_string().contains("Username cannot be empty"));
    }

    // ------------------------------------------------------------------
    // 7. Create user — short password rejected
    // ------------------------------------------------------------------

    #[test]
    fn create_user_with_short_password() {
        let conn = test_db();
        let err = service::create_user(&conn, "newuser", "abc1234", UserRole::Staff).unwrap_err();
        assert!(err.to_string().contains("at least 8 characters"));
    }

    // ------------------------------------------------------------------
    // 8. Create user — duplicate username rejected
    // ------------------------------------------------------------------

    #[test]
    fn create_user_with_duplicate_username() {
        let conn = test_db();
        let err = service::create_user(&conn, "admin", "password1", UserRole::Staff).unwrap_err();
        assert!(err.to_string().contains("already exists"));
    }

    // ------------------------------------------------------------------
    // 9. List users
    // ------------------------------------------------------------------

    #[test]
    fn list_users_returns_all() {
        let conn = test_db();
        // Add one more user
        service::create_user(&conn, "staff1", "password1", UserRole::Staff).unwrap();

        let users = service::list_users(&conn).unwrap();
        assert_eq!(users.len(), 3); // admin, inactive, staff1
        assert_eq!(users[0].username, "admin");
        assert_eq!(users[1].username, "inactive");
        assert_eq!(users[2].username, "staff1");
    }

    // ------------------------------------------------------------------
    // 10. Toggle user active → deactivate
    // ------------------------------------------------------------------

    #[test]
    fn toggle_active_deactivates() {
        let conn = test_db();

        let msg = service::toggle_user_active(&conn, 1).unwrap();
        assert!(msg.contains("deactivated"));

        // Verify status changed
        let user = service::get_user_by_username(&conn, "admin").unwrap().unwrap();
        assert!(!user.is_active);
    }

    // ------------------------------------------------------------------
    // 11. Toggle user active → reactivate
    // ------------------------------------------------------------------

    #[test]
    fn toggle_active_reactivates() {
        let conn = test_db();

        let msg = service::toggle_user_active(&conn, 2).unwrap();
        assert!(msg.contains("activated"));

        let user = service::get_user_by_username(&conn, "inactive").unwrap().unwrap();
        assert!(user.is_active);
    }

    // ------------------------------------------------------------------
    // 12. Get user by username — found
    // ------------------------------------------------------------------

    #[test]
    fn get_user_by_username_found() {
        let conn = test_db();
        let user = service::get_user_by_username(&conn, "admin").unwrap().unwrap();
        assert_eq!(user.username, "admin");
        assert_eq!(user.role, UserRole::Admin);
    }

    // ------------------------------------------------------------------
    // 13. Get user by username — not found
    // ------------------------------------------------------------------

    #[test]
    fn get_user_by_username_not_found() {
        let conn = test_db();
        let user = service::get_user_by_username(&conn, "nobody").unwrap();
        assert!(user.is_none());
    }
}
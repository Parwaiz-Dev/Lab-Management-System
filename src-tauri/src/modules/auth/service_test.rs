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
                must_change_password INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            ",
        )
        .unwrap();

        // Seed: create 'admin' user with known password
        let hash = bcrypt::hash("admin123", bcrypt::DEFAULT_COST).unwrap();
        conn.execute(
            "INSERT INTO users (id, username, password_hash, role, is_active, must_change_password) VALUES (1, 'admin', ?1, 'admin', 1, 0)",
            rusqlite::params![hash],
        )
        .unwrap();

        // Seed: create inactive user
        let hash2 = bcrypt::hash("inactive123", bcrypt::DEFAULT_COST).unwrap();
        conn.execute(
            "INSERT INTO users (id, username, password_hash, role, is_active, must_change_password) VALUES (2, 'inactive', ?1, 'staff', 0, 0)",
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
        let err = service::create_user(&conn, "newuser", "1234567", UserRole::Staff).unwrap_err();
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
    // 10. Toggle user active — self-deactivation rejected
    // ------------------------------------------------------------------

    #[test]
    fn toggle_active_self_deactivation_rejected() {
        let mut conn = test_db();

        let err = service::toggle_user_active(&mut conn, 1, 1).unwrap_err();
        assert!(err
            .to_string()
            .contains("You cannot deactivate your own administrator account."));

        // Verify status unchanged
        let user = service::get_user_by_username(&conn, "admin")
            .unwrap()
            .unwrap();
        assert!(user.is_active);
    }

    // ------------------------------------------------------------------
    // 11. Toggle user active — last active admin rejected
    // ------------------------------------------------------------------

    #[test]
    fn toggle_active_last_active_admin_rejected() {
        let mut conn = test_db();

        // Even if acting user is a different user (e.g. user 2), cannot deactivate the sole active admin
        let err = service::toggle_user_active(&mut conn, 2, 1).unwrap_err();
        assert!(err.to_string().contains(
            "The last active administrator cannot be deactivated. Create another administrator first."
        ));

        // Verify status unchanged
        let user = service::get_user_by_username(&conn, "admin")
            .unwrap()
            .unwrap();
        assert!(user.is_active);
    }

    // ------------------------------------------------------------------
    // 12. Toggle user active — multiple admins allows deactivating other admin
    // ------------------------------------------------------------------

    #[test]
    fn toggle_active_multiple_admins() {
        let mut conn = test_db();

        // Create a second active admin
        let admin2 = service::create_user(&conn, "admin2", "admin2pass", UserRole::Admin).unwrap();
        assert!(admin2.is_active);

        // Admin 1 deactivates admin 2 -> Allowed because admin 1 remains active
        let msg = service::toggle_user_active(&mut conn, 1, admin2.id).unwrap();
        assert!(msg.contains("deactivated"));

        let updated_admin2 = service::get_user_by_username(&conn, "admin2")
            .unwrap()
            .unwrap();
        assert!(!updated_admin2.is_active);

        // Now with only 1 active admin left (admin 1), attempting to deactivate admin 1 must fail
        let err = service::toggle_user_active(&mut conn, admin2.id, 1).unwrap_err();
        assert!(err.to_string().contains(
            "The last active administrator cannot be deactivated. Create another administrator first."
        ));

        // Reactivating admin 2 is allowed
        let msg = service::toggle_user_active(&mut conn, 1, admin2.id).unwrap();
        assert!(msg.contains("activated"));

        let reactivated_admin2 = service::get_user_by_username(&conn, "admin2")
            .unwrap()
            .unwrap();
        assert!(reactivated_admin2.is_active);
    }

    // ------------------------------------------------------------------
    // 13. Toggle user active — staff deactivation and reactivation
    // ------------------------------------------------------------------

    #[test]
    fn toggle_active_staff() {
        let mut conn = test_db();

        // Create staff
        let staff = service::create_user(&conn, "staff1", "staffpass123", UserRole::Staff).unwrap();
        assert!(staff.is_active);

        // Deactivate staff
        let msg = service::toggle_user_active(&mut conn, 1, staff.id).unwrap();
        assert!(msg.contains("deactivated"));

        let updated = service::get_user_by_username(&conn, "staff1")
            .unwrap()
            .unwrap();
        assert!(!updated.is_active);

        // Reactivate staff
        let msg = service::toggle_user_active(&mut conn, 1, staff.id).unwrap();
        assert!(msg.contains("activated"));

        let reactivated = service::get_user_by_username(&conn, "staff1")
            .unwrap()
            .unwrap();
        assert!(reactivated.is_active);
    }

    // ------------------------------------------------------------------
    // 14. Toggle user active → reactivate existing inactive user
    // ------------------------------------------------------------------

    #[test]
    fn toggle_active_reactivates() {
        let mut conn = test_db();

        let msg = service::toggle_user_active(&mut conn, 1, 2).unwrap();
        assert!(msg.contains("activated"));

        let user = service::get_user_by_username(&conn, "inactive")
            .unwrap()
            .unwrap();
        assert!(user.is_active);
    }

    // ------------------------------------------------------------------
    // 15. Toggle user active → non-existent user returns not found
    // ------------------------------------------------------------------

    #[test]
    fn toggle_active_nonexistent_user() {
        let mut conn = test_db();

        let err = service::toggle_user_active(&mut conn, 1, 999).unwrap_err();
        assert!(err.to_string().contains("User with ID 999 not found"));
    }

    // ------------------------------------------------------------------
    // 16. Get user by username — found
    // ------------------------------------------------------------------

    #[test]
    fn get_user_by_username_found() {
        let conn = test_db();
        let user = service::get_user_by_username(&conn, "admin")
            .unwrap()
            .unwrap();
        assert_eq!(user.username, "admin");
        assert_eq!(user.role, UserRole::Admin);
    }

    // ------------------------------------------------------------------
    // 17. Get user by username — not found
    // ------------------------------------------------------------------

    #[test]
    fn get_user_by_username_not_found() {
        let conn = test_db();
        let user = service::get_user_by_username(&conn, "nobody").unwrap();
        assert!(user.is_none());
    }

    // ------------------------------------------------------------------
    // 18. Admin reset password — staff success
    // ------------------------------------------------------------------

    #[test]
    fn admin_reset_password_staff_success() {
        let mut conn = test_db();
        let staff = service::create_user(&conn, "staff1", "staffpass123", UserRole::Staff).unwrap();

        let msg = service::admin_reset_password(&mut conn, 1, staff.id, "newtemppass123").unwrap();
        assert!(msg.contains("successfully"));

        // Verify must_change_password is true in database
        let user = service::get_user_by_username(&conn, "staff1")
            .unwrap()
            .unwrap();
        assert!(user.must_change_password);

        // Verify login works with new temporary password and reports must_change_password
        let req = LoginRequest {
            username: "staff1".into(),
            password: "newtemppass123".into(),
        };
        let login_res = service::login(&conn, &req).unwrap();
        assert!(login_res.must_change_password);
    }

    // ------------------------------------------------------------------
    // 19. Admin reset password — another admin success
    // ------------------------------------------------------------------

    #[test]
    fn admin_reset_password_another_admin() {
        let mut conn = test_db();
        let admin2 =
            service::create_user(&conn, "admin2", "admin2pass123", UserRole::Admin).unwrap();

        let msg =
            service::admin_reset_password(&mut conn, 1, admin2.id, "supernewpass123").unwrap();
        assert!(msg.contains("successfully"));

        let user = service::get_user_by_username(&conn, "admin2")
            .unwrap()
            .unwrap();
        assert!(user.must_change_password);
    }

    // ------------------------------------------------------------------
    // 20. Admin reset password — self reset rejected
    // ------------------------------------------------------------------

    #[test]
    fn admin_reset_password_self_rejected() {
        let mut conn = test_db();

        let err = service::admin_reset_password(&mut conn, 1, 1, "newpass12345").unwrap_err();
        assert!(err
            .to_string()
            .contains("Use 'Change Password' in Settings"));
    }

    // ------------------------------------------------------------------
    // 21. Admin reset password — short password rejected
    // ------------------------------------------------------------------

    #[test]
    fn admin_reset_password_short_rejected() {
        let mut conn = test_db();
        let staff = service::create_user(&conn, "staff1", "staffpass123", UserRole::Staff).unwrap();

        let err = service::admin_reset_password(&mut conn, 1, staff.id, "short7").unwrap_err();
        assert!(err.to_string().contains("at least 8 characters"));
    }

    // ------------------------------------------------------------------
    // 22. Admin reset password — nonexistent user rejected
    // ------------------------------------------------------------------

    #[test]
    fn admin_reset_password_nonexistent_user() {
        let mut conn = test_db();

        let err = service::admin_reset_password(&mut conn, 1, 9999, "newvalidpass123").unwrap_err();
        assert!(err.to_string().contains("User with ID 9999 not found"));
    }

    // ------------------------------------------------------------------
    // 23. Change own password — admin success
    // ------------------------------------------------------------------

    #[test]
    fn change_own_password_admin_success() {
        let mut conn = test_db();

        let msg = service::change_password(&mut conn, 1, "admin123", "brandnewpass123").unwrap();
        assert!(msg.contains("successfully"));

        // Verify old password fails
        let old_req = LoginRequest {
            username: "admin".into(),
            password: "admin123".into(),
        };
        assert!(service::login(&conn, &old_req).is_err());

        // Verify new password works and must_change_password is false
        let new_req = LoginRequest {
            username: "admin".into(),
            password: "brandnewpass123".into(),
        };
        let login_res = service::login(&conn, &new_req).unwrap();
        assert!(!login_res.must_change_password);
    }

    // ------------------------------------------------------------------
    // 24. Change own password — staff success
    // ------------------------------------------------------------------

    #[test]
    fn change_own_password_staff_success() {
        let mut conn = test_db();
        let staff = service::create_user(&conn, "staff1", "staffpass123", UserRole::Staff).unwrap();

        let msg = service::change_password(&mut conn, staff.id, "staffpass123", "newstaffpass123")
            .unwrap();
        assert!(msg.contains("successfully"));

        let new_req = LoginRequest {
            username: "staff1".into(),
            password: "newstaffpass123".into(),
        };
        let login_res = service::login(&conn, &new_req).unwrap();
        assert_eq!(login_res.username, "staff1");
    }

    // ------------------------------------------------------------------
    // 25. Change own password — wrong current password rejected
    // ------------------------------------------------------------------

    #[test]
    fn change_own_password_wrong_current() {
        let mut conn = test_db();

        let err =
            service::change_password(&mut conn, 1, "wrongpassword", "brandnewpass123").unwrap_err();
        assert!(err.to_string().contains("Current password is incorrect"));
    }

    // ------------------------------------------------------------------
    // 26. Change own password — short new password rejected
    // ------------------------------------------------------------------

    #[test]
    fn change_own_password_short_rejected() {
        let mut conn = test_db();

        let err = service::change_password(&mut conn, 1, "admin123", "short").unwrap_err();
        assert!(err.to_string().contains("at least 8 characters"));
    }

    // ------------------------------------------------------------------
    // 27. Force change password — clears flag and allows subsequent login
    // ------------------------------------------------------------------

    #[test]
    fn force_change_password_clears_flag() {
        let mut conn = test_db();
        let staff = service::create_user(&conn, "staff1", "staffpass123", UserRole::Staff).unwrap();

        // Admin resets staff password -> must_change_password = 1
        service::admin_reset_password(&mut conn, 1, staff.id, "temppass123").unwrap();
        let user = service::get_user_by_username(&conn, "staff1")
            .unwrap()
            .unwrap();
        assert!(user.must_change_password);

        // Staff completes forced password change with temporary password
        let msg =
            service::force_change_password(&mut conn, staff.id, "temppass123", "permanentpass123")
                .unwrap();
        assert!(msg.contains("successfully"));

        // Verify must_change_password is now cleared (0)
        let updated_user = service::get_user_by_username(&conn, "staff1")
            .unwrap()
            .unwrap();
        assert!(!updated_user.must_change_password);

        // Subsequent login works with permanent password and must_change_password is false
        let login_res = service::login(
            &conn,
            &LoginRequest {
                username: "staff1".into(),
                password: "permanentpass123".into(),
            },
        )
        .unwrap();
        assert!(!login_res.must_change_password);
    }

    // ------------------------------------------------------------------
    // 28. Force change password — wrong current temporary password rejected
    // ------------------------------------------------------------------

    #[test]
    fn force_change_password_wrong_current() {
        let mut conn = test_db();
        let staff = service::create_user(&conn, "staff1", "staffpass123", UserRole::Staff).unwrap();
        service::admin_reset_password(&mut conn, 1, staff.id, "temppass123").unwrap();

        let err =
            service::force_change_password(&mut conn, staff.id, "wrongtemp", "permanentpass123")
                .unwrap_err();
        assert!(err.to_string().contains("Current password is incorrect"));
    }
}

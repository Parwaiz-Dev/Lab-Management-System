use serde::{Deserialize, Serialize};

/// Represents a user in the system with role-based access.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i32,
    pub username: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub role: UserRole,
    pub is_active: bool,
    pub created_at: String,
}

/// Supported roles for lab management.
/// Admin: Full system access including settings, user management, backup/restore.
/// Staff: All operational tasks (patients, orders, results, payments, reports).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UserRole {
    Admin,
    Staff,
}

impl UserRole {
    /// Returns true if this role can access admin-only features (settings, user mgmt, backup/restore).
    pub fn can_manage_settings(&self) -> bool {
        matches!(self, UserRole::Admin)
    }

    /// Returns true if this role can manage test catalog.
    pub fn can_manage_catalog(&self) -> bool {
        matches!(self, UserRole::Admin | UserRole::Staff)
    }

    /// Returns true if this role can enter lab results.
    pub fn can_enter_results(&self) -> bool {
        matches!(self, UserRole::Admin | UserRole::Staff)
    }

    /// Returns true if this role can create orders and patients.
    pub fn can_create_orders(&self) -> bool {
        matches!(self, UserRole::Admin | UserRole::Staff)
    }

    /// Returns true if this role can view reports and receipts.
    pub fn can_view_reports(&self) -> bool {
        true // All roles can view reports
    }

    /// Returns true if this role can process payments.
    pub fn can_process_payments(&self) -> bool {
        matches!(self, UserRole::Admin | UserRole::Staff)
    }
}

impl std::fmt::Display for UserRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UserRole::Admin => write!(f, "admin"),
            UserRole::Staff => write!(f, "staff"),
        }
    }
}

impl TryFrom<&str> for UserRole {
    type Error = String;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value.trim().to_lowercase().as_str() {
            "admin" => Ok(UserRole::Admin),
            "staff" => Ok(UserRole::Staff),
            // Backward compatibility: accept legacy role names
            "technician" | "receptionist" => {
                log::warn!("Legacy role '{}' mapped to 'staff' — run migration v7 to update the database", value.trim());
                Ok(UserRole::Staff)
            }
            other => Err(format!("Unknown role: '{}'", other)),
        }
    }
}

/// Credentials sent from the frontend for login.
#[derive(Debug, Clone, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

/// Response sent back to the frontend after successful login.
#[derive(Debug, Clone, Serialize)]
pub struct LoginResponse {
    pub user_id: i32,
    pub username: String,
    pub role: String,
}

/// Session info stored in Tauri state to track the logged-in user.
#[derive(Debug, Clone, Serialize)]
pub struct SessionInfo {
    pub user_id: i32,
    pub username: String,
    pub role: UserRole,
}
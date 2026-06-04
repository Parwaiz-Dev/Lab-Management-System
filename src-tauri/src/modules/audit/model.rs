use serde::{Deserialize, Serialize};

/// A single audit log entry — immutable record of who did what and when.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogEntry {
    pub id: i64,
    pub user_id: i64,
    pub username: String,
    pub action: String,
    pub table_name: String,
    pub record_id: Option<i64>,
    pub old_data: Option<String>,
    pub new_data: Option<String>,
    pub created_at: String,
}

/// Summary of a user's recent actions (for activity feeds / compliance).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserActivitySummary {
    pub user_id: i64,
    pub username: String,
    pub total_actions: i64,
    pub last_action_at: String,
}
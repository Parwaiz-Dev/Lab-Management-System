use std::time::Duration;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ActivationRecord {
    /// UTC RFC-3339 string timestamp of the first activation.
    pub first_activated_at: String,
    /// UTC RFC-3339 string timestamp when expiration occurs.
    pub expires_at: String,
    /// Unique installation token.
    pub installation_id: String,
    /// Whether uninstallation has already been dispatched.
    pub uninstallation_triggered: bool,
}

impl ActivationRecord {
    pub fn new(first_activated_at: DateTime<Utc>, duration: Duration) -> Self {
        let chrono_duration = chrono::Duration::from_std(duration)
            .unwrap_or_else(|_| chrono::Duration::hours(24));
        let expires_at = first_activated_at + chrono_duration;
        let installation_id = format!(
            "{:x}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        );

        Self {
            first_activated_at: first_activated_at.to_rfc3339(),
            expires_at: expires_at.to_rfc3339(),
            installation_id,
            uninstallation_triggered: false,
        }
    }

    pub fn first_activated_at_datetime(&self) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(&self.first_activated_at)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now())
    }

    pub fn expires_at_datetime(&self) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(&self.expires_at)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now())
    }

    pub fn is_expired(&self) -> bool {
        Utc::now() >= self.expires_at_datetime()
    }

    pub fn remaining_seconds(&self) -> i64 {
        let diff = self.expires_at_datetime() - Utc::now();
        diff.num_seconds().max(0)
    }

    pub fn remaining_duration(&self) -> Duration {
        let secs = self.remaining_seconds();
        Duration::from_secs(secs as u64)
    }
}

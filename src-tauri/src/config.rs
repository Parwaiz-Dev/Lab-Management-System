/// ⚙️ Application Configuration Module
/// Centralized configuration for production deployments
/// Loads from environment variables with sensible defaults

use std::env;

/// Application Configuration
#[derive(Debug, Clone)]
pub struct Config {
    /// Application name
    pub app_name: String,
    
    /// Application version
    pub app_version: String,
    
    /// Environment: development, staging, production
    pub environment: Environment,
    
    /// Log level: trace, debug, info, warn, error
    pub log_level: String,
    
    /// Database path (optional custom location)
    pub db_path: Option<String>,
    
    /// Enable debug mode (extra logging)
    pub debug: bool,
    
    /// Maximum number of patient search results
    pub max_search_results: usize,
    
    /// Maximum backup files to keep
    pub max_backups: usize,
    
    /// Currency symbol for display
    pub currency_symbol: String,
    
    /// Enable analytics/telemetry
    pub analytics_enabled: bool,
}

/// Application Environment
#[derive(Debug, Clone, PartialEq)]
pub enum Environment {
    Development,
    Staging,
    Production,
}

impl Config {
    /// Load configuration from environment variables
    /// Panics if required environment variables are missing
    pub fn from_env() -> Self {
        let environment = match env::var("APP_ENV")
            .unwrap_or_else(|_| "development".to_string())
            .as_str()
        {
            "production" => Environment::Production,
            "staging" => Environment::Staging,
            _ => Environment::Development,
        };

        Config {
            app_name: env::var("APP_NAME")
                .unwrap_or_else(|_| "Lab Management System".to_string()),
            app_version: env::var("APP_VERSION")
                .unwrap_or_else(|_| "1.0.0".to_string()),
            environment: environment.clone(),
            log_level: env::var("LOG_LEVEL")
                .unwrap_or_else(|_| match environment {
                    Environment::Production => "warn".to_string(),
                    Environment::Staging => "info".to_string(),
                    Environment::Development => "debug".to_string(),
                }),
            db_path: env::var("DB_PATH").ok(),
            debug: env::var("DEBUG")
                .map(|v| v == "1" || v == "true")
                .unwrap_or(environment == Environment::Development),
            max_search_results: env::var("MAX_SEARCH_RESULTS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(10),
            max_backups: env::var("MAX_BACKUPS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(5),
            currency_symbol: env::var("CURRENCY_SYMBOL")
                .unwrap_or_else(|_| "₹".to_string()),
            analytics_enabled: env::var("ANALYTICS_ENABLED")
                .map(|v| v == "1" || v == "true")
                .unwrap_or(environment != Environment::Development),
        }
    }

    /// Get a default config for testing
    #[cfg(test)]
    pub fn test() -> Self {
        Config {
            app_name: "Lab Management System (Test)".to_string(),
            app_version: "1.0.0-test".to_string(),
            environment: Environment::Development,
            log_level: "debug".to_string(),
            db_path: None,
            debug: true,
            max_search_results: 10,
            max_backups: 5,
            currency_symbol: "₹".to_string(),
            analytics_enabled: false,
        }
    }

    /// Check if running in production
    pub fn is_production(&self) -> bool {
        self.environment == Environment::Production
    }

    /// Check if running in development
    pub fn is_development(&self) -> bool {
        self.environment == Environment::Development
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = Config::test();
        assert_eq!(config.environment, Environment::Development);
        assert!(!config.is_production());
        assert!(config.is_development());
    }
}

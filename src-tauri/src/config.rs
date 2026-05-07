use std::env;

#[derive(Debug, Clone, PartialEq)]
pub enum Environment {
    Development,
    Staging,
    Production,
}

#[derive(Debug, Clone)]
pub struct Config {
    pub app_name: String,
    pub app_version: String,
    pub environment: Environment,
    pub log_level: String,
}

impl Config {
    pub fn from_env() -> Self {
        let environment = Environment::from_env_value(
            &env::var("APP_ENV").unwrap_or_else(|_| "development".to_string()),
        );

        let default_log_level = match environment {
            Environment::Production => "warn",
            Environment::Staging => "info",
            Environment::Development => "debug",
        };

        Config {
            app_name: env::var("APP_NAME")
                .ok()
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty())
                .unwrap_or_else(|| "Lab Management System".to_string()),

            app_version: env::var("APP_VERSION")
                .ok()
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty())
                .unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_string()),

            environment,

            log_level: env::var("LOG_LEVEL")
                .ok()
                .map(|v| v.trim().to_lowercase())
                .filter(|v| matches!(v.as_str(), "trace" | "debug" | "info" | "warn" | "error"))
                .unwrap_or_else(|| default_log_level.to_string()),
        }
    }

    pub fn is_production(&self) -> bool {
        self.environment == Environment::Production
    }

    pub fn is_development(&self) -> bool {
        self.environment == Environment::Development
    }
}

impl Environment {
    fn from_env_value(value: &str) -> Self {
        match value.trim().to_lowercase().as_str() {
            "production" | "prod" => Environment::Production,
            "staging" | "stage" => Environment::Staging,
            _ => Environment::Development,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_environment() {
        assert_eq!(
            Environment::from_env_value("production"),
            Environment::Production
        );

        assert_eq!(Environment::from_env_value("prod"), Environment::Production);
        assert_eq!(Environment::from_env_value("staging"), Environment::Staging);
        assert_eq!(Environment::from_env_value("dev"), Environment::Development);
    }
}
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiProvider {
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub models: Vec<String>,
    pub default_model: Option<String>,
    pub additional_headers: Option<HashMap<String, String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub proxy_mode: String, // "none", "system", "custom"
    pub proxy_url: Option<String>,
    pub ai_providers: Vec<AiProvider>,
    pub active_ai_provider: Option<String>,
    pub theme_mode: String, // "light", "dark", "system"
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            proxy_mode: "system".to_string(),
            proxy_url: None,
            ai_providers: vec![],
            active_ai_provider: None,
            theme_mode: "system".to_string(),
        }
    }
}

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppConfig {
    pub server_port: u16,
    pub openai_api_key: Option<String>,
    pub openai_api_endpoint: Option<String>,
}

pub fn load_config(_app_config_dir: PathBuf) -> AppConfig {
    // Default config
    let default = AppConfig {
        server_port: 8080,
        openai_api_key: None,
        openai_api_endpoint: None,
    };

    // Attempt to load from file
    // ...
    default
}

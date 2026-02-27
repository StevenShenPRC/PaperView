use reqwest::{Client, Proxy};
use std::time::Duration;
// use serde_json::Value; - Removed unused import
// use tauri_plugin_store::StoreExt; - Removed unused import

#[derive(Debug, Clone)]
pub enum ProxyConfig {
    None,
    System,
    Custom(String),
}

pub fn create_client(_app: &tauri::AppHandle) -> Result<Client, String> {
    // 1. Get proxy config from store
    // We need to access the store manually.
    // Since this is a synchronous helper, we might need to block or pass the config in.
    // However, to keep it simple and consistent, we'll try to read from the store if possible,
    // or better yet, pass the proxy config string to this function.

    // For now, let's implement a version that takes an optional proxy string
    // and we will handle store reading in the command handler.
    Err("Use create_client_with_config instead".to_string())
}

pub fn create_client_with_config(
    proxy_mode: &str,
    proxy_url: Option<&str>,
    timeout_secs: Option<u64>,
) -> Result<Client, String> {
    let mut builder = Client::builder().timeout(Duration::from_secs(timeout_secs.unwrap_or(30)));

    match proxy_mode {
        "system" => {
            // reqwest uses system proxy by default if not specified otherwise
            // but explicit check is good
            // builder = builder;
        }
        "custom" => {
            if let Some(url) = proxy_url {
                if !url.is_empty() {
                    let proxy = Proxy::all(url).map_err(|e| format!("Invalid proxy URL: {}", e))?;
                    builder = builder.proxy(proxy);
                }
            }
        }
        "none" => {
            builder = builder.no_proxy();
        }
        _ => {} // default to system or none? Let's default to system (reqwest default)
    }

    builder
        .build()
        .map_err(|e| format!("Failed to build client: {}", e))
}

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelMetadata {
    pub id: String,
    pub r#type: String, // 'chat' | 'embedding' | 'audio' | 'image' | 'rerank' | 'unknown'
    pub context_length: Option<u64>,
    pub multimodal: Option<bool>,
    pub custom: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiProvider {
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub models: Vec<ModelMetadata>,
    pub additional_headers: Option<HashMap<String, String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelRouting {
    pub provider: String,
    pub model_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct AppSettings {
    pub proxy_mode: String,
    pub proxy_url: Option<String>,
    pub ai_providers: Vec<AiProvider>,

    // Global Routing
    pub default_chat_model: Option<ModelRouting>,
    pub default_translate_model: Option<ModelRouting>,
    pub default_embedding_model: Option<ModelRouting>,

    pub active_ai_provider: Option<String>, // Legacy / Shortcut fallback
    pub theme_mode: String,

    pub translation_prompt: Option<String>,
    pub translation_target_lang: Option<String>,
    pub translation_timeout: Option<u64>,
    pub batch_translate_merge: Option<bool>,
    pub batch_translate_size: Option<usize>,
    pub server_port: Option<u16>,
}

pub struct ResolvedConfig {
    pub base_url: String,
    pub api_key: String,
    pub provider_name: String,
    pub headers: Option<HashMap<String, String>>,
    pub model: String,
}

// Extract proxy config reading
pub fn get_proxy_config(app: &AppHandle) -> (String, Option<String>) {
    let store = app.store("settings.json");
    if let Ok(store) = store {
        let mode = store
            .get("proxy_mode")
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| "system".to_string());

        let url = store
            .get("proxy_url")
            .and_then(|v| v.as_str().map(|s| s.to_string()));

        (mode, url)
    } else {
        ("system".to_string(), None)
    }
}

pub fn get_chat_config(app: &AppHandle) -> Result<ResolvedConfig, String> {
    resolve_model_config(app, "chat")
}

pub fn get_translate_config(
    app: &AppHandle,
) -> Result<
    (
        ResolvedConfig,
        Option<String>,
        String,
        Option<u64>,
        bool,
        usize,
    ),
    String,
> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;

    let translation_prompt = store
        .get("translation_prompt")
        .and_then(|v| v.as_str().map(|s| s.to_string()));
    let target_lang_code = store
        .get("translation_target_lang")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "zh".to_string());
    let translation_target_lang = match target_lang_code.as_str() {
        "zh" => "Simplified Chinese",
        "en" => "English",
        "ja" => "Japanese",
        "ko" => "Korean",
        "fr" => "French",
        "de" => "German",
        "es" => "Spanish",
        "ru" => "Russian",
        "it" => "Italian",
        _ => "Simplified Chinese",
    }
    .to_string();

    let translation_timeout = store.get("translation_timeout").and_then(|v| v.as_u64());
    let batch_translate_merge = store
        .get("batch_translate_merge")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let batch_translate_size = store
        .get("batch_translate_size")
        .and_then(|v| v.as_u64())
        .map(|v| v as usize)
        .unwrap_or(5);

    // Provide a localized fallback for translation if it fails to resolve specific route
    let resolved =
        resolve_model_config(app, "translate").or_else(|_| resolve_model_config(app, "chat"))?;

    Ok((
        resolved,
        translation_prompt,
        translation_target_lang,
        translation_timeout,
        batch_translate_merge,
        batch_translate_size,
    ))
}

pub fn get_embedding_config(app: &AppHandle) -> Result<(ResolvedConfig, u32), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;

    let resolved =
        resolve_model_config(app, "embedding").or_else(|_| resolve_model_config(app, "chat"))?;

    // Attempt to extract dimensions from routing config (optional)
    // Default to 1536 (OpenAI common baseline)
    let mut dims = 1536;

    if let Some(routing_val) = store.get("default_embedding_model") {
        if let Some(r_obj) = routing_val.as_object() {
            if let Some(d) = r_obj.get("dimensions").and_then(|v| v.as_u64()) {
                dims = d as u32;
            }
        }
    }

    // Check if the old active provider has an override for dimensions as backward compability
    if let Some(providers_val) = store.get("ai_providers") {
        if let Ok(providers) =
            serde_json::from_value::<Vec<serde_json::Value>>(providers_val.clone())
        {
            for p in providers {
                if let Some(name) = p.get("name").and_then(|v| v.as_str()) {
                    if name == resolved.provider_name {
                        if let Some(p_dims) = p.get("embedding_dimensions").and_then(|v| v.as_u64())
                        {
                            dims = p_dims as u32;
                        }
                    }
                }
            }
        }
    }

    Ok((resolved, dims))
}

fn resolve_model_config(app: &AppHandle, task_type: &str) -> Result<ResolvedConfig, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;

    let routing_key = match task_type {
        "chat" => "default_chat_model",
        "translate" => "default_translate_model",
        "embedding" => "default_embedding_model",
        _ => return Err(format!("Unknown task type: {}", task_type)),
    };

    let mut target_provider = String::new();
    let mut target_model = String::new();

    // 1. Check Global Routing
    if let Some(val) = store.get(routing_key) {
        if let Ok(routing) = serde_json::from_value::<ModelRouting>(val.clone()) {
            target_provider = routing.provider;
            target_model = routing.model_id;
        }
    }

    // 2. Fallback to active_ai_provider if routing is not set (backwards compatibility)
    if target_provider.is_empty() {
        if let Some(active_v) = store.get("active_ai_provider") {
            if let Some(active) = active_v.as_str() {
                target_provider = active.to_string();
            }
        }

        if target_provider.is_empty() {
            return Err(format!(
                "No routing configured for {} and no active provider fallback.",
                task_type
            ));
        }
    }

    // 3. Find Provider
    if let Some(providers_val) = store.get("ai_providers") {
        if let Ok(providers) = serde_json::from_value::<Vec<AiProvider>>(providers_val.clone()) {
            for p in providers {
                if p.name == target_provider {
                    // Try to resolve model if empty
                    if target_model.is_empty() {
                        let search_type = if task_type == "embedding" {
                            "embedding"
                        } else {
                            "chat"
                        };

                        // Find matching type
                        for m in &p.models {
                            if m.r#type == search_type {
                                target_model = m.id.clone();
                                break;
                            }
                        }

                        // Still empty? Take the first one available
                        if target_model.is_empty() {
                            if let Some(first) = p.models.first() {
                                target_model = first.id.clone();
                            } else {
                                target_model = "unknown-model".to_string(); // Fallback
                            }
                        }
                    }

                    return Ok(ResolvedConfig {
                        base_url: p.base_url,
                        api_key: p.api_key,
                        provider_name: p.name,
                        headers: p.additional_headers,
                        model: target_model,
                    });
                }
            }
        }
    }

    // 4. Try legacy format conversion for `models` if AiProvider parse failed
    if let Some(providers_val) = store.get("ai_providers") {
        if let Some(providers_arr) = providers_val.as_array() {
            for p_val in providers_arr {
                if let Some(name) = p_val.get("name").and_then(|v| v.as_str()) {
                    if name == target_provider {
                        let base_url = p_val
                            .get("base_url")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let api_key = p_val
                            .get("api_key")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();

                        let headers_val = p_val.get("additional_headers");
                        let mut headers = None;
                        if let Some(h_obj) = headers_val.and_then(|v| v.as_object()) {
                            let mut map = std::collections::HashMap::new();
                            for (k, v) in h_obj {
                                if let Some(v_str) = v.as_str() {
                                    map.insert(k.to_string(), v_str.to_string());
                                }
                            }
                            headers = Some(map);
                        }

                        if target_model.is_empty() {
                            if let Some(def) = p_val.get("default_model").and_then(|v| v.as_str()) {
                                target_model = def.to_string();
                            } else if let Some(models) =
                                p_val.get("models").and_then(|v| v.as_array())
                            {
                                if let Some(first) = models.first().and_then(|v| v.as_str()) {
                                    target_model = first.to_string();
                                }
                            }
                        }

                        if target_model.is_empty() {
                            target_model = "unknown-model".to_string();
                        }

                        return Ok(ResolvedConfig {
                            base_url,
                            api_key,
                            provider_name: name.to_string(),
                            headers,
                            model: target_model,
                        });
                    }
                }
            }
        }
    }

    Err(format!(
        "Provider '{}' not found in configuration.",
        target_provider
    ))
}

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod commands;
mod ai;
mod config;
mod db;
mod doi;
mod server;
mod network;
mod crawler;
mod window_icon;
mod storage;
mod ris;

use tauri::{AppHandle, Manager, State, path::BaseDirectory};
use tauri_plugin_store::StoreExt;
use rusqlite::Connection;

pub struct AppState {
    pub vec_extension_path: Option<String>,
}

// Helper to get proxy settings from the store
pub(crate) fn get_proxy_config(app: &AppHandle) -> (String, Option<String>) {
    let store = app.store("settings.json");
    if let Ok(store) = store {
        let mode = store.get("proxy_mode")
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| "system".to_string());
            
        let url = store.get("proxy_url")
            .and_then(|v| v.as_str().map(|s| s.to_string()));
            
        (mode, url)
    } else {
        ("system".to_string(), None)
    }
}

// Helper to get active AI provider config
// Returns: (base_url, api_key, provider_name, headers, default_model, embedding_model, embedding_dimensions, translation_prompt, translation_target_lang, translation_timeout, batch_translate_merge, batch_translate_size)
pub(crate) fn get_ai_config(app: &AppHandle) -> Result<(String, String, String, Option<std::collections::HashMap<String, String>>, String, String, Option<u32>, Option<String>, String, Option<u64>, bool, usize), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;

    // Get translation settings
    let translation_prompt = store.get("translation_prompt").and_then(|v| v.as_str().map(|s| s.to_string()));
    
    let target_lang_code = store.get("translation_target_lang").and_then(|v| v.as_str().map(|s| s.to_string())).unwrap_or_else(|| "zh".to_string());
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
    }.to_string();

    let translation_timeout = store.get("translation_timeout").and_then(|v| v.as_u64());
    let batch_translate_merge = store.get("batch_translate_merge").and_then(|v| v.as_bool()).unwrap_or(false);
    let batch_translate_size = store.get("batch_translate_size").and_then(|v| v.as_u64()).map(|v| v as usize).unwrap_or(5);

    // 1. Get active provider name
    let active_provider = store.get("active_ai_provider")
        .and_then(|v| v.as_str().map(|s| s.to_string()));

    if let Some(name) = active_provider {
        // 2. Find provider in list
        if let Some(providers_val) = store.get("ai_providers") {
            if let Some(providers) = providers_val.as_array() {
                for p in providers {
                    if let Some(p_name) = p.get("name").and_then(|v| v.as_str()) {
                        if p_name == name {
                            // Found match
                            let base_url = p.get("base_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            let api_key = p.get("api_key").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            
                            // Get default model or first in list
                            let mut model = "".to_string();
                            if let Some(m) = p.get("default_model").and_then(|v| v.as_str()) {
                                model = m.to_string();
                            } else if let Some(models) = p.get("models").and_then(|v| v.as_array()) {
                                if let Some(first) = models.first().and_then(|v| v.as_str()) {
                                    model = first.to_string();
                                }
                            }
                             
                             let headers_val = p.get("additional_headers");
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
                             
                             // Get embedding model
                             let embedding_model = p.get("embedding_model")
                                 .and_then(|v| v.as_str())
                                 .unwrap_or("text-embedding-3-small") // Default fallback
                                 .to_string();
                             
                             let embedding_dimensions = p.get("embedding_dimensions")
                                 .and_then(|v| v.as_u64())
                                 .map(|v| v as u32);

                            return Ok((base_url, api_key, name, headers, model, embedding_model, embedding_dimensions, translation_prompt, translation_target_lang, translation_timeout, batch_translate_merge, batch_translate_size)); // Return all
                        }
                    }
                }
            }
        }
    }
    
    println!("get_ai_config failed: No active AI provider configured or found");
    Err("No active AI provider configured".to_string())
}

// Global helper for history db
pub(crate) fn get_history_db_conn(app: &AppHandle, state: &State<'_, AppState>) -> Result<Connection, String> {
    let history_db_path = app.path().resolve("history.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let history_db_str = history_db_path.to_str().unwrap().to_string();
    let ext_res_path = state.vec_extension_path.clone();
    let ext_path_abs = resolve_vec_path(app, ext_res_path.as_deref());

    // Get dimensions from config
    let (_, _, _, _, _, _, embedding_dimensions, _, _, _, _, _) = get_ai_config(app).unwrap_or((
        "".into(), "".into(), "".into(), None, "".into(), "".into(), Some(1536), None, "".into(), None, false, 5
    ));
    let dims = embedding_dimensions.unwrap_or(1536);

    db::init_history_db(&history_db_str, ext_path_abs.as_deref(), dims).map_err(|e| e.to_string())
}

// Helper to resolve absolute path for extension
pub(crate) fn resolve_vec_path(app: &AppHandle, resource_path: Option<&str>) -> Option<String> {
    if let Some(path_str) = resource_path {
        // Try to resolve resource
        match app.path().resolve(path_str, BaseDirectory::Resource) {
            Ok(p) => return Some(p.to_string_lossy().into_owned()),
            Err(e) => {
                println!("Failed to resolve extension resource '{}': {}", path_str, e);
                 // Fallback to trying relative path existence (dev mode mainly)
                 if std::path::Path::new(path_str).exists() {
                     return Some(path_str.to_string());
                 }
            }
        }
    }
    None
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn main() {
    let context = tauri::generate_context!();
    
    // Determine vector extension resource path based on OS/Arch
    let vec_extension_resource_path = match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", _) => "extensions/windows/vec0.dll",
        ("macos", "aarch64") => "extensions/macos-applesilicon/vec0.dylib",
        ("macos", "x86_64") => "extensions/macos-intel/vec0.dylib",
        ("linux", "x86_64") => "extensions/linux-x86_64/vec0.so",
        ("linux", "aarch64") => "extensions/linux-aarch64/vec0.so",
        (os, arch) => {
             println!("Warning: No pre-configured vector extension for {}/{}", os, arch);
             "extensions/vec0" // Fallback
        }
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState { 
            vec_extension_path: Some(vec_extension_resource_path.to_string()) 
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::ThemeChanged(theme) = event {
                window_icon::update_window_icon(window, *theme);
            }
        })
        .setup(move |app| {
            let app_handle = app.handle().clone();
            
            // Resolve AppData path
            let app_data_dir = app_handle.path().app_data_dir().expect("Failed to get app data dir");
            if !app_data_dir.exists() {
                std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");
            }
            
            let db_path = app_data_dir.join("papers.db");
            let db_path_str = db_path.to_string_lossy().into_owned();

            // Initialize Paper DB
            db::init_db(&db_path_str).expect("Failed to init Paper DB");

            // Read port from settings
            let store = app.store("settings.json");
            let mut port = 8080;
            if let Ok(store) = store {
                if let Some(p) = store.get("server_port").and_then(|v| v.as_u64()) {
                    port = p as u16;
                }
            }
            println!("Starting server on port {} with DB at {}", port, db_path_str);

            tauri::async_runtime::spawn(async move {
                server::start_server(port, db_path_str, app_handle).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet, 
            commands::paper::get_batches, 
            commands::paper::get_papers, 
            commands::paper::update_metadata,
            commands::group::create_group,
            commands::group::get_groups,
            commands::group::rename_group,
            commands::group::delete_group,
            commands::group::add_paper_to_group,
            commands::group::remove_paper_from_group,
            commands::group::get_papers_by_group, 
            commands::ai::translate_paper,
            commands::ai::translate_batch,
            commands::ai::chat_command,
            commands::ai::generate_chat_title_command,
            commands::ai::fetch_models_command,

            commands::pdf::attach_pdf,
            commands::pdf::read_pdf,
            commands::pdf::delete_pdf_command,
            // History Commands
            commands::history::create_chat_session,
            commands::history::get_chat_sessions,
            commands::history::update_chat_session,
            commands::history::delete_chat_session,
            commands::history::get_chat_messages,
            commands::history::create_chat_message,
            commands::history::search_history,

            // New commands
            commands::paper::import_from_doi,
            commands::paper::import_ris,
            commands::paper::export_references,
        ])
        .run(context)
        .expect("error while running tauri application");
}

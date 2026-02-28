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

// Global helper for history db
pub(crate) fn get_history_db_conn(app: &AppHandle, state: &State<'_, AppState>) -> Result<Connection, String> {
    let history_db_path = app.path().resolve("history.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let history_db_str = history_db_path.to_str().unwrap().to_string();
    let ext_res_path = state.vec_extension_path.clone();
    let ext_path_abs = resolve_vec_path(app, ext_res_path.as_deref());

    // Get dimensions from config
    let dims = match crate::config::get_embedding_config(app) {
        Ok((_, d)) => d,
        Err(_) => 1536,
    };

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
            commands::ai::get_model_database,

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

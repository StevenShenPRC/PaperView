#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod config;
mod db;
mod doi;
mod server;

use tauri::{Manager, Emitter}; // Added Emitter for AppHandle::emit

struct AppState {
    db_path: String,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_batches(state: tauri::State<'_, AppState>) -> Result<Vec<db::Batch>, String> {
    let conn = db::init_db(&state.db_path).map_err(|e| e.to_string())?;
    db::get_batches(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_papers(state: tauri::State<'_, AppState>, journal: String, volume: String, date: String) -> Result<Vec<db::Paper>, String> {
    let conn = db::init_db(&state.db_path).map_err(|e| e.to_string())?;
    db::get_papers_by_batch(&conn, &journal, &volume, &date).map_err(|e| e.to_string())
}


#[tauri::command]
async fn update_metadata(app: tauri::AppHandle, state: tauri::State<'_, AppState>, id: i64, doi: String) -> Result<db::Paper, String> {
    // 1. Fetch metadata (using updated doi::fetch_doi_metadata with citation.doi.org)
    // Note: We are using citation.doi.org which returns JSON.
    let metadata = doi::fetch_doi_metadata(&doi).await.map_err(|e| e.to_string())?;
    
    // 2. Extract fields (Matches logic from browser script but in Rust)
    // Browser script uses: metadata.title || "Unknown Title"
    // We use unwrap_or to fallback to empty string if missing
    let title = metadata["title"].as_str()
        .map(|s| s.to_string())
        .or_else(|| metadata["title"].as_array().and_then(|arr| arr.first()?.as_str().map(|s| s.to_string())))
        .unwrap_or_else(|| "".to_string());

    let abstract_raw = metadata["abstract"].as_str().unwrap_or("").to_string();
    
    // Basic cleanup of XML tags commonly found in CrossRef/DOI abstracts
    // Browser script doesn't explicitly clean this, but keeping it is good for Tauri display.
    let abstract_text = abstract_raw
        .replace("<jats:p>", "")
        .replace("</jats:p>", "\n")
        .replace("<p>", "")
        .replace("</p>", "\n")
        .replace("<jats:title>", "")
        .replace("</jats:title>", "\n")
        .replace("<jats:italic>", "")
        .replace("</jats:italic>", "")
        .replace("<i>", "")
        .replace("</i>", "")
        .trim()
        .to_string();
    
    // 3. Update DB
    // First, fetch the existing paper to ensure we don't overwrite valid data with empty data
    // (e.g., if abstract was scraped by browser but is missing in DOI record)
    let db_path_read = state.db_path.clone();
    let existing_paper = tokio::task::spawn_blocking(move || {
        let conn = db::init_db(&db_path_read).map_err(|e| e.to_string())?;
        db::get_paper_by_id(&conn, id).map_err(|e| e.to_string())
    }).await.unwrap()?;

    let final_title = if !title.is_empty() { title } else { existing_paper.title };
    let final_abstract = if !abstract_text.is_empty() { abstract_text } else { existing_paper.abstract_text };
    
    // Spawn blocking task for DB update
    let db_path = state.db_path.clone();
    let d_title = final_title.clone();
    let d_abstract = final_abstract.clone();
    
    tokio::task::spawn_blocking(move || {
        let conn = db::init_db(&db_path).map_err(|e| e.to_string())?;
        // Use the newly determined values
        db::update_paper_metadata(&conn, id, &d_title, &d_abstract).map_err(|e| e.to_string())
    }).await.unwrap()?;
    
    // 4. Fetched full updated paper from DB to return to frontend
    // This ensures frontend receives exactly what is in DB, including untouched CN fields.
    let db_path_2 = state.db_path.clone();
    let updated_paper = tokio::task::spawn_blocking(move || {
        let conn = db::init_db(&db_path_2).map_err(|e| e.to_string())?;
        db::get_paper_by_id(&conn, id).map_err(|e| e.to_string())
    }).await.unwrap()?;

    // Emit event
    if let Err(e) = app.emit("paper-updated", &updated_paper) {
        println!("Failed to emit paper-updated event: {}", e);
    }

    Ok(updated_paper)
}

#[tauri::command]
async fn translate_paper(app: tauri::AppHandle, state: tauri::State<'_, AppState>, id: i64) -> Result<db::Paper, String> {
    // 1. Get paper data
    let db_path = state.db_path.clone();
    let paper = tokio::task::spawn_blocking(move || {
        let conn = db::init_db(&db_path).map_err(|e| e.to_string())?;
        db::get_paper_by_id(&conn, id).map_err(|e| e.to_string())
    }).await.unwrap()?;

    // 2. Call AI (Mocked for now as per previous plan)
    // Real implementation would use: ai::chat_with_ai(...)
    
    let title_cn = format!("翻译: {}", paper.title); 
    let abstract_cn = format!("翻译: {}", paper.abstract_text);
    
    // 3. Update DB
    let db_path_2 = state.db_path.clone();
    let t_title = title_cn.clone();
    let t_abstract = abstract_cn.clone();
    
    tokio::task::spawn_blocking(move || {
        let conn = db::init_db(&db_path_2).map_err(|e| e.to_string())?;
        db::update_paper_translation(&conn, id, &t_title, &t_abstract).map_err(|e| e.to_string())
    }).await.unwrap()?;

    // 4. Return updated
    let mut updated = paper;
    updated.title_cn = Some(title_cn);
    updated.abstract_cn = Some(abstract_cn);
    
    // Emit event
    if let Err(e) = app.emit("paper-updated", &updated) {
        println!("Failed to emit paper-updated event: {}", e);
    }
    
    Ok(updated)
}




fn main() {
    // Initialize DB
    let db_path = "papers.db"; // Revert to local DB for production/default behavior
    db::init_db(db_path).expect("Failed to init DB");

    // Start HTTP Server
    let port = 8080; // Load from config later
    let db_path_str = db_path.to_string();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState { db_path: db_path.to_string() })
        .setup(move |app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                server::start_server(port, db_path_str, app_handle).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, get_batches, get_papers, update_metadata, translate_paper])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod config;
mod db;
mod doi;
mod server;
mod network;
mod crawler;
mod window_icon;
mod storage;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, path::BaseDirectory};
use tauri_plugin_store::StoreExt;
use rusqlite::Connection;

struct AppState {
    vec_extension_path: Option<String>,
}

// Helper to get proxy settings from the store
fn get_proxy_config(app: &AppHandle) -> (String, Option<String>) {
    let store = app.store("settings.json");
    // We need to handle the Result from app.store and then the store operations
    // Since this is in an async command usually, or we want to be safe, we try to load.
    // However, loading might be async in some versions or backend specific. 
    // tauri-plugin-store in v2:
    // let store = app.store("path"); 
    // store.get("key")
    
    // Note: Error handling for store is a bit verbose, defaulting to system/none if fails
    if let Ok(store) = store {
         // Force load not strictly necessary if auto-load is on, but good practice if we want to be sure
        // let _ = store.reload(); 
        
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
fn get_ai_config(app: &AppHandle) -> Result<(String, String, String, Option<std::collections::HashMap<String, String>>, String, String, Option<u32>), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    // let _ = store.reload(); // user might have changed settings

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

                            return Ok((base_url, api_key, name, headers, model, embedding_model, embedding_dimensions)); // Return all
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
fn get_history_db_conn(app: &AppHandle, state: &State<'_, AppState>) -> Result<Connection, String> {
    let history_db_path = app.path().resolve("history.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let history_db_str = history_db_path.to_str().unwrap().to_string();
    let ext_res_path = state.vec_extension_path.clone();
    let ext_path_abs = resolve_vec_path(app, ext_res_path.as_deref());

    // Get dimensions from config
    let (_, _, _, _, _, _, embedding_dimensions) = get_ai_config(app).unwrap_or((
        "".into(), "".into(), "".into(), None, "".into(), "".into(), Some(1536)
    ));
    let dims = embedding_dimensions.unwrap_or(1536);

    db::init_history_db(&history_db_str, ext_path_abs.as_deref(), dims).map_err(|e| e.to_string())
}


#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_batches(app: AppHandle, _state: State<'_, AppState>) -> Result<Vec<db::Batch>, String> {
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let conn = db::init_db(db_path.to_str().unwrap()).map_err(|e| e.to_string())?;
    db::get_batches(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_papers(app: AppHandle, _state: State<'_, AppState>, journal: String, volume: String, date: String) -> Result<Vec<db::Paper>, String> {
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let conn = db::init_db(db_path.to_str().unwrap()).map_err(|e| e.to_string())?;
    db::get_papers_by_batch(&conn, &journal, &volume, &date).map_err(|e| e.to_string())
}


#[tauri::command]
async fn update_metadata(app: AppHandle, _state: State<'_, AppState>, id: i64, doi: String) -> Result<db::Paper, String> {
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    // Get Proxy Config
    let (proxy_mode, proxy_url) = get_proxy_config(&app);
    // ... rest of the function remains similar but uses db_path resolved above

    // 1. Fetch metadata (Try CrossRef/DOI.org first)
    println!("Fetching metadata for DOI: {}", doi);
    let metadata = doi::fetch_doi_metadata(&doi, &proxy_mode, proxy_url.as_deref()).await.ok();
    
    let mut title = String::new();
    let mut abstract_raw = String::new();
    
    // Check if CrossRef data is valid/complete
    let mut valid_crossref = false;
    if let Some(ref md) = metadata {
        // Extract title
        title = md["title"].as_str()
            .map(|s| s.to_string())
            .or_else(|| md["title"].as_array().and_then(|arr| arr.first()?.as_str().map(|s| s.to_string())))
            .unwrap_or_else(|| "".to_string());

        // Extract abstract
        abstract_raw = md["abstract"].as_str().unwrap_or("").to_string();
        
        if !title.is_empty() {
             // If abstract is empty or very short, we might consider it incomplete, 
             // but sometimes papers just don't have abstracts. 
             // However, user specifically asked to fallback if incomplete.
             // Let's assume if abstract is missing/empty, we try fallback.
             if !abstract_raw.is_empty() {
                 valid_crossref = true;
             }
        }
    }
    
    // Fallback to Semantic Scholar if needed
    if !valid_crossref {
        println!("CrossRef data incomplete or failed. Trying Semantic Scholar...");
        match doi::fetch_semantic_scholar_metadata(&doi, &proxy_mode, proxy_url.as_deref()).await {
            Ok(ss_md) => {
                println!("Semantic Scholar data received.");
                // Overwrite or fill in
                let ss_title = ss_md["title"].as_str().unwrap_or("").to_string();
                let ss_abstract = ss_md["abstract"].as_str().unwrap_or("").to_string();
                
                if !ss_title.is_empty() && (title.is_empty() || title == "Unknown Title") {
                    title = ss_title;
                }
                
                // If CrossRef abstract was empty, use Semantic Scholar's
                if abstract_raw.is_empty() && !ss_abstract.is_empty() {
                    abstract_raw = ss_abstract;
                } else if !ss_abstract.is_empty() && abstract_raw.len() < 50 && ss_abstract.len() > 50 {
                     // Heuristic: if CrossRef abstract is surprisingly short (maybe just "Abstract") and SS is longer
                     abstract_raw = ss_abstract;
                }
            },
            Err(e) => {
                println!("Semantic Scholar failed: {}", e);
            }
        }
        
        // 3. Crawler Fallback (Direct Publisher Crawl)
        // If we still don't have a good abstract, try crawling
        if abstract_raw.is_empty() {
            println!("Trying direct crawler fallback...");
            match crawler::fetch_metadata_by_crawling(&doi, &proxy_mode, proxy_url.as_deref()).await {
                Ok(crawl_md) => {
                    println!("Crawler success.");
                    let c_title = crawl_md["title"].as_str().unwrap_or("").to_string();
                    let c_abstract = crawl_md["abstract"].as_str().unwrap_or("").to_string();
                    
                    if !c_title.is_empty() && (title.is_empty() || title == "Unknown Title") {
                        title = c_title;
                    }
                    if !c_abstract.is_empty() {
                        abstract_raw = c_abstract;
                    }
                },
                Err(ce) => {
                     println!("Crawler failed: {}", ce);
                     // Propagate rate limit errors to frontend so UI can show warning
                     if ce.contains("Publisher policy limit") || ce.contains("risk control") {
                         return Err(ce);
                     }
                }
            }
        }
    }

    if title.is_empty() && abstract_raw.is_empty() {
         return Err(format!("Failed to fetch metadata from all sources for DOI {}", doi));
    }

    // Since we just added regex crate, let's use it.
    // Note: We need to import regex at top or use full path.
    // Let's use simple logic here to avoid import issues if not caught by analyzer yet, 
    // but better to add `use regex::Regex;` at top of file.
    // For now, I will use a robust replacement chain that covers common JATS tags found in Springer papers.
    
    let abstract_text = abstract_raw
        .replace("<jats:p>", "")
        .replace("</jats:p>", "\n")
        .replace("<jats:title>", "") // Often "Abstract" or section title
        .replace("</jats:title>", ". ")
        .replace("<jats:bold>", "")
        .replace("</jats:bold>", "")
        .replace("<jats:italic>", "")
        .replace("</jats:italic>", "")
        .replace("<jats:sub>", "_{")
        .replace("</jats:sub>", "}")
        .replace("<jats:sup>", "^{")
        .replace("</jats:sup>", "}")
        .replace("<p>", "")
        .replace("</p>", "\n")
        .replace("<i>", "")
        .replace("</i>", "")
        .replace("<b>", "")
        .replace("</b>", "")
        .trim()
        .to_string(); 
        
    // If we wanted to use Regex:
    // let re = regex::Regex::new(r"<[^>]*>").unwrap();
    // let abstract_text = re.replace_all(&abstract_raw, "").trim().to_string();
    
    // Using the manual chain above is safer without ensuring `use` is at top of file right now in this ReplaceChunk.
    // But I will do a separate ReplaceChunk to add the import if I decide to use Regex.
    // Actually, let's stick to the manual chain for now as it maps specific tags to formatting (like sub/sup) better than just stripping.
    // Stripping <jats:sub>1</jats:sub> to "1" loses meaning (CO2 vs CO2). "_{1}" is better LaTeX-ish style.

    // 3. Update DB
    let db_path_read = db_path.clone();
    let existing_paper = tokio::task::spawn_blocking(move || {
        let conn = db::init_db(db_path_read.to_str().unwrap()).map_err(|e| e.to_string())?;
        db::get_paper_by_id(&conn, id).map_err(|e| e.to_string())
    }).await.unwrap()?;

    let final_title = if !title.is_empty() { title } else { existing_paper.title };
    let final_abstract = if !abstract_text.is_empty() { abstract_text } else { existing_paper.abstract_text };
    
    let db_path_write = db_path.clone();
    let d_title = final_title.clone();
    let d_abstract = final_abstract.clone();
    
    tokio::task::spawn_blocking(move || {
        let conn = db::init_db(db_path_write.to_str().unwrap()).map_err(|e| e.to_string())?;
        db::update_paper_metadata(&conn, id, &d_title, &d_abstract).map_err(|e| e.to_string())
    }).await.unwrap()?;
    
    // 4. Return updated
    let db_path_final = db_path.clone();
    let updated_paper = tokio::task::spawn_blocking(move || {
        let conn = db::init_db(db_path_final.to_str().unwrap()).map_err(|e| e.to_string())?;
        db::get_paper_by_id(&conn, id).map_err(|e| e.to_string())
    }).await.unwrap()?;

    // Emit event
    if let Err(e) = app.emit("paper-updated", &updated_paper) {
        println!("Failed to emit paper-updated event: {}", e);
    }

    Ok(updated_paper)
}

#[tauri::command]
async fn translate_paper(app: AppHandle, _state: State<'_, AppState>, id: i64) -> Result<db::Paper, String> {
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    // 1. Get paper data
    let db_path_clone = db_path.clone();
    let paper = tokio::task::spawn_blocking(move || {
        let conn = db::init_db(db_path_clone.to_str().unwrap()).map_err(|e| e.to_string())?;
        db::get_paper_by_id(&conn, id).map_err(|e| e.to_string())
    }).await.unwrap()?;

    // 2. Get AI Config & Proxy
    let (proxy_mode, proxy_url) = get_proxy_config(&app);
    println!("translate_paper: Proxy config: mode={}, url={:?}", proxy_mode, proxy_url);
    
    let (base_url, api_key, provider_name, headers, default_model, _, _) = get_ai_config(&app)?;
    println!("translate_paper: AI Config: provider={}, base_url={}, model={}", provider_name, base_url, default_model);

    // Use default model if available, otherwise fallback
    let model = if !default_model.is_empty() { 
        default_model 
    } else { 
        "gpt-3.5-turbo".to_string() 
    };
    
    // Construct messages
    let prompt = format!(
        "Translate the following academic paper title and abstract into Simplified Chinese.\
        Return JSON format: {{ \"title_cn\": \"...\", \"abstract_cn\": \"...\" }}.\
        \
        Title: {}\
        \
        Abstract: {}", 
        paper.title, paper.abstract_text
    );
    
    let messages = vec![
        ai::ChatMessage { role: "system".to_string(), content: "You are a professional academic translator.".to_string() },
        ai::ChatMessage { role: "user".to_string(), content: prompt },
    ];
    
    // Call AI (Simple non-streaming)
    let response_str = ai::chat_simple(
        base_url, 
        api_key, 
        model, 
        messages, 
        proxy_mode, 
        proxy_url, 
        headers
    ).await?;
    
    // Parse JSON response
    // AI might return text with markup, try to clean or parse
    let parsed: serde_json::Value = serde_json::from_str(&response_str)
        .or_else(|_| {
            // If failed, try to extract JSON from markdown block
             let start = response_str.find("{");
             let end = response_str.rfind("}");
             if let (Some(s), Some(e)) = (start, end) {
                 serde_json::from_str(&response_str[s..=e])
             } else {
                 Err(serde_json::Error::io(std::io::Error::new(std::io::ErrorKind::InvalidData, "No JSON found")))
             }
        })
        .map_err(|_| format!("Failed to parse AI translation: {}", response_str))?;
        
    let title_cn = parsed["title_cn"].as_str().unwrap_or("").to_string();
    let abstract_cn = parsed["abstract_cn"].as_str().unwrap_or("").to_string();
    
    // 3. Update DB
    let db_path_2 = db_path.clone();
    let t_title = title_cn.clone();
    let t_abstract = abstract_cn.clone();
    
    tokio::task::spawn_blocking(move || {
        let conn = db::init_db(db_path_2.to_str().unwrap()).map_err(|e| e.to_string())?;
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

#[tauri::command]
async fn chat_command(
    app: AppHandle,
    messages: Vec<ai::ChatMessage>,
    model: String,
    provider_name: String
) -> Result<(), String> {
    println!("chat_command called using provider: {}, model: {}", provider_name, model);
    // Get Config
    let (proxy_mode, proxy_url) = get_proxy_config(&app);
    println!("chat_command: Proxy config: mode={}, url={:?}", proxy_mode, proxy_url);
    
    // Get Provider Config by name
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    // let _ = store.reload();
    
    let mut base_url = "".to_string();
    let mut api_key = "".to_string();
    let mut headers = None;
    
    if let Some(providers_val) = store.get("ai_providers") {
        if let Some(providers) = providers_val.as_array() {
            for p in providers {
                if let Some(p_name) = p.get("name").and_then(|v| v.as_str()) {
                    if p_name == provider_name {
                        base_url = p.get("base_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        api_key = p.get("api_key").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        
                         let headers_val = p.get("additional_headers");
                         if let Some(h_obj) = headers_val.and_then(|v| v.as_object()) {
                             let mut map = std::collections::HashMap::new();
                             for (k, v) in h_obj {
                                 if let Some(v_str) = v.as_str() {
                                     map.insert(k.to_string(), v_str.to_string());
                                 }
                             }
                             headers = Some(map);
                         }
                         break;
                    }
                }
            }
        }
    }
    
    if base_url.is_empty() {
        return Err("Provider not found or missing URL".to_string());
    }

    ai::stream_chat(app, base_url, api_key, model, messages, proxy_mode, proxy_url, headers).await
}

#[tauri::command]
async fn fetch_models_command(
    app: AppHandle,
    base_url: String,
    api_key: String,
    additional_headers: Option<std::collections::HashMap<String, String>>
) -> Result<Vec<String>, String> {
    let (proxy_mode, proxy_url) = get_proxy_config(&app);
    ai::fetch_models(base_url, api_key, proxy_mode, proxy_url, additional_headers).await
}

#[tauri::command]
async fn attach_pdf(
    app: AppHandle,
    _state: State<'_, AppState>,
    id: i64,
    source_path: String,
) -> Result<db::Paper, String> {
    // Get app data directory
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Copy PDF to managed storage (returns filename + display_name)
    let (filename, display_name) = storage::save_pdf(&source_path, id, &app_data_dir)?;

    // Insert into paper_pdfs table & update legacy local_path
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let db_path_clone = db_path.clone();
    let fname = filename.clone();
    let dname = display_name.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db::init_db(db_path_clone.to_str().unwrap()).map_err(|e| e.to_string())?;
        db::insert_paper_pdf(&conn, id, &fname, &dname).map_err(|e| e.to_string())?;
        // Also update legacy local_path to first pdf for backward compat
        db::update_paper_local_path(&conn, id, &fname).map_err(|e| e.to_string())
    }).await.unwrap()?;

    // Return updated paper
    let db_path_2 = db_path.clone();
    let updated_paper = tokio::task::spawn_blocking(move || {
        let conn = db::init_db(db_path_2.to_str().unwrap()).map_err(|e| e.to_string())?;
        db::get_paper_by_id(&conn, id).map_err(|e| e.to_string())
    }).await.unwrap()?;

    // Emit event so frontend updates
    if let Err(e) = app.emit("paper-updated", &updated_paper) {
        println!("Failed to emit paper-updated event: {}", e);
    }

    Ok(updated_paper)
}

#[tauri::command]
async fn read_pdf(
    app: AppHandle,
    _state: State<'_, AppState>,
    filename: String,
) -> Result<Vec<u8>, String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let abs_path = storage::get_pdf_absolute_path(&filename, &app_data_dir)?;

    std::fs::read(&abs_path)
        .map_err(|e| format!("Failed to read PDF file: {}", e))
}

#[tauri::command]
async fn delete_pdf_command(
    app: AppHandle,
    _state: State<'_, AppState>,
    pdf_id: i64,
    paper_id: i64,
    filename: String,
) -> Result<db::Paper, String> {
    // Delete file from disk
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    storage::delete_pdf(&filename, &app_data_dir)?;

    // Delete from database
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let db_path_clone = db_path.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db::init_db(db_path_clone.to_str().unwrap()).map_err(|e| e.to_string())?;
        db::delete_paper_pdf(&conn, pdf_id).map_err(|e| e.to_string())
    }).await.unwrap()?;

    // Return updated paper
    let db_path_2 = db_path.clone();
    let updated_paper = tokio::task::spawn_blocking(move || {
        let conn = db::init_db(db_path_2.to_str().unwrap()).map_err(|e| e.to_string())?;
        db::get_paper_by_id(&conn, paper_id).map_err(|e| e.to_string())
    }).await.unwrap()?;

    if let Err(e) = app.emit("paper-updated", &updated_paper) {
        println!("Failed to emit paper-updated event: {}", e);
    }

    Ok(updated_paper)
}

// --- Commands for History DB ---

#[tauri::command]
async fn create_chat_session(app: AppHandle, state: State<'_, AppState>, title: String, model: String) -> Result<String, String> {
    let conn = get_history_db_conn(&app, &state)?;
    db::create_chat_session(&conn, &title, &model).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_chat_sessions(app: AppHandle, state: State<'_, AppState>) -> Result<Vec<db::ChatSession>, String> {
    let conn = get_history_db_conn(&app, &state)?;
    db::get_chat_sessions(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_chat_session(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    model: Option<String>
) -> Result<(), String> {
    let conn = get_history_db_conn(&app, &state)?;
    db::update_chat_session(&conn, &id, title.as_deref(), model.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_chat_session(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = get_history_db_conn(&app, &state)?;
    db::delete_chat_session(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_chat_messages(app: AppHandle, state: State<'_, AppState>, session_id: String) -> Result<Vec<db::ChatMessage>, String> {
    let conn = get_history_db_conn(&app, &state)?;
    db::get_chat_messages(&conn, &session_id).map_err(|e| e.to_string())
}

// Helper to resolve absolute path for extension
fn resolve_vec_path(app: &AppHandle, resource_path: Option<&str>) -> Option<String> {
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
async fn create_chat_message(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    role: String,
    content: serde_json::Value,
) -> Result<i64, String> {
    let conn = get_history_db_conn(&app, &state)?;
    
    // We clone necessary data for the async spawn later
    let history_db_path = app.path().resolve("history.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let history_db_str = history_db_path.to_str().unwrap().to_string();
    
    let ext_res_path = state.vec_extension_path.clone();
    let ext_path_abs = resolve_vec_path(&app, ext_res_path.as_deref());

    // 1. Insert Message (Sync)
    let msg_id = db::create_chat_message(&conn, &session_id, &role, &content).map_err(|e| e.to_string())?;
    
    // 2. If user message, generate embedding in background
    if role == "user" {
        // Extract text
        let text_content = if let Some(s) = content.as_str() {
             s.to_string()
        } else if let Some(obj) = content.as_object() {
             obj.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string()
        } else {
            "".to_string()
        };
        
        if !text_content.is_empty() {
            // We need AI config to generate embedding
            // Re-use get_ai_config helper
            if let Ok((base_url, api_key, _, headers, _, embedding_model, embedding_dimensions)) = get_ai_config(&app) {
                 let (proxy_mode, proxy_url) = get_proxy_config(&app);
                 
                 let history_db_2 = history_db_str.clone();
                 // Pass resolved path
                 let ext_path_2 = ext_path_abs.clone(); 
                 
                 let app_clone = app.clone(); // Clone app for use in the spawned task
                 tauri::async_runtime::spawn(async move {
                     match ai::get_embeddings(base_url, api_key, embedding_model.to_string(), text_content, proxy_mode, proxy_url, headers, embedding_dimensions).await {
                         Ok(embedding) => {
                               let _ = tokio::task::spawn_blocking(move || {
                                // Re-fetch dimensions for background init too
                                let (_, _, _, _, _, _, embedding_dimensions) = get_ai_config(&app_clone).unwrap_or((
                                    "".into(), "".into(), "".into(), None, "".into(), "".into(), Some(1536)
                                ));
                                let dims = embedding_dimensions.unwrap_or(1536);

                                if let Ok(conn) = db::init_history_db(&history_db_2, ext_path_2.as_deref(), dims) {
                                    let _ = db::insert_message_embedding(&conn, msg_id, &embedding);
                                }
                              });
                         },
                         Err(e) => println!("Failed to generate embedding: {}", e),
                     }
                 });
            }
        }
    }

    Ok(msg_id)
}

#[derive(Serialize)]
struct HistorySearchResults {
    rag: Vec<db::SearchResult>,
    fts: Vec<db::SearchResult>,
}

#[tauri::command]
async fn search_history(
    app: AppHandle,
    state: State<'_, AppState>,
    query: String
) -> Result<HistorySearchResults, String> {
    // 1. Get Embedding for query (for RAG)
    let (base_url, api_key, _, headers, _, embedding_model, embedding_dimensions) = get_ai_config(&app).map_err(|_| "AI Config not found")?;
    let (proxy_mode, proxy_url) = get_proxy_config(&app);
    
    let embedding = ai::get_embeddings(
        base_url, 
        api_key, 
        embedding_model, 
        query.clone(), 
        proxy_mode, 
        proxy_url, 
        headers, 
        embedding_dimensions
    )
        .await
        .map_err(|e| format!("Embedding failed: {}", e))?;
        
    // 2. Search DB (RAG + FTS)
    let conn = get_history_db_conn(&app, &state)?;
    
    // Vector search
    let mut rag_results = db::search_similar_messages(&conn, &embedding, 10, 0.8).map_err(|e| e.to_string())?;

    // Apply Relative Difference Filtering to RAG results
    if !rag_results.is_empty() {
        let min_distance = rag_results[0].distance;
        let relative_threshold = 0.15;
        rag_results.retain(|r| (r.distance - min_distance) < relative_threshold);
    }

    // FTS search
    let fts_results = db::search_fts_messages(&conn, &query, 10).map_err(|e| e.to_string())?;

    Ok(HistorySearchResults {
        rag: rag_results,
        fts: fts_results,
    })
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
            get_batches, 
            get_papers, 
            update_metadata, 
            translate_paper,
            chat_command,
            fetch_models_command,
            attach_pdf,
            read_pdf,
            delete_pdf_command,
            // History Commands
            create_chat_session,
            get_chat_sessions,
            update_chat_session,
            delete_chat_session,
            get_chat_messages,
            create_chat_message,
            search_history
        ])
        .run(context)
        .expect("error while running tauri application");
}


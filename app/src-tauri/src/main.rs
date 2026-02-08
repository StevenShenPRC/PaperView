#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod config;
mod db;
mod doi;
mod server;
mod network;
mod crawler;

use tauri::{AppHandle, Emitter, State}; // Manager removed
use tauri_plugin_store::StoreExt;

struct AppState {
    db_path: String,
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
fn get_ai_config(app: &AppHandle) -> Result<(String, String, String, Option<std::collections::HashMap<String, String>>, String), String> {
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

                            return Ok((base_url, api_key, name, headers, model)); // Return model
                        }
                    }
                }
            }
        }
    }
    
    println!("get_ai_config failed: No active AI provider configured or found");
    Err("No active AI provider configured".to_string())
}


#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_batches(state: State<'_, AppState>) -> Result<Vec<db::Batch>, String> {
    let conn = db::init_db(&state.db_path).map_err(|e| e.to_string())?;
    db::get_batches(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_papers(state: State<'_, AppState>, journal: String, volume: String, date: String) -> Result<Vec<db::Paper>, String> {
    let conn = db::init_db(&state.db_path).map_err(|e| e.to_string())?;
    db::get_papers_by_batch(&conn, &journal, &volume, &date).map_err(|e| e.to_string())
}


#[tauri::command]
async fn update_metadata(app: AppHandle, state: State<'_, AppState>, id: i64, doi: String) -> Result<db::Paper, String> {
    // Get Proxy Config
    let (proxy_mode, proxy_url) = get_proxy_config(&app);

    // 1. Fetch metadata (Try CrossRef/DOI.org first)
    println!("Fetching metadata for DOI: {}", doi);
    let mut metadata = doi::fetch_doi_metadata(&doi, &proxy_mode, proxy_url.as_deref()).await.ok();
    
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
    let db_path_read = state.db_path.clone();
    let existing_paper = tokio::task::spawn_blocking(move || {
        let conn = db::init_db(&db_path_read).map_err(|e| e.to_string())?;
        db::get_paper_by_id(&conn, id).map_err(|e| e.to_string())
    }).await.unwrap()?;

    let final_title = if !title.is_empty() { title } else { existing_paper.title };
    let final_abstract = if !abstract_text.is_empty() { abstract_text } else { existing_paper.abstract_text };
    
    let db_path = state.db_path.clone();
    let d_title = final_title.clone();
    let d_abstract = final_abstract.clone();
    
    tokio::task::spawn_blocking(move || {
        let conn = db::init_db(&db_path).map_err(|e| e.to_string())?;
        db::update_paper_metadata(&conn, id, &d_title, &d_abstract).map_err(|e| e.to_string())
    }).await.unwrap()?;
    
    // 4. Return updated
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
async fn translate_paper(app: AppHandle, state: State<'_, AppState>, id: i64) -> Result<db::Paper, String> {
    // 1. Get paper data
    let db_path = state.db_path.clone();
    let paper = tokio::task::spawn_blocking(move || {
        let conn = db::init_db(&db_path).map_err(|e| e.to_string())?;
        db::get_paper_by_id(&conn, id).map_err(|e| e.to_string())
    }).await.unwrap()?;

    // 2. Get AI Config & Proxy
    let (proxy_mode, proxy_url) = get_proxy_config(&app);
    println!("translate_paper: Proxy config: mode={}, url={:?}", proxy_mode, proxy_url);
    
    let (base_url, api_key, provider_name, headers, default_model) = get_ai_config(&app)?;
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

fn main() {
    // Initialize DB
    let db_path = "papers.db"; 
    db::init_db(db_path).expect("Failed to init DB");

    // Start HTTP Server
    let port = 8080; 
    let db_path_str = db_path.to_string();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AppState { db_path: db_path.to_string() })
        .setup(move |app| {
            let app_handle = app.handle().clone();
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
            fetch_models_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


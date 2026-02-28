use serde::Serialize;
use tauri::{AppHandle, State, path::BaseDirectory, Manager};
use crate::{db, ai, AppState, get_history_db_conn, resolve_vec_path};
use crate::config::{get_embedding_config, get_proxy_config};

#[derive(Serialize)]
pub struct HistorySearchResults {
    pub rag: Vec<db::SearchResult>,
    pub fts: Vec<db::SearchResult>,
}

#[tauri::command]
pub async fn create_chat_session(app: AppHandle, state: State<'_, AppState>, title: String, model: String) -> Result<String, String> {
    let conn = get_history_db_conn(&app, &state)?;
    db::create_chat_session(&conn, &title, &model).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_chat_sessions(app: AppHandle, state: State<'_, AppState>) -> Result<Vec<db::ChatSession>, String> {
    let conn = get_history_db_conn(&app, &state)?;
    db::get_chat_sessions(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_chat_session(
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
pub async fn delete_chat_session(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = get_history_db_conn(&app, &state)?;
    db::delete_chat_session(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_chat_messages(app: AppHandle, state: State<'_, AppState>, session_id: String) -> Result<Vec<db::ChatMessage>, String> {
    let conn = get_history_db_conn(&app, &state)?;
    db::get_chat_messages(&conn, &session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_chat_message(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    role: String,
    content: serde_json::Value,
) -> Result<i64, String> {
    let conn = get_history_db_conn(&app, &state)?;
    
    // We clone necessary data for the async spawn later
    let history_db_path = app.path().resolve("history.db", BaseDirectory::AppData).map_err(|e: tauri::Error| e.to_string())?;
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
            if let Ok((resolved, dims)) = get_embedding_config(&app) {
                 let (proxy_mode, proxy_url) = get_proxy_config(&app);
                 let base_url = resolved.base_url;
                 let api_key = resolved.api_key;
                 let embedding_model = resolved.model;
                 let headers = resolved.headers;
                 let embedding_dimensions = Some(dims);
                 
                 let history_db_2 = history_db_str.clone();
                 // Pass resolved path
                 let ext_path_2 = ext_path_abs.clone(); 
                 
                 let app_clone = app.clone(); // Clone app for use in the spawned task
                 tauri::async_runtime::spawn(async move {
                     match ai::get_embeddings(base_url, api_key, embedding_model, text_content, proxy_mode, proxy_url, headers, embedding_dimensions, None).await {
                         Ok(embedding) => {
                                let _ = tokio::task::spawn_blocking(move || {
                                // Re-fetch dimensions for background init too
                                let dims = crate::config::get_embedding_config(&app_clone).map(|(_, d)| d).unwrap_or(1536);

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

#[tauri::command]
pub async fn search_history(
    app: AppHandle,
    state: State<'_, AppState>,
    query: String
) -> Result<HistorySearchResults, String> {
    // 1. Get Embedding for query (for RAG)
    let (resolved, dims) = get_embedding_config(&app).map_err(|_| "AI Config not found")?;
    let (proxy_mode, proxy_url) = get_proxy_config(&app);
    
    let embedding = ai::get_embeddings(
        resolved.base_url, 
        resolved.api_key, 
        resolved.model, 
        query.clone(), 
        proxy_mode, 
        proxy_url, 
        resolved.headers, 
        Some(dims),
        None
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

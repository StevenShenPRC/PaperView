use axum::{
    extract::{State, Json},
    routing::{get, post},
    Router, response::IntoResponse, http::StatusCode,
};
use crate::db;
use std::net::SocketAddr;

use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;

use tauri::{AppHandle, Emitter};

#[derive(Clone)]
pub struct AppState {
    pub db_path: String,
    pub app_handle: AppHandle,
}

pub async fn start_server(port: u16, db_path: String, app_handle: AppHandle) {
    let state = AppState { db_path, app_handle };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/sync", post(sync_data))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    println!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

#[derive(Deserialize, Serialize, Debug, Clone)]
struct SyncPayload {
    website: String,
    #[serde(rename = "journalName")]
    journal_name: String,
    #[serde(rename = "issueVolume")]
    issue_volume: String,
    #[serde(rename = "issueDate")]
    issue_date: String,
    articles: Vec<Article>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
struct Article {
    title: String,
    doi: String,
    #[serde(rename = "abstract")]
    abstract_content: String,
    #[serde(default)] // Allow missing field
    title_cn: Option<String>,
    #[serde(default)] // Allow missing field
    abstract_cn: Option<String>,
}

async fn sync_data(
    State(state): State<AppState>,
    Json(payload): Json<SyncPayload>,
) -> impl IntoResponse {
    println!("Received sync data: {} articles from {}", payload.articles.len(), payload.journal_name);
    
    let db_path = state.db_path.clone();
    
    // Process in a blocking task to avoid blocking async runtime with DB ops
    let payload_for_db = payload.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db::init_db(&db_path).map_err(|e| e.to_string())?;
        
        for article in payload_for_db.articles {
            db::insert_paper(
                &conn,
                &payload_for_db.website,
                &payload_for_db.journal_name,
                &payload_for_db.issue_volume,
                &payload_for_db.issue_date,
                &article.title,
                &article.doi,
                &article.abstract_content,
                article.title_cn.as_deref(),
                article.abstract_cn.as_deref(),
            ).map_err(|e| e.to_string())?;
        }
        Ok::<_, String>(())
    }).await.unwrap();

    match result {
        Ok(_) => {
            // Emit event to frontend
            if let Err(e) = state.app_handle.emit("data-updated", &payload) {
                println!("Failed to emit update event: {}", e);
            }
            (StatusCode::OK, "Data stored successfully").into_response()
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }
}


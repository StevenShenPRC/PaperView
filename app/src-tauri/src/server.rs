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
        .route("/paperview.user.js", get(serve_script))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

async fn serve_script() -> impl IntoResponse {
    const SCRIPT: &str = include_str!("../assets/paperview.user.js");
    (
        [(axum::http::header::CONTENT_TYPE, "text/javascript; charset=utf-8")],
        SCRIPT
    )
}

#[derive(Deserialize, Serialize, Debug, Clone)]
struct SyncPayload {
    website: String,
    #[serde(rename = "journalName")]
    journal_name: Option<String>,
    #[serde(rename = "issueVolume")]
    issue_volume: Option<String>,
    #[serde(rename = "issueDate")]
    issue_date: Option<String>,
    ris_content: Option<String>,
    articles: Vec<Article>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
struct Article {
    title: String,
    doi: String,
    #[serde(rename = "abstract")]
    abstract_content: String,
    #[serde(default)]
    title_cn: Option<String>,
    #[serde(default)]
    abstract_cn: Option<String>,
}

async fn sync_data(
    State(state): State<AppState>,
    Json(payload): Json<SyncPayload>,
) -> impl IntoResponse {
    let is_manual = payload.website == "Manual Import";
    let journal = if is_manual { "手动导入".to_string() } else { payload.journal_name.as_deref().unwrap_or("").to_string() };
    let volume = if is_manual { "".to_string() } else { payload.issue_volume.as_deref().unwrap_or("").to_string() };
    let date = if is_manual { chrono::Local::now().format("%Y-%m-%d").to_string() } else { payload.issue_date.as_deref().unwrap_or("").to_string() };

    println!("Received sync data: {} articles from {}", payload.articles.len(), journal);
    
    let db_path = state.db_path.clone();
    
    let payload_for_db = payload.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db::init_db(&db_path).map_err(|e| e.to_string())?;
        
        if let Some(ris) = payload_for_db.ris_content {
            // Priority: RIS content
            db::insert_paper(
                &conn,
                &payload_for_db.website,
                &journal,
                &volume,
                &date,
                "", // Title if not in RIS
                "", // DOI if not in RIS
                "", // Abstract if not in RIS
                None,
                None,
                Some(&ris),
            ).map_err(|e| e.to_string())?;
        } else {
            // Fallback to individual articles
            for article in payload_for_db.articles {
                db::insert_paper(
                    &conn,
                    &payload_for_db.website,
                    &journal,
                    &volume,
                    &date,
                    &article.title,
                    &article.doi,
                    &article.abstract_content,
                    article.title_cn.as_deref(),
                    article.abstract_cn.as_deref(),
                    None,
                ).map_err(|e| e.to_string())?;
            }
        }
        Ok::<_, String>(())
    }).await.unwrap();

    match result {
        Ok(_) => {
            if let Err(e) = state.app_handle.emit("data-updated", &payload) {
                println!("Failed to emit update event: {}", e);
            }
            (StatusCode::OK, "Data stored successfully").into_response()
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }
}


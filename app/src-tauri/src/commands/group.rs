use tauri::{AppHandle, State, path::BaseDirectory, Manager};
use crate::{db, AppState};

#[tauri::command]
pub async fn create_group(app: AppHandle, _state: State<'_, AppState>, name: String) -> Result<i64, String> {
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let conn = db::init_db(db_path.to_str().unwrap()).map_err(|e| e.to_string())?;
    db::create_group(&conn, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_groups(app: AppHandle, _state: State<'_, AppState>) -> Result<Vec<db::Group>, String> {
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let conn = db::init_db(db_path.to_str().unwrap()).map_err(|e| e.to_string())?;
    db::get_groups(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rename_group(app: AppHandle, _state: State<'_, AppState>, id: i64, new_name: String) -> Result<(), String> {
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let conn = db::init_db(db_path.to_str().unwrap()).map_err(|e| e.to_string())?;
    db::rename_group(&conn, id, &new_name).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_group(app: AppHandle, _state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let conn = db::init_db(db_path.to_str().unwrap()).map_err(|e| e.to_string())?;
    db::delete_group(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_paper_to_group(app: AppHandle, _state: State<'_, AppState>, paper_id: i64, group_id: i64) -> Result<(), String> {
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let conn = db::init_db(db_path.to_str().unwrap()).map_err(|e| e.to_string())?;
    db::add_paper_to_group(&conn, paper_id, group_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_paper_from_group(app: AppHandle, _state: State<'_, AppState>, paper_id: i64, group_id: i64) -> Result<(), String> {
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let conn = db::init_db(db_path.to_str().unwrap()).map_err(|e| e.to_string())?;
    db::remove_paper_from_group(&conn, paper_id, group_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_papers_by_group(app: AppHandle, _state: State<'_, AppState>, group_id: i64) -> Result<Vec<db::Paper>, String> {
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let conn = db::init_db(db_path.to_str().unwrap()).map_err(|e| e.to_string())?;
    db::get_papers_by_group(&conn, group_id).map_err(|e| e.to_string())
}

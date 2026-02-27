use tauri::{AppHandle, State, path::BaseDirectory, Manager, Emitter};
use crate::{db, storage, AppState};

#[tauri::command]
pub async fn attach_pdf(
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
pub async fn read_pdf(
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
pub async fn delete_pdf_command(
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

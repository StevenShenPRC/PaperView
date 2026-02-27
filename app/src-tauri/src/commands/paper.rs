use tauri::{AppHandle, State, path::BaseDirectory, Manager, Emitter};
use crate::{db, doi, crawler, ris, AppState, get_proxy_config};

#[tauri::command]
pub async fn get_batches(app: AppHandle, _state: State<'_, AppState>) -> Result<Vec<db::Batch>, String> {
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let conn = db::init_db(db_path.to_str().unwrap()).map_err(|e| e.to_string())?;
    db::get_batches(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_papers(app: AppHandle, _state: State<'_, AppState>, journal: String, volume: String, date: String) -> Result<Vec<db::Paper>, String> {
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let conn = db::init_db(db_path.to_str().unwrap()).map_err(|e| e.to_string())?;
    db::get_papers_by_batch(&conn, &journal, &volume, &date).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_metadata(app: AppHandle, _state: State<'_, AppState>, id: i64, doi: String) -> Result<db::Paper, String> {
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let (proxy_mode, proxy_url) = get_proxy_config(&app);

    println!("Fetching metadata for DOI: {}", doi);
    
    let ris_content = doi::fetch_doi_ris(&doi, &proxy_mode, proxy_url.as_deref()).await.ok();
    let mut title = String::new();
    let mut abstract_raw = String::new();

    if let Some(ref ris) = ris_content {
        let papers = ris::parse_ris(ris);
        if let Some(p) = papers.first() {
            title = p.title.clone();
            abstract_raw = p.abstract_text.clone();
        }
    }

    if title.is_empty() || abstract_raw.len() < 100 {
        match doi::fetch_openalex_metadata(&doi, &proxy_mode, proxy_url.as_deref()).await {
            Ok(oa_md) => {
                let oa_title = oa_md["display_name"].as_str().unwrap_or("").to_string();
                let oa_abstract = oa_md["abstract"].as_str().unwrap_or("").to_string();
                if !oa_title.is_empty() && (title.is_empty() || title == "Unknown Title") { title = oa_title; }
                if abstract_raw.len() < 100 && !oa_abstract.is_empty() { abstract_raw = oa_abstract; }
            },
            Err(e) => println!("OpenAlex failed: {}", e),
        }
    }

    if abstract_raw.len() < 50 {
        if let Ok(crawl_md) = crawler::fetch_metadata_by_crawling(&doi, &proxy_mode, proxy_url.as_deref()).await {
             let c_abstract = crawl_md["abstract"].as_str().unwrap_or("").to_string();
             if !c_abstract.is_empty() { abstract_raw = c_abstract; }
        }
    }

    let abstract_text = clean_abstract(&abstract_raw);
    let db_path_clone = db_path.clone();
    let d_title = title.clone();
    let d_abstract = abstract_text.clone();
    let d_ris = ris_content.clone();
    
    let updated_paper = tokio::task::spawn_blocking(move || {
        let conn = db::init_db(db_path_clone.to_str().unwrap()).map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE papers SET title = ?, abstract = ?, ris_content = ? WHERE id = ?",
            rusqlite::params![d_title, d_abstract, d_ris, id],
        ).map_err(|e| e.to_string())?;
        db::get_paper_by_id(&conn, id).map_err(|e| e.to_string())
    }).await.unwrap()?;

    app.emit("paper-updated", &updated_paper).ok();
    Ok(updated_paper)
}

fn clean_abstract(raw: &str) -> String {
    raw.replace("<jats:p>", "")
        .replace("</jats:p>", "\n")
        .replace("<jats:title>", "")
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
        .to_string()
}

fn clean_doi(doi: &str) -> String {
    let re = regex::Regex::new(r"(?i)^(https?://doi\.org/|doi:|DOI:)").unwrap();
    re.replace(doi.trim(), "").to_string()
}

#[tauri::command]
pub async fn import_from_doi(app: AppHandle, dois: Vec<String>, group_id: Option<i64>) -> Result<Vec<db::Paper>, String> {
    let mut results = Vec::new();
    let mut errors = Vec::new();
    
    // Create one UTC timestamp to share across this batch
    let batch_time_utc = chrono::Utc::now().to_rfc3339();

    for doi_raw in dois {
        let doi = clean_doi(&doi_raw);
        if doi.is_empty() { continue; }

        match import_single_doi(&app, doi, group_id, batch_time_utc.clone()).await {
            Ok(paper) => results.push(paper),
            Err(e) => errors.push(format!("DOI {}: {}", doi_raw, e)),
        }
    }

    if results.is_empty() && !errors.is_empty() {
        return Err(errors.join("; "));
    }
    
    // Emit update once
    app.emit("data-updated", &{}).ok();
    Ok(results)
}

// Helper function extracted from original import_from_doi
async fn import_single_doi(app: &AppHandle, doi: String, group_id: Option<i64>, batch_time_utc: String) -> Result<db::Paper, String> {
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let (proxy_mode, proxy_url) = get_proxy_config(app);
    
    // 1. Fetch RIS
    let ris_content = doi::fetch_doi_ris(&doi, &proxy_mode, proxy_url.as_deref()).await.ok();
    
    let mut title = "Unknown Title".to_string();
    let mut abstract_text = "".to_string();
    let mut journal = "Unknown Journal".to_string();

    if let Some(ref ris) = ris_content {
        let papers = ris::parse_ris(ris);
        if let Some(p) = papers.first() {
            title = p.title.clone();
            abstract_text = p.abstract_text.clone();
            if !p.journal_name.is_empty() {
                journal = p.journal_name.clone();
            }
        }
    }

    // 2. OpenAlex Enrichment
    // Always try OpenAlex if abstract is short OR journal is unknown
    if abstract_text.len() < 100 || journal == "Unknown Journal" {
        if let Ok(oa_md) = doi::fetch_openalex_metadata(&doi, &proxy_mode, proxy_url.as_deref()).await {
            if title == "Unknown Title" || title.is_empty() { 
                title = oa_md["display_name"].as_str().unwrap_or("Unknown Title").to_string(); 
            }
            // Prefer OpenAlex abstract if current is short
            if abstract_text.len() < 100 { 
                abstract_text = oa_md["abstract"].as_str().unwrap_or(&abstract_text).to_string(); 
            }
            // Prefer OpenAlex journal if current is unknown
            if journal == "Unknown Journal" || journal.is_empty() {
                if let Some(j) = oa_md["journal_name"].as_str() {
                    journal = j.to_string();
                }
            }
        }
    }

    // 3. Save to DB
    let db_path_clone = db_path.clone();
    let d_ris = ris_content.clone(); 
    
    let res = tokio::task::spawn_blocking(move || {
        let conn = db::init_db(db_path_clone.to_str().unwrap()).map_err(|e| e.to_string())?;
        db::insert_paper(
            &conn, "DOI Import", &journal, "PaperView_Manually_Imported", &batch_time_utc, &title, &doi, &abstract_text, None, None, d_ris.as_deref()
        ).map_err(|e| e.to_string())?;
        
        let id = conn.last_insert_rowid();
        if let Some(gid) = group_id {
            db::add_paper_to_group(&conn, id, gid).map_err(|e| e.to_string())?;
        }
        db::get_paper_by_id(&conn, id).map_err(|e| e.to_string())
    }).await.unwrap()?;

    Ok(res)
}

#[tauri::command]
pub async fn import_ris(app: AppHandle, ris_content: String, group_id: Option<i64>) -> Result<Vec<db::Paper>, String> {
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    
    let papers = ris::parse_ris(&ris_content);
    if papers.is_empty() {
        return Err("No valid RIS content found".to_string());
    }
    
    let mut results = Vec::new();
    let batch_time_utc = chrono::Utc::now().to_rfc3339();
    let (proxy_mode, proxy_url) = get_proxy_config(&app);
    let proxy_url_deref = proxy_url.clone();

    for p in papers {
        let mut title = p.title.clone();
        let doi = clean_doi(&p.doi);
        let mut abstract_text = p.abstract_text.clone();
        let mut journal = if p.journal_name.is_empty() { "Unknown Journal".to_string() } else { p.journal_name.clone() };

        // Enrichment
        if !doi.is_empty() && (abstract_text.len() < 100 || journal == "Unknown Journal") {
             if let Ok(oa_md) = doi::fetch_openalex_metadata(&doi, &proxy_mode, proxy_url_deref.as_deref()).await {
                 if title.is_empty() || title == "Unknown Title" {
                     if let Some(t) = oa_md["display_name"].as_str() { title = t.to_string(); }
                 }
                 if abstract_text.len() < 100 {
                     if let Some(a) = oa_md["abstract"].as_str() { abstract_text = a.to_string(); }
                 }
                 if journal == "Unknown Journal" {
                     if let Some(j) = oa_md["journal_name"].as_str() { journal = j.to_string(); }
                 }
             }
        }
        
        // Use specific RIS content for this paper
        let d_ris_content = p.ris_content.clone().unwrap_or_default();
        
        let db_path_inner = db_path.clone();
        let batch_time_utc_inner = batch_time_utc.clone();
        let title_clone = title.clone();
        let doi_clone = doi.clone();
        let abstract_clone = abstract_text.clone();
        let journal_clone = journal.clone();
        let ris_content_clone = d_ris_content.clone();

        let res = tokio::task::spawn_blocking(move || {
            let conn = db::init_db(db_path_inner.to_str().unwrap()).map_err(|e| e.to_string())?;
            db::insert_paper(
                &conn, "RIS Import", &journal_clone, "PaperView_Manually_Imported", &batch_time_utc_inner, &title_clone, &doi_clone, &abstract_clone, None, None, Some(&ris_content_clone)
            ).map_err(|e| e.to_string())?;
            
            let id = conn.last_insert_rowid();
            if let Some(gid) = group_id {
                db::add_paper_to_group(&conn, id, gid).map_err(|e| e.to_string())?;
            }
            db::get_paper_by_id(&conn, id).map_err(|e| e.to_string())
        }).await.unwrap();

        match res {
            Ok(paper) => results.push(paper),
            Err(e) => println!("Error inserting RIS paper: {}", e), 
        }
    }

    app.emit("data-updated", &{}).ok();
    Ok::<Vec<db::Paper>, String>(results)
}

#[tauri::command]
pub async fn export_references(paper_ids: Vec<i64>, format: String, app: AppHandle) -> Result<String, String> {
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    let conn = db::init_db(db_path.to_str().unwrap()).map_err(|e| e.to_string())?;
    
    let mut output = String::new();
    for id in paper_ids {
        if let Ok(paper) = db::get_paper_by_id(&conn, id) {
            match format.as_str() {
                "ris" => {
                    output.push_str(&ris::to_ris(&paper));
                    output.push('\n');
                },
                "bibtex" => {
                    output.push_str(&ris::to_bibtex(&paper));
                    output.push('\n');
                },
                _ => return Err("Unsupported format".to_string()),
            }
        }
    }
    Ok(output)
}

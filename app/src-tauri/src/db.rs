use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, LoadExtensionGuard, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
use uuid::Uuid;

// --- Models ---

#[derive(Serialize, Debug, Clone)]
pub struct Paper {
    pub id: i64,
    pub website: String,
    #[serde(rename = "journalName")]
    pub journal_name: String,
    #[serde(rename = "issueVolume")]
    pub issue_volume: String,
    #[serde(rename = "issueDate")]
    pub issue_date: String,
    pub title: String,
    pub doi: String,
    #[serde(rename = "abstract")]
    pub abstract_text: String,
    pub title_cn: Option<String>,
    pub abstract_cn: Option<String>,
    pub local_path: Option<String>,
    pub ris_content: Option<String>, // Added for original RIS storage
    pub pdfs: Vec<PaperPdf>,
    #[serde(default)]
    pub groups: Vec<i64>,
}

#[derive(Serialize, Debug, Clone)]
pub struct PaperPdf {
    pub id: i64,
    pub paper_id: i64,
    pub filename: String,
    pub display_name: String,
    pub added_time: String,
}

#[derive(Serialize, Debug)]
pub struct Batch {
    pub id: i64, // Virtual ID for frontend
    pub website: String,
    #[serde(rename = "journalName")]
    pub journal_name: String,
    #[serde(rename = "issueVolume")]
    pub issue_volume: String,
    #[serde(rename = "issueDate")]
    pub issue_date: String,
    pub latest_time: String,
}

#[derive(Serialize, Debug, Clone)]
pub struct Group {
    pub id: i64,
    pub name: String,
    pub created_at: String,
}

// History DB Models

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatSession {
    pub id: String,
    pub title: String,
    pub model: String,
    // JSONB blob stored as Vec<u8> in DB, but we handle as serde_json::Value or struct here
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatMessage {
    pub id: Option<i64>,
    pub session_id: String,
    pub role: String,
    // Content is complex in JSONB, but for struct we can use Value.
    // It might contain { "text": "...", "attachments": [...] }
    pub content: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatFile {
    pub id: Option<i64>,
    pub message_id: i64,
    pub file_name: String,
    pub file_path: String,
    pub file_type: String,
    pub file_size: i64,
    pub created_at: DateTime<Utc>,
}

// --- Initialization ---

pub fn init_db<P: AsRef<Path>>(path: P) -> Result<Connection> {
    let conn = Connection::open(path)?;

    // Enable WAL mode for better concurrency
    // conn.pragma_update(None, "journal_mode", "WAL")?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS papers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            received_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            website TEXT,
            journalName TEXT,
            issueVolume TEXT,
            issueDate TEXT,
            title TEXT,
            doi TEXT,
            abstract TEXT,
            title_cn TEXT,
            abstract_cn TEXT,
            local_path TEXT
        )",
        [],
    )?;

    // Migration: add local_path column if it doesn't exist (for existing DBs)
    let columns: Vec<String> = conn
        .prepare("PRAGMA table_info(papers)")
        .and_then(|mut stmt| {
            stmt.query_map([], |row| row.get::<_, String>(1))
                .map(|rows| rows.filter_map(|r| r.ok()).collect())
        })?;
    if !columns.iter().any(|c| c == "local_path") {
        conn.execute("ALTER TABLE papers ADD COLUMN local_path TEXT", [])?;
        println!("[DB Migration] Added local_path column to papers table.");
    }
    if !columns.iter().any(|c| c == "ris_content") {
        conn.execute("ALTER TABLE papers ADD COLUMN ris_content TEXT", [])?;
        println!("[DB Migration] Added ris_content column to papers table.");
    }

    // Multi-PDF support table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS paper_pdfs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paper_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            display_name TEXT NOT NULL,
            added_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Groups system
    conn.execute(
        "CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS paper_group_map (
            paper_id INTEGER NOT NULL,
            group_id INTEGER NOT NULL,
            PRIMARY KEY (paper_id, group_id),
            FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
        )",
        [],
    )?;

    Ok(conn)
}

pub fn init_history_db<P: AsRef<Path>>(
    path: P,
    extension_path: Option<&str>,
    embedding_dimensions: u32,
) -> Result<Connection> {
    let conn = Connection::open(path)?;

    // Enable WAL mode
    // conn.pragma_update(None, "journal_mode", "WAL")?;

    // Try loading sqlite-vec extension if provided and exists
    if let Some(ext) = extension_path {
        if Path::new(ext).exists() {
            unsafe {
                let _guard = LoadExtensionGuard::new(&conn)?;
                match conn.load_extension(ext, None) {
                    Ok(_) => println!("[HistoryDB] Loaded sqlite-vec extension from {}", ext),
                    Err(e) => println!("[HistoryDB] Failed to load sqlite-vec: {}", e),
                }
            }
        }
    }

    // Chat Sessions
    conn.execute(
        "CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            model TEXT NOT NULL,
            metadata BLOB, 
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // Chat Messages
    conn.execute(
        "CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content BLOB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Chat Files
    conn.execute(
        "CREATE TABLE IF NOT EXISTS chat_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Vector Search Table
    let vec_module_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_module_list WHERE name = 'vec0'",
            [],
            |row| row.get::<_, i64>(0).map(|c| c > 0),
        )
        .unwrap_or(false);

    if vec_module_exists {
        // Check if table exists and its current dimension
        let existing_sql: Option<String> = conn
            .query_row(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='vec_messages'",
                [],
                |row| row.get(0),
            )
            .ok();

        let mut create_new = true;
        if let Some(sql) = existing_sql {
            // Check if sql contains the required dimension
            let dim_pattern = format!("float[{}]", embedding_dimensions);
            if sql.contains(&dim_pattern) {
                create_new = false;
            } else {
                println!(
                    "[HistoryDB] Dimension mismatch (expected {}). Dropping vec_messages.",
                    embedding_dimensions
                );
                conn.execute("DROP TABLE vec_messages", [])?;
            }
        }

        if create_new {
            let create_sql = format!(
                "CREATE VIRTUAL TABLE vec_messages USING vec0(
                    embedding float[{}]
                )",
                embedding_dimensions
            );
            conn.execute(&create_sql, [])?;
            println!(
                "[HistoryDB] vec_messages table initialized with {} dims.",
                embedding_dimensions
            );
        }
    } else {
        println!("[HistoryDB] sqlite-vec module not found, skipping vector table creation.");
    }

    // --- FTS5 Search Table ---
    // Extract text from JSON content for full-text search
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS chat_messages_fts USING fts5(
            content,
            tokenize='unicode61'
        )",
        [],
    )?;

    // Triggers to sync chat_messages -> chat_messages_fts
    // Note: content in chat_messages is JSONB, we want to index the plain text if possible,
    // but for simplicity and robustness we can index the whole JSON string or a flattened version.
    // sqlite-vec uses rowid, FTS5 can also use rowid (default behavior).
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS msg_fts_insert AFTER INSERT ON chat_messages BEGIN
            INSERT INTO chat_messages_fts(rowid, content) VALUES (new.id, json_extract(new.content, '$.text'));
        END;",
        [],
    )?;

    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS msg_fts_delete AFTER DELETE ON chat_messages BEGIN
            INSERT INTO chat_messages_fts(chat_messages_fts, rowid, content) VALUES('delete', old.id, json_extract(old.content, '$.text'));
        END;",
        [],
    )?;

    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS msg_fts_update AFTER UPDATE ON chat_messages BEGIN
            INSERT INTO chat_messages_fts(chat_messages_fts, rowid, content) VALUES('delete', old.id, json_extract(old.content, '$.text'));
            INSERT INTO chat_messages_fts(rowid, content) VALUES (new.id, json_extract(new.content, '$.text'));
        END;",
        [],
    )?;

    // Handle existing data (re-populate FTS if empty)
    let fts_count: i64 =
        conn.query_row("SELECT count(*) FROM chat_messages_fts", [], |r| r.get(0))?;
    if fts_count == 0 {
        conn.execute(
            "INSERT INTO chat_messages_fts(rowid, content)
             SELECT id, json_extract(content, '$.text') FROM chat_messages",
            [],
        )?;
    }

    Ok(conn)
}

// --- Paper Functions ---

pub fn insert_paper(
    conn: &Connection,
    website: &str,
    journal: &str,
    volume: &str,
    date: &str,
    title: &str,
    doi: &str,
    abstract_text: &str,
    title_cn: Option<&str>,
    abstract_cn: Option<&str>,
    ris_content: Option<&str>,
) -> Result<()> {
    conn.execute(
        "INSERT INTO papers (website, journalName, issueVolume, issueDate, title, doi, abstract, title_cn, abstract_cn, ris_content) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![website, journal, volume, date, title, doi, abstract_text, title_cn, abstract_cn, ris_content],
    )?;
    Ok(())
}

pub fn get_batches(conn: &Connection) -> Result<Vec<Batch>> {
    let mut stmt = conn.prepare(
        "SELECT website, journalName, issueVolume, issueDate, MAX(received_time) as latest_time
         FROM papers 
         GROUP BY journalName, issueVolume, issueDate 
         ORDER BY latest_time DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(Batch {
            id: 0, // Will be assigned by index in iterator or frontend
            website: row.get(0)?,
            journal_name: row.get(1)?,
            issue_volume: row.get(2)?,
            issue_date: row.get(3)?,
            latest_time: row.get(4)?,
        })
    })?;

    let mut batches = Vec::new();
    for (i, row) in rows.enumerate() {
        let mut batch = row?;
        batch.id = (i + 1) as i64;
        batches.push(batch);
    }

    Ok(batches)
}

pub fn get_papers_by_batch(
    conn: &Connection,
    journal: &str,
    volume: &str,
    date: &str,
) -> Result<Vec<Paper>> {
    let mut stmt = conn.prepare(
        "SELECT id, website, journalName, issueVolume, issueDate, title, doi, abstract, title_cn, abstract_cn, local_path, ris_content
         FROM papers 
         WHERE 
            (?2 = 'PaperView_Manually_Imported' AND issueVolume = 'PaperView_Manually_Imported')
            OR
            (?1 = '手动导入' AND journalName = '手动导入')
            OR
            (journalName = ?1 AND issueVolume = ?2 AND issueDate = ?3)
         ORDER BY id ASC"
    )?;

    let rows = stmt.query_map(params![journal, volume, date], |row| {
        Ok(Paper {
            id: row.get(0)?,
            website: row.get(1)?,
            journal_name: row.get(2)?,
            issue_volume: row.get(3)?,
            issue_date: row.get(4)?,
            title: row.get(5)?,
            doi: row.get(6)?,
            abstract_text: row.get(7)?,
            title_cn: row.get(8).ok(),
            abstract_cn: row.get(9).ok(),
            local_path: row.get(10).ok(),
            ris_content: row.get(11).ok(),
            pdfs: vec![],
            groups: vec![],
        })
    })?;

    let mut papers = Vec::new();
    for row in rows {
        let mut paper = row?;
        paper.pdfs = get_pdfs_for_paper(conn, paper.id).unwrap_or_default();
        paper.groups = get_groups_for_paper(conn, paper.id).unwrap_or_default();
        papers.push(paper);
    }

    Ok(papers)
}

pub fn update_paper_metadata(
    conn: &Connection,
    id: i64,
    title: &str,
    abstract_text: &str,
) -> Result<()> {
    conn.execute(
        "UPDATE papers SET title = ?, abstract = ? WHERE id = ?",
        params![title, abstract_text, id],
    )?;
    Ok(())
}

pub fn get_paper_by_id(conn: &Connection, id: i64) -> Result<Paper> {
    let mut stmt = conn.prepare(
        "SELECT id, website, journalName, issueVolume, issueDate, title, doi, abstract, title_cn, abstract_cn, local_path, ris_content
         FROM papers WHERE id = ?"
    )?;

    stmt.query_row(params![id], |row| {
        Ok(Paper {
            id: row.get(0)?,
            website: row.get(1)?,
            journal_name: row.get(2)?,
            issue_volume: row.get(3)?,
            issue_date: row.get(4)?,
            title: row.get(5)?,
            doi: row.get(6)?,
            abstract_text: row.get(7)?,
            title_cn: row.get(8).ok(),
            abstract_cn: row.get(9).ok(),
            local_path: row.get(10).ok(),
            ris_content: row.get(11).ok(),
            pdfs: vec![],
            groups: vec![],
        })
    })
    .map(|mut paper| {
        paper.pdfs = get_pdfs_for_paper(conn, paper.id).unwrap_or_default();
        paper.groups = get_groups_for_paper(conn, paper.id).unwrap_or_default();
        paper
    })
}

pub fn update_paper_local_path(conn: &Connection, id: i64, local_path: &str) -> Result<()> {
    conn.execute(
        "UPDATE papers SET local_path = ? WHERE id = ?",
        params![local_path, id],
    )?;
    Ok(())
}

// --- Multi-PDF functions ---

pub fn insert_paper_pdf(
    conn: &Connection,
    paper_id: i64,
    filename: &str,
    display_name: &str,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO paper_pdfs (paper_id, filename, display_name) VALUES (?, ?, ?)",
        params![paper_id, filename, display_name],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_pdfs_for_paper(conn: &Connection, paper_id: i64) -> Result<Vec<PaperPdf>> {
    let mut stmt = conn.prepare(
        "SELECT id, paper_id, filename, display_name, added_time FROM paper_pdfs WHERE paper_id = ? ORDER BY added_time ASC"
    )?;
    let rows = stmt.query_map(params![paper_id], |row| {
        Ok(PaperPdf {
            id: row.get(0)?,
            paper_id: row.get(1)?,
            filename: row.get(2)?,
            display_name: row.get(3)?,
            added_time: row.get(4)?,
        })
    })?;
    let mut pdfs = Vec::new();
    for row in rows {
        pdfs.push(row?);
    }
    Ok(pdfs)
}

pub fn delete_paper_pdf(conn: &Connection, pdf_id: i64) -> Result<()> {
    conn.execute("DELETE FROM paper_pdfs WHERE id = ?", params![pdf_id])?;
    Ok(())
}

pub fn update_paper_translation(
    conn: &Connection,
    id: i64,
    title_cn: &str,
    abstract_cn: &str,
) -> Result<()> {
    conn.execute(
        "UPDATE papers SET title_cn = ?, abstract_cn = ? WHERE id = ?",
        params![title_cn, abstract_cn, id],
    )?;
    Ok(())
}

// --- Group Functions ---

pub fn create_group(conn: &Connection, name: &str) -> Result<i64> {
    conn.execute("INSERT INTO groups (name) VALUES (?)", params![name])?;
    Ok(conn.last_insert_rowid())
}

pub fn get_groups(conn: &Connection) -> Result<Vec<Group>> {
    let mut stmt =
        conn.prepare("SELECT id, name, created_at FROM groups ORDER BY created_at DESC")?;
    let rows = stmt.query_map([], |row| {
        Ok(Group {
            id: row.get(0)?,
            name: row.get(1)?,
            created_at: row.get(2)?,
        })
    })?;

    let mut groups = Vec::new();
    for row in rows {
        groups.push(row?);
    }
    Ok(groups)
}

pub fn rename_group(conn: &Connection, id: i64, new_name: &str) -> Result<()> {
    conn.execute(
        "UPDATE groups SET name = ? WHERE id = ?",
        params![new_name, id],
    )?;
    Ok(())
}

pub fn delete_group(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM groups WHERE id = ?", params![id])?;
    Ok(())
}

pub fn add_paper_to_group(conn: &Connection, paper_id: i64, group_id: i64) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO paper_group_map (paper_id, group_id) VALUES (?, ?)",
        params![paper_id, group_id],
    )?;
    Ok(())
}

pub fn remove_paper_from_group(conn: &Connection, paper_id: i64, group_id: i64) -> Result<()> {
    conn.execute(
        "DELETE FROM paper_group_map WHERE paper_id = ? AND group_id = ?",
        params![paper_id, group_id],
    )?;
    Ok(())
}

pub fn get_papers_by_group(conn: &Connection, group_id: i64) -> Result<Vec<Paper>> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.website, p.journalName, p.issueVolume, p.issueDate, p.title, p.doi, p.abstract, p.title_cn, p.abstract_cn, p.local_path, p.ris_content
         FROM papers p
         JOIN paper_group_map m ON p.id = m.paper_id
         WHERE m.group_id = ?
         ORDER BY p.id ASC"
    )?;

    let rows = stmt.query_map(params![group_id], |row| {
        Ok(Paper {
            id: row.get(0)?,
            website: row.get(1)?,
            journal_name: row.get(2)?,
            issue_volume: row.get(3)?,
            issue_date: row.get(4)?,
            title: row.get(5)?,
            doi: row.get(6)?,
            abstract_text: row.get(7)?,
            title_cn: row.get(8).ok(),
            abstract_cn: row.get(9).ok(),
            local_path: row.get(10).ok(),
            ris_content: row.get(11).ok(),
            pdfs: vec![],
            groups: vec![],
        })
    })?;

    let mut papers = Vec::new();
    for row in rows {
        let mut paper = row?;
        paper.pdfs = get_pdfs_for_paper(conn, paper.id).unwrap_or_default();
        paper.groups = get_groups_for_paper(conn, paper.id).unwrap_or_default();
        papers.push(paper);
    }

    Ok(papers)
}

pub fn get_groups_for_paper(conn: &Connection, paper_id: i64) -> Result<Vec<i64>> {
    let mut stmt = conn.prepare("SELECT group_id FROM paper_group_map WHERE paper_id = ?")?;
    let rows = stmt.query_map(params![paper_id], |row| row.get(0))?;
    let mut groups = Vec::new();
    for row in rows {
        groups.push(row?);
    }
    Ok(groups)
}

// --- History DB Operations ---

pub fn create_chat_session(conn: &Connection, title: &str, model: &str) -> Result<String> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO chat_sessions (id, title, model, metadata) VALUES (?, ?, ?, jsonb('{}'))",
        params![id, title, model],
    )?;
    Ok(id)
}

pub fn get_chat_sessions(conn: &Connection) -> Result<Vec<ChatSession>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, model, json(metadata), created_at FROM chat_sessions ORDER BY created_at DESC",
    )?;

    let sessions_iter = stmt.query_map([], |row| {
        let metadata_str: Option<String> = row.get(3)?;
        let metadata = if let Some(s) = metadata_str {
            serde_json::from_str(&s).ok()
        } else {
            None
        };

        // timestamps in SQLite are often strings or numbers.
        // We used TIMESTAMP DEFAULT CURRENT_TIMESTAMP which is usually string "YYYY-MM-DD HH:MM:SS"
        // Chrono's serde deserializer handles various formats if we use sqlx, but rusqlite?
        // We might need to handle parsing if generic deserialize fails.
        // But let's rely on string -> DateTime<Utc> via serde if format matches.
        // Actually, rusqlite with "chrono" feature supports DateTime<Utc> directly.
        // BUT I added "chrono" feature to Cargo.toml? Yes.
        // Does rusqlite automatically map? Only if we used proper `get`.
        // row.get(4) -> DateTime<Utc> might require `features = ["bundled", "chrono"]` in rusqlite.
        // I only added "bundled".
        // FIX: I need to add "chrono" feature to rusqlite in Cargo.toml.

        Ok(ChatSession {
            id: row.get(0)?,
            title: row.get(1)?,
            model: row.get(2)?,
            metadata,
            created_at: row.get(4)?,
        })
    })?;

    let mut sessions = Vec::new();
    for session in sessions_iter {
        sessions.push(session?);
    }
    Ok(sessions)
}

pub fn update_chat_session(
    conn: &Connection,
    id: &str,
    title: Option<&str>,
    model: Option<&str>,
) -> Result<()> {
    if let Some(t) = title {
        conn.execute(
            "UPDATE chat_sessions SET title = ? WHERE id = ?",
            params![t, id],
        )?;
    }
    if let Some(m) = model {
        conn.execute(
            "UPDATE chat_sessions SET model = ? WHERE id = ?",
            params![m, id],
        )?;
    }
    Ok(())
}

pub fn delete_chat_session(conn: &Connection, session_id: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM chat_sessions WHERE id = ?",
        params![session_id],
    )?;
    Ok(())
}

pub fn create_chat_message(
    conn: &Connection,
    session_id: &str,
    role: &str,
    content_json: &serde_json::Value,
) -> Result<i64> {
    let content_str = content_json.to_string();
    conn.execute(
        "INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, jsonb(?))",
        params![session_id, role, content_str],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_chat_messages(conn: &Connection, session_id: &str) -> Result<Vec<ChatMessage>> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, role, json(content), created_at 
         FROM chat_messages 
         WHERE session_id = ? 
         ORDER BY created_at ASC",
    )?;

    let messages_iter = stmt.query_map(params![session_id], |row| {
        let content_str: String = row.get(3)?;
        let content = serde_json::from_str(&content_str).unwrap_or(serde_json::Value::Null);

        Ok(ChatMessage {
            id: Some(row.get(0)?),
            session_id: row.get(1)?,
            role: row.get(2)?,
            content,
            created_at: row.get(4)?,
        })
    })?;

    let mut messages = Vec::new();
    for msg in messages_iter {
        messages.push(msg?);
    }
    Ok(messages)
}

// --- File Operations ---

pub fn insert_chat_file(
    conn: &Connection,
    message_id: i64,
    file_name: &str,
    file_path: &str,
    file_type: &str,
    file_size: i64,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO chat_files (message_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)",
        params![message_id, file_name, file_path, file_type, file_size],
    )?;
    Ok(conn.last_insert_rowid())
}

// --- Vector Operations ---

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct SearchResult {
    pub message_id: i64,
    pub session_id: String,
    pub role: String,
    pub distance: f32,
    pub content: serde_json::Value,
    pub created_at: String, // ISO String
}

pub fn insert_message_embedding(conn: &Connection, rowid: i64, embedding: &[f32]) -> Result<()> {
    // Check if table exists (handled in init, maybe check again?)
    // Basic insert (upsert)
    // Need unsafe cast to byte slice for BLOB
    let blob_slice: &[u8] = unsafe {
        std::slice::from_raw_parts(
            embedding.as_ptr() as *const u8,
            embedding.len() * std::mem::size_of::<f32>(),
        )
    };

    // Check if vec0 module exists before trying?
    // If not exists, this might fail unless we wrap or check.
    // For now assume caller checks or we let it fail (and catch in main command).
    conn.execute(
        "INSERT INTO vec_messages(rowid, embedding) VALUES (?, ?)",
        params![rowid, blob_slice],
    )?;
    Ok(())
}

pub fn search_similar_messages(
    conn: &Connection,
    embedding: &[f32],
    limit: i64,
    distance_threshold: f32,
) -> Result<Vec<SearchResult>> {
    let _blob = unsafe {
        std::slice::from_raw_parts(
            embedding.as_ptr() as *const u8,
            embedding.len() * std::mem::size_of::<f32>(),
        )
    };

    // Join with chat_messages to get content and metadata
    let mut stmt = conn.prepare(
        "SELECT v.rowid, v.distance, json(m.content), m.session_id, m.role, m.created_at
         FROM vec_messages v
         JOIN chat_messages m ON m.id = v.rowid
         WHERE v.embedding MATCH ?
         AND k = ?
         AND v.distance < ?
         ORDER BY v.distance ASC",
    )?;

    // Cast limit to i32 if needed, or just pass as is (rusqlite handles it)
    // Note: older sqlite-vec might use different syntax, but let's stick to simple
    let blob_query = unsafe {
        std::slice::from_raw_parts(
            embedding.as_ptr() as *const u8,
            embedding.len() * std::mem::size_of::<f32>(),
        )
    };

    let rows = stmt.query_map(params![blob_query, limit, distance_threshold], |row| {
        let content_str: String = row.get(2)?;
        let content = serde_json::from_str(&content_str).unwrap_or(serde_json::Value::Null);

        Ok(SearchResult {
            message_id: row.get(0)?,
            distance: row.get(1)?,
            content,
            session_id: row.get(3)?,
            role: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

pub fn search_fts_messages(
    conn: &Connection,
    query: &str,
    limit: i64,
) -> Result<Vec<SearchResult>> {
    let mut stmt = conn.prepare(
        "SELECT f.rowid, 0.0 as distance, json(m.content), m.session_id, m.role, m.created_at
         FROM chat_messages_fts f
         JOIN chat_messages m ON m.id = f.rowid
         WHERE f.content MATCH ?
         ORDER BY f.rank ASC
         LIMIT ?",
    )?;

    let rows = stmt.query_map(params![query, limit], |row| {
        let content_str: String = row.get(2)?;
        let content = serde_json::from_str(&content_str).unwrap_or(serde_json::Value::Null);

        Ok(SearchResult {
            message_id: row.get(0)?,
            distance: row.get(1)?,
            content,
            session_id: row.get(3)?,
            role: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

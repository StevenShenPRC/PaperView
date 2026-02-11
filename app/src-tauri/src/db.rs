use rusqlite::{params, Connection, Result};
use serde::Serialize;
use std::path::Path;

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
    pub pdfs: Vec<PaperPdf>,
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

pub fn init_db<P: AsRef<Path>>(path: P) -> Result<Connection> {
    let conn = Connection::open(path)?;
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

    Ok(conn)
}

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
) -> Result<()> {
    conn.execute(
        "INSERT INTO papers (website, journalName, issueVolume, issueDate, title, doi, abstract, title_cn, abstract_cn) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![website, journal, volume, date, title, doi, abstract_text, title_cn, abstract_cn],
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
        "SELECT id, website, journalName, issueVolume, issueDate, title, doi, abstract, title_cn, abstract_cn, local_path
         FROM papers 
         WHERE journalName = ? AND issueVolume = ? AND issueDate = ?
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
            pdfs: vec![],
        })
    })?;

    let mut papers = Vec::new();
    for row in rows {
        let mut paper = row?;
        paper.pdfs = get_pdfs_for_paper(conn, paper.id).unwrap_or_default();
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
        "SELECT id, website, journalName, issueVolume, issueDate, title, doi, abstract, title_cn, abstract_cn, local_path
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
            pdfs: vec![],
        })
    })
    .map(|mut paper| {
        paper.pdfs = get_pdfs_for_paper(conn, paper.id).unwrap_or_default();
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

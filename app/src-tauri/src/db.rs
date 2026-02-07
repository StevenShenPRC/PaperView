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
    // Provide a default or rename if needed. "abstract" is a keyword in some contexts but fine as field name in Rust if not keyword.
    // However, the DB column is 'abstract'.
    #[serde(rename = "abstract")]
    pub abstract_text: String,
    pub title_cn: Option<String>,
    pub abstract_cn: Option<String>,
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
            abstract_cn TEXT
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
        "SELECT id, website, journalName, issueVolume, issueDate, title, doi, abstract, title_cn, abstract_cn
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
        })
    })?;

    let mut papers = Vec::new();
    for row in rows {
        papers.push(row?);
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
        "SELECT id, website, journalName, issueVolume, issueDate, title, doi, abstract, title_cn, abstract_cn
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
        })
    })
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

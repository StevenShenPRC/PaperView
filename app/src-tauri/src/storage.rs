use std::fs;
use std::path::{Path, PathBuf};

/// Get the PDF storage directory under the app's data directory.
/// Creates the directory if it doesn't exist.
pub fn get_pdf_dir(app_data_dir: &Path) -> Result<PathBuf, String> {
    let pdf_dir = app_data_dir.join("pdfs");
    if !pdf_dir.exists() {
        fs::create_dir_all(&pdf_dir)
            .map_err(|e| format!("Failed to create PDF directory: {}", e))?;
    }
    Ok(pdf_dir)
}

/// Copy a PDF file from the source path to the managed storage directory.
/// Returns the filename (relative path) used for storage.
/// Uses paper_id + timestamp to support multiple PDFs per paper.
pub fn save_pdf(
    source_path: &str,
    paper_id: i64,
    app_data_dir: &Path,
) -> Result<(String, String), String> {
    let source = Path::new(source_path);
    if !source.exists() {
        return Err(format!("Source file does not exist: {}", source_path));
    }

    // Validate file extension
    let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("");
    if ext.to_lowercase() != "pdf" {
        return Err("Only PDF files are supported.".to_string());
    }

    // Extract original filename for display
    let display_name = source
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("document.pdf")
        .to_string();

    let pdf_dir = get_pdf_dir(app_data_dir)?;

    // Use paper_id + timestamp for uniqueness (supports multiple PDFs)
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let filename = format!("{}_{}.pdf", paper_id, timestamp);
    let dest = pdf_dir.join(&filename);

    fs::copy(source, &dest).map_err(|e| format!("Failed to copy PDF: {}", e))?;

    println!("[Storage] Saved PDF for paper {} -> {:?}", paper_id, dest);
    Ok((filename, display_name))
}

/// Get the absolute path for a stored PDF file.
pub fn get_pdf_absolute_path(filename: &str, app_data_dir: &Path) -> Result<PathBuf, String> {
    let pdf_dir = get_pdf_dir(app_data_dir)?;
    let path = pdf_dir.join(filename);
    if !path.exists() {
        return Err(format!("PDF file not found: {:?}", path));
    }
    Ok(path)
}

/// Delete a stored PDF file.
pub fn delete_pdf(filename: &str, app_data_dir: &Path) -> Result<(), String> {
    let pdf_dir = get_pdf_dir(app_data_dir)?;
    let path = pdf_dir.join(filename);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete PDF: {}", e))?;
    }
    Ok(())
}

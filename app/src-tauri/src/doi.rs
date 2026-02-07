use reqwest::Client;
use serde_json::Value;

pub async fn fetch_doi_metadata(doi: &str) -> Result<Value, String> {
    let client = Client::new();
    // Reverting to citation.doi.org as per user request to match browser script logic
    let url = format!("https://citation.doi.org/metadata?doi={}", doi);
    
    let resp = client.get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    if !resp.status().is_success() {
        return Err(format!("Failed to fetch metadata for DOI {}: status {}", doi, resp.status()));
    }
    
    let json: Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(json)
}

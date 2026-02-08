use serde_json::Value;
use crate::network;

pub async fn fetch_doi_metadata(doi: &str, proxy_mode: &str, proxy_url: Option<&str>) -> Result<Value, String> {
    let client = network::create_client_with_config(proxy_mode, proxy_url)
        .map_err(|e| e.to_string())?;
    
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

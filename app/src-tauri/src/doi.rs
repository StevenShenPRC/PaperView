use serde_json::Value;
use crate::network;

pub async fn fetch_doi_metadata(doi: &str, proxy_mode: &str, proxy_url: Option<&str>) -> Result<Value, String> {
    let client = network::create_client_with_config(proxy_mode, proxy_url)
        .map_err(|e| e.to_string())?;
    
    // Reverting to citation.doi.org as per user request to match browser script logic
    let url = format!("https://citation.doi.org/metadata?doi={}", doi);
    
    // First attempt
    let resp = client.get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().as_u16() == 404 {
        // Retry logic similar to browser script
        println!("DOI {} returned 404, retrying...", doi);
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        
        let resp_retry = client.get(&url)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| e.to_string())?;
            
        if !resp_retry.status().is_success() {
             return Err(format!("Failed to fetch metadata for DOI {}: status {}", doi, resp_retry.status()));
        }
        
        let json: Value = resp_retry.json().await.map_err(|e| e.to_string())?;
        return Ok(json);
    }
        
    if !resp.status().is_success() {
        return Err(format!("Failed to fetch metadata for DOI {}: status {}", doi, resp.status()));
    }
    
    let json: Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(json)
}

pub async fn fetch_semantic_scholar_metadata(doi: &str, proxy_mode: &str, proxy_url: Option<&str>) -> Result<Value, String> {
    let client = network::create_client_with_config(proxy_mode, proxy_url)
        .map_err(|e| e.to_string())?;
    
    // Semantic Scholar API
    // Fields: title, abstract, authors, year, venue, etc.
    let url = format!("https://api.semanticscholar.org/graph/v1/paper/DOI:{}?fields=title,abstract,authors,year,venue", doi);
    
    println!("Fetching from Semantic Scholar: {}", url);
    
    let resp = client.get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Semantic Scholar failed for DOI {}: status {}", doi, resp.status()));
    }
    
    let json: Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(json)
}

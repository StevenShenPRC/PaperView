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

pub async fn fetch_doi_ris(doi: &str, proxy_mode: &str, proxy_url: Option<&str>) -> Result<String, String> {
    let client = network::create_client_with_config(proxy_mode, proxy_url)
        .map_err(|e| e.to_string())?;
    
    let url = format!("https://doi.org/{}", doi);
    
    let resp = client.get(&url)
        .header("Accept", "application/x-research-info-systems")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Failed to fetch RIS for DOI {}: status {}", doi, resp.status()));
    }
    
    let ris = resp.text().await.map_err(|e| e.to_string())?;
    Ok(ris)
}

pub async fn fetch_openalex_metadata(doi: &str, proxy_mode: &str, proxy_url: Option<&str>) -> Result<Value, String> {
    let client = network::create_client_with_config(proxy_mode, proxy_url)
        .map_err(|e| e.to_string())?;
    
    // OpenAlex works API
    let url = format!("https://api.openalex.org/works/https://doi.org/{}", doi);
    
    println!("Fetching from OpenAlex: {}", url);
    
    let resp = client.get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("OpenAlex failed for DOI {}: status {}", doi, resp.status()));
    }
    
    let mut json: Value = resp.json().await.map_err(|e| e.to_string())?;
    
    // Decode abstract_inverted_index if present
    if let Some(index) = json.get("abstract_inverted_index").and_then(|v| v.as_object()) {
        let mut words = Vec::new();
        for (word, positions) in index {
            if let Some(pos_arr) = positions.as_array() {
                for pos in pos_arr {
                    if let Some(p) = pos.as_u64() {
                        words.push((p as usize, word.clone()));
                    }
                }
            }
        }
        words.sort_by_key(|k| k.0);
        let reconstructed: String = words.into_iter().map(|w| w.1).collect::<Vec<_>>().join(" ");
        json["abstract"] = serde_json::Value::String(reconstructed);
    }

    // Extract Journal Name from primary_location.source.display_name
    if let Some(source) = json.get("primary_location")
        .and_then(|pl| pl.get("source")) {
            if let Some(name) = source.get("display_name").and_then(|n| n.as_str()) {
                json["journal_name"] = serde_json::Value::String(name.to_string());
            }
    }
    
    Ok(json)
}

use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use crate::network;
use tauri::{AppHandle, Emitter};
// use futures::StreamExt; // Start using futures for streaming

#[derive(Serialize, Deserialize, Debug)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    stream: bool,
}

#[derive(Deserialize, Debug)]
struct OpenAIStreamResponse {
    choices: Vec<StreamChoice>,
}

#[derive(Deserialize, Debug)]
struct StreamChoice {
    delta: Delta,
    finish_reason: Option<String>,
}

#[derive(Deserialize, Debug)]
struct Delta {
    content: Option<String>,
}

// Helper to normalize Chat URL
fn normalize_chat_url(base_url: &str) -> String {
    let url = base_url.trim_end_matches('/');
    if url.ends_with("/chat/completions") {
        url.to_string()
    } else if url.ends_with("/v1") {
        format!("{}/chat/completions", url)
    } else {
        format!("{}/v1/chat/completions", url)
    }
}

// Helper to normalize Models URL
fn normalize_models_url(base_url: &str) -> String {
    let url = base_url.trim_end_matches('/');
    // If user provided a full chat URL, try to guess root
    if url.ends_with("/chat/completions") {
        let root = url.trim_end_matches("/chat/completions").trim_end_matches('/');
        return format!("{}/models", root); // e.g. .../v1/models
    }
    
    if url.ends_with("/v1") {
        format!("{}/models", url)
    } else {
        format!("{}/v1/models", url)
    }
}

pub async fn stream_chat(
    app: AppHandle,
    base_url: String,
    api_key: String,
    model: String,
    messages: Vec<ChatMessage>,
    proxy_mode: String,
    proxy_url: Option<String>,
    additional_headers: Option<HashMap<String, String>>,
) -> Result<(), String> {
    println!("stream_chat called with model: {}", model);
    let client = network::create_client_with_config(&proxy_mode, proxy_url.as_deref())
        .map_err(|e| format!("Network error: {}", e))?;

    let url = normalize_chat_url(&base_url);
    println!("Normalized Chat URL: {}", url);

    let body = ChatRequest {
        model,
        messages,
        stream: true,
    };

    let mut request_builder = client.post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json");

    if let Some(headers) = additional_headers {
        for (k, v) in headers {
            request_builder = request_builder.header(k, v);
        }
    }

    println!("Sending stream request to: {}", url);
    let mut response = request_builder
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    println!("Stream response status: {}", response.status());

    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        println!("Error response text: {}", text);
        return Err(format!("API Error: {} - {}", status, text));
    }

    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        let chunk_str = String::from_utf8_lossy(&chunk);
        // println!("Received chunk: {}", chunk_str); // Comment out verbose logging
        
        // OpenAI stream format is "data: {...}\n\ndata: {...}"
        for line in chunk_str.lines() {
            if line.starts_with("data: ") {
                let data = line.trim_start_matches("data: ").trim();
                if data == "[DONE]" {
                    break;
                }
                
                if let Ok(json_resp) = serde_json::from_str::<OpenAIStreamResponse>(data) {
                    if let Some(choice) = json_resp.choices.first() {
                        if let Some(content) = &choice.delta.content {
                            app.emit("ai-response-chunk", content).unwrap_or(());
                        }
                    }
                }
            }
        }
    }
    
    app.emit("ai-response-done", ()).unwrap_or(());

    Ok(())
}

// Keeping non-streaming for legacy/simple calls if needed, or refactor to use same client
pub async fn chat_simple(
    base_url: String,
    api_key: String,
    model: String,
    messages: Vec<ChatMessage>,
    proxy_mode: String,
    proxy_url: Option<String>,
    additional_headers: Option<HashMap<String, String>>,
) -> Result<String, String> {
    println!("chat_simple called with model: {}, proxy_mode: {}", model, proxy_mode);
    println!("Base URL: {}", base_url);

    let client = network::create_client_with_config(&proxy_mode, proxy_url.as_deref())
        .map_err(|e| e.to_string())?;
        
    let url = normalize_chat_url(&base_url);
    println!("Request URL: {}", url);
    
    let body = json!({
        "model": model,
        "messages": messages,
        "stream": false
    });
    
    let mut request_builder = client.post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json");

    if let Some(headers) = additional_headers {
        for (k, v) in headers {
            request_builder = request_builder.header(k, v);
        }
    }
    
    println!("Sending request...");
    let resp = request_builder.json(&body).send().await.map_err(|e| format!("Send request failed: {}", e))?;
    
    let status = resp.status();
    println!("Response status: {}", status);
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        println!("Error response text: {}", text);
        return Err(format!("API Error: {} - {}", status, text));
    }
    
    let text = resp.text().await.map_err(|e| format!("Available text error: {}", e))?;
    // println!("Raw response text: {}", text);

    let json_resp: serde_json::Value = serde_json::from_str(&text).map_err(|e| format!("JSON parse error: {} for text: {}", e, text))?;
    
    json_resp["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid response format: missing content".to_string())
}

#[derive(Deserialize, Debug)]
struct ModelsResponse {
    data: Vec<ModelData>,
}

#[derive(Deserialize, Debug)]
struct ModelData {
    id: String,
}

pub async fn fetch_models(
    base_url: String,
    api_key: String,
    proxy_mode: String,
    proxy_url: Option<String>,
    additional_headers: Option<HashMap<String, String>>,
) -> Result<Vec<String>, String> {
    let client = network::create_client_with_config(&proxy_mode, proxy_url.as_deref())
        .map_err(|e| e.to_string())?;

    let url = normalize_models_url(&base_url);
    println!("Fetch Models URL: {}", url);

    let mut request_builder = client.get(&url)
        .header("Authorization", format!("Bearer {}", api_key));

    if let Some(headers) = additional_headers {
        for (k, v) in headers {
            request_builder = request_builder.header(k, v);
        }
    }

    let resp = request_builder.send().await.map_err(|e| format!("Request failed: {}", e))?;
    let status = resp.status();
    
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("API Error: {} - {}", status, text));
    }

    let json_resp: ModelsResponse = resp.json().await.map_err(|e| format!("Parse error: {}", e))?;
    
    Ok(json_resp.data.into_iter().map(|m| m.id).collect())
}
#[derive(Serialize)]
struct EmbeddingRequest {
    model: String,
    input: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    dimensions: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    output_dimensionality: Option<u32>,
}

#[derive(Deserialize, Debug)]
struct EmbeddingResponse {
    data: Vec<EmbeddingData>,
}

#[derive(Deserialize, Debug)]
struct EmbeddingData {
    embedding: Vec<f32>,
}

pub async fn get_embeddings(
    base_url: String,
    api_key: String,
    model: String,
    input: String,
    proxy_mode: String,
    proxy_url: Option<String>,
    additional_headers: Option<HashMap<String, String>>,
    dimensions: Option<u32>,
) -> Result<Vec<f32>, String> {
    let client = network::create_client_with_config(&proxy_mode, proxy_url.as_deref())
        .map_err(|e| e.to_string())?;

    // Normalize URL for embeddings
    // Usually base_url/v1/embeddings
    // Reuse normalization logic or simple append?
    // normalize_chat_url handles /chat/completions. 
    // Let's create a helper or just do simple logic here assuming standard structure.
    let url = if base_url.ends_with("/v1") {
        format!("{}/embeddings", base_url)
    } else if base_url.ends_with("/") {
        format!("{}v1/embeddings", base_url)
    } else {
        format!("{}/v1/embeddings", base_url)
    };

    let body = EmbeddingRequest {
        model,
        input,
        dimensions,
        output_dimensionality: dimensions,
    };

    let mut request_builder = client.post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json");

    if let Some(headers) = additional_headers {
        for (k, v) in headers {
            request_builder = request_builder.header(k, v);
        }
    }

    let resp = request_builder.json(&body).send().await.map_err(|e| format!("Embedding request failed: {}", e))?;
    
    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Embedding API error: {}", text));
    }

    let json_resp: EmbeddingResponse = resp.json().await.map_err(|e| format!("Failed to parse embedding response: {}", e))?;
    
    if let Some(data) = json_resp.data.first() {
        Ok(data.embedding.clone())
    } else {
        Err("No embedding data returned".to_string())
    }
}

use serde::{Deserialize, Serialize};
use reqwest::Client;
use serde_json::json;

#[derive(Serialize, Deserialize, Debug)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Deserialize)]
struct OpenAIResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ChatMessage,
}

pub async fn chat_with_ai(endpoint: &str, key: &str, messages: Vec<ChatMessage>) -> Result<String, String> {
    let client = Client::new();
    let url = if endpoint.ends_with("/chat/completions") {
        endpoint.to_string()
    } else {
        format!("{}/chat/completions", endpoint.trim_end_matches('/'))
    };

    let body = json!({
        "model": "gpt-3.5-turbo", // Or user configured model
        "messages": messages
    });

    let resp = client.post(&url)
        .header("Authorization", format!("Bearer {}", key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("AI Request failed: {}", resp.status()));
    }

    let json_resp: OpenAIResponse = resp.json().await.map_err(|e| e.to_string())?;
    
    if let Some(choice) = json_resp.choices.first() {
        Ok(choice.message.content.clone())
    } else {
        Err("No response from AI".to_string())
    }
}

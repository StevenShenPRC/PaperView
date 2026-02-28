use tauri::{AppHandle, State, path::BaseDirectory, Manager, Emitter};
use crate::{db, ai, AppState};

#[tauri::command]
pub async fn translate_paper(app: AppHandle, _state: State<'_, AppState>, id: i64) -> Result<db::Paper, String> {
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    // 1. Get paper data
    let db_path_clone = db_path.clone();
    let paper = tokio::task::spawn_blocking(move || {
        let conn = db::init_db(db_path_clone.to_str().unwrap()).map_err(|e| e.to_string())?;
        db::get_paper_by_id(&conn, id).map_err(|e| e.to_string())
    }).await.unwrap()?;

    // 2. Get AI Config & Proxy
    let (proxy_mode, proxy_url) = crate::config::get_proxy_config(&app);
    println!("translate_paper: Proxy config: mode={}, url={:?}", proxy_mode, proxy_url);
    
    let (resolved_cfg, user_prompt, target_lang, custom_timeout, _, _) = crate::config::get_translate_config(&app)?;
    let base_url = resolved_cfg.base_url;
    let api_key = resolved_cfg.api_key;
    let provider_name = resolved_cfg.provider_name;
    let headers = resolved_cfg.headers;
    let default_model = resolved_cfg.model;
    
    println!("translate_paper: AI Config: provider={}, base_url={}, model={}", provider_name, base_url, default_model);

    // Use default model if available, otherwise fallback
    let model = if !default_model.is_empty() { 
        default_model 
    } else { 
        "gpt-3.5-turbo".to_string() 
    };
    
    // Construct messages
    let mut prompt_instruction = format!("Translate the following academic paper title and abstract into {}.\nReturn JSON format: {{ \"title_cn\": \"...\", \"abstract_cn\": \"...\" }}.", target_lang);
    if let Some(p) = user_prompt {
        if !p.trim().is_empty() {
            prompt_instruction = p.replace("{{lang}}", &target_lang);
        }
    }
    
    // Force JSON constraint
    if !prompt_instruction.contains("title_cn") || !prompt_instruction.contains("abstract_cn") {
        prompt_instruction.push_str("\n\nYou MUST return a valid JSON object containing exactly `title_cn` and `abstract_cn` keys.");
    }
    
    let prompt = format!(
        "{}\n\nTitle: {}\n\nAbstract: {}", 
        prompt_instruction, paper.title, paper.abstract_text
    );
    
    let messages = vec![
        ai::ChatMessage { role: "system".to_string(), content: "You are a professional academic translator. You MUST reply with a valid JSON format only.".to_string() },
        ai::ChatMessage { role: "user".to_string(), content: prompt },
    ];
    
    // Call AI (Simple non-streaming)
    let response_str = ai::chat_simple(
        base_url, 
        api_key, 
        model, 
        messages, 
        proxy_mode, 
        proxy_url, 
        headers,
        custom_timeout
    ).await?;
    
    // Parse JSON response
    let parsed: serde_json::Value = serde_json::from_str(&response_str)
        .or_else(|_| {
             let start = response_str.find("{");
             let end = response_str.rfind("}");
             if let (Some(s), Some(e)) = (start, end) {
                 serde_json::from_str(&response_str[s..=e])
             } else {
                 Err(serde_json::Error::io(std::io::Error::new(std::io::ErrorKind::InvalidData, "No JSON found")))
             }
        })
        .map_err(|_| format!("Failed to parse AI translation: {}", response_str))?;
        
    let title_cn = parsed["title_cn"].as_str().unwrap_or("").to_string();
    let abstract_cn = parsed["abstract_cn"].as_str().unwrap_or("").to_string();
    
    // 3. Update DB
    let db_path_2 = db_path.clone();
    let t_title = title_cn.clone();
    let t_abstract = abstract_cn.clone();
    
    tokio::task::spawn_blocking(move || {
        let conn = db::init_db(db_path_2.to_str().unwrap()).map_err(|e| e.to_string())?;
        db::update_paper_translation(&conn, id, &t_title, &t_abstract).map_err(|e| e.to_string())
    }).await.unwrap()?;

    // 4. Return updated
    let mut updated = paper;
    updated.title_cn = Some(title_cn);
    updated.abstract_cn = Some(abstract_cn);
    
    // Emit event
    if let Err(e) = app.emit("paper-updated", &updated) {
        println!("Failed to emit paper-updated event: {}", e);
    }
    
    Ok(updated)
}

#[tauri::command]
pub async fn translate_batch(app: AppHandle, state: State<'_, AppState>, ids: Vec<i64>) -> Result<Vec<db::Paper>, String> {
    if ids.is_empty() {
        return Ok(vec![]);
    }

    let (resolved_cfg, user_prompt, target_lang, custom_timeout, merge, batch_size) = crate::config::get_translate_config(&app)?;
    let base_url = resolved_cfg.base_url.clone();
    let api_key = resolved_cfg.api_key.clone();
    let provider_name = resolved_cfg.provider_name;
    let headers = resolved_cfg.headers.clone();
    let default_model = resolved_cfg.model;
    
    // If merge is false, just run them individually and wait.
    if !merge {
        let mut results = Vec::new();
        for id in ids {
            if let Ok(paper) = translate_paper(app.clone(), state.clone(), id).await {
                results.push(paper);
            }
        }
        return Ok(results);
    }

    // --- Merge Mode ---
    let (proxy_mode, proxy_url) = crate::config::get_proxy_config(&app);
    println!("translate_batch (merge): AI Config: provider={}, model={}, batch_size={}", provider_name, default_model, batch_size);

    let model = if !default_model.is_empty() { default_model } else { "gpt-3.5-turbo".to_string() };
    let db_path = app.path().resolve("papers.db", BaseDirectory::AppData).map_err(|e| e.to_string())?;
    
    // Load papers
    let mut papers = Vec::new();
    {
        let conn = db::init_db(db_path.to_str().unwrap()).map_err(|e| e.to_string())?;
        for &id in &ids {
            if let Ok(p) = db::get_paper_by_id(&conn, id) {
                papers.push(p);
            }
        }
    }

    if papers.is_empty() {
        return Ok(vec![]);
    }

    let mut result_papers = Vec::new();

    // Split into chunks of `batch_size`
    for chunk in papers.chunks(batch_size) {
        let mut prompt_instruction = format!("Translate the following academic paper titles and abstracts into {}.\nReturn a single JSON array, where each element is an object:\n[\n  {{ \"id\": {{paper_id}}, \"title_cn\": \"...\", \"abstract_cn\": \"...\" }},\n  ...\n]", target_lang);
        
        if let Some(p) = &user_prompt {
           if !p.trim().is_empty() {
               let replaced_p = p.replace("{{lang}}", &target_lang);
               prompt_instruction = format!("{}\n\nYou MUST return a JSON array where each element contains exactly `id` (integer), `title_cn` (string), and `abstract_cn` (string).", replaced_p);
           }
        }
        
        let mut text_items = String::new();
        for paper in chunk {
            text_items.push_str(&format!("Paper ID: {}\nTitle: {}\nAbstract: {}\n\n---\n\n", paper.id, paper.title, paper.abstract_text));
        }

        let prompt = format!("{}\n\n{}", prompt_instruction, text_items);
        let messages = vec![
            ai::ChatMessage { role: "system".to_string(), content: "You are a professional academic translator. You MUST reply with a valid JSON array and nothing else.".to_string() },
            ai::ChatMessage { role: "user".to_string(), content: prompt }
        ];

        let response_str = ai::chat_simple(
            base_url.clone(), 
            api_key.clone(), 
            model.clone(), 
            messages, 
            proxy_mode.clone(), 
            proxy_url.clone(), 
            headers.clone(),
            custom_timeout
        ).await?;

        // Try to parse array
        let parsed: serde_json::Value = serde_json::from_str(&response_str)
            .or_else(|_| {
                let start = response_str.find("[");
                let end = response_str.rfind("]");
                if let (Some(s), Some(e)) = (start, end) {
                    serde_json::from_str(&response_str[s..=e])
                } else {
                    Err(serde_json::Error::io(std::io::Error::new(std::io::ErrorKind::InvalidData, "No JSON array found")))
                }
            })
            .unwrap_or(serde_json::Value::Null);
            
        let mut parsed_array = None;

        if parsed.is_array() {
            parsed_array = parsed.as_array().cloned();
        } else if parsed.is_object() {
            if let Some(arr) = parsed.get("data").and_then(|v| v.as_array()) {
                parsed_array = Some(arr.clone());
            } else if chunk.len() == 1 {
                parsed_array = Some(vec![parsed.clone()]);
            }
        }

        if let Some(items) = parsed_array {
            // Update db for each translated item
            let conn = db::init_db(db_path.to_str().unwrap()).map_err(|e| e.to_string())?;
            for item in items {
                if let Some(item_id) = item.get("id").and_then(|v| v.as_i64()) {
                    if let Some(_paper) = chunk.iter().find(|p| p.id == item_id) {
                        let title_cn = item.get("title_cn").and_then(|v| v.as_str());
                        let abstract_cn = item.get("abstract_cn").and_then(|v| v.as_str());

                        if let Err(e) = db::update_paper_translation(&conn, item_id, &title_cn.unwrap_or("").to_string(), &abstract_cn.unwrap_or("").to_string()) {
                            println!("Failed to update database for paper {}: {}", item_id, e);
                        } else {
                            if let Ok(updated) = db::get_paper_by_id(&conn, item_id) {
                                result_papers.push(updated.clone());
                                let _ = app.emit("paper-updated", &updated);
                            }
                        }
                    }
                }
            }
        } else {
            println!("Failed to parse batch translation response: {}", response_str);
        }
    }
    
    // Signal refresh if needed
    let _ = app.emit("data-updated", serde_json::Value::Null);

    Ok(result_papers)
}

#[tauri::command]
pub async fn chat_command(
    app: AppHandle,
    messages: Vec<ai::ChatMessage>,
    model: String,
    provider_name: String
) -> Result<(), String> {
    println!("chat_command called using provider: {}, model: {}", provider_name, model);
    // Get Config
    let (proxy_mode, proxy_url) = crate::config::get_proxy_config(&app);
    
    // Get Provider Config by name
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    
    let mut base_url = "".to_string();
    let mut api_key = "".to_string();
    let mut headers = None;
    
    if let Some(providers_val) = store.get("ai_providers") {
        if let Some(providers) = providers_val.as_array() {
            for p in providers {
                if let Some(p_name) = p.get("name").and_then(|v| v.as_str()) {
                    if p_name == provider_name {
                        base_url = p.get("base_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        api_key = p.get("api_key").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        
                         let headers_val = p.get("additional_headers");
                         if let Some(h_obj) = headers_val.and_then(|v| v.as_object()) {
                             let mut map = std::collections::HashMap::new();
                             for (k, v) in h_obj {
                                 if let Some(v_str) = v.as_str() {
                                     map.insert(k.to_string(), v_str.to_string());
                                 }
                             }
                             headers = Some(map);
                         }
                         break;
                    }
                }
            }
        }
    }
    
    if base_url.is_empty() {
        return Err("Provider not found or missing URL".to_string());
    }

    ai::stream_chat(app, base_url, api_key, model, messages, proxy_mode, proxy_url, headers, None).await
}

#[tauri::command]
pub async fn generate_chat_title_command(
    app: AppHandle,
    messages: Vec<ai::ChatMessage>,
    model: String,
    provider_name: String
) -> Result<String, String> {
    println!("generate_chat_title_command called using provider: {}, model: {}", provider_name, model);
    // Get Config
    let (proxy_mode, proxy_url) = crate::config::get_proxy_config(&app);
    
    // Get Provider Config by name
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    
    let mut base_url = "".to_string();
    let mut api_key = "".to_string();
    let mut headers = None;
    
    if let Some(providers_val) = store.get("ai_providers") {
        if let Some(providers) = providers_val.as_array() {
            for p in providers {
                if let Some(p_name) = p.get("name").and_then(|v| v.as_str()) {
                    if p_name == provider_name {
                        base_url = p.get("base_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        api_key = p.get("api_key").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        
                         let headers_val = p.get("additional_headers");
                         if let Some(h_obj) = headers_val.and_then(|v| v.as_object()) {
                             let mut map = std::collections::HashMap::new();
                             for (k, v) in h_obj {
                                 if let Some(v_str) = v.as_str() {
                                     map.insert(k.to_string(), v_str.to_string());
                                 }
                             }
                             headers = Some(map);
                         }
                         break;
                    }
                }
            }
        }
    }
    
    if base_url.is_empty() {
        return Err("Provider not found or missing URL".to_string());
    }

    ai::generate_chat_title(base_url, api_key, model, messages, proxy_mode, proxy_url, headers, None).await
}

#[tauri::command]
pub async fn fetch_models_command(
    app: AppHandle,
    base_url: String,
    api_key: String,
    additional_headers: Option<std::collections::HashMap<String, String>>
) -> Result<Vec<String>, String> {
    let (proxy_mode, proxy_url) = crate::config::get_proxy_config(&app);
    ai::fetch_models(base_url, api_key, proxy_mode, proxy_url, additional_headers, Some(15)).await
}

#[tauri::command]
pub async fn get_model_database(app: AppHandle) -> Result<serde_json::Value, String> {
    // Try Resource directory first (production build)
    let resource_path = app.path().resource_dir()
        .map(|d| d.join("assets/model_prices_and_context_window.json"))
        .unwrap_or_default();

    let path = if resource_path.exists() {
        resource_path
    } else {
        // Fallback for development: file is in src-tauri/assets/
        let dev_path = std::env::current_dir()
            .map(|d| d.join("assets/model_prices_and_context_window.json"))
            .unwrap_or_default();
        dev_path
    };

    if path.exists() {
        let content = tokio::fs::read_to_string(&path).await.map_err(|e| format!("Failed to read model db at {:?}: {}", path, e))?;
        let json: serde_json::Value = serde_json::from_str(&content).map_err(|e| format!("Failed to parse model db: {}", e))?;
        Ok(json)
    } else {
        // Return empty if file not found
        eprintln!("Model database not found at {:?}", path);
        Ok(serde_json::json!({}))
    }
}

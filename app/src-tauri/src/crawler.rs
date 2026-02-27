use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use once_cell::sync::Lazy;
use serde_json::Value;
use regex::Regex;
use crate::network;

// Rate Limiting Configuration
const LIMIT_1S: usize = 1;
const LIMIT_1M: usize = 10;
const LIMIT_1H: usize = 100;

// Global Rate Limiter State
static RATE_LIMITER: Lazy<Arc<Mutex<RateLimiter>>> = Lazy::new(|| {
    Arc::new(Mutex::new(RateLimiter::new()))
});

struct RateLimiter {
    history: Vec<Instant>,
}

impl RateLimiter {
    fn new() -> Self {
        Self { history: Vec::new() }
    }

    fn check_and_record(&mut self) -> Result<(), String> {
        let now = Instant::now();
        
        // Prune logic: remove timestamps older than 1 hour
        self.history.retain(|&t| now.duration_since(t) < Duration::from_secs(3600));

        let count_1s = self.history.iter().filter(|&&t| now.duration_since(t) < Duration::from_secs(1)).count();
        if count_1s >= LIMIT_1S {
            return Err("Publisher policy limit (1 req/s)".to_string());
        }

        let count_1m = self.history.iter().filter(|&&t| now.duration_since(t) < Duration::from_secs(60)).count();
        if count_1m >= LIMIT_1M {
            return Err("Publisher policy limit (10 req/min)".to_string());
        }

        let count_1h = self.history.len(); // Already pruned to 1h
        if count_1h >= LIMIT_1H {
            return Err("Publisher policy limit (100 req/h)".to_string());
        }

        self.history.push(now);
        Ok(())
    }
}

pub async fn fetch_metadata_by_crawling(doi: &str, proxy_mode: &str, proxy_url: Option<&str>) -> Result<Value, String> {
    // 1. Check Rate Limit
    {
        let mut limiter = RATE_LIMITER.lock().map_err(|e| e.to_string())?;
        limiter.check_and_record()?;
    }

    let client = network::create_client_with_config(proxy_mode, proxy_url, None)
        .map_err(|e| e.to_string())?;

    // 2. Prepare Request with Edge Headers
    let url = format!("https://doi.org/{}", doi);
    println!("Crawling fallback (via DOI): {}", url);

    let resp = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0")
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Sec-Ch-Ua", "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Microsoft Edge\";v=\"120\"")
        .header("Sec-Ch-Ua-Mobile", "?0")
        .header("Sec-Ch-Ua-Platform", "\"Windows\"")
        .header("Sec-Fetch-Dest", "document")
        .header("Sec-Fetch-Mode", "navigate")
        .header("Sec-Fetch-Site", "none")
        .header("Sec-Fetch-User", "?1")
        .header("Upgrade-Insecure-Requests", "1")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    if !status.is_success() {
        if status.as_u16() == 429 {
             return Err("Publisher policy limit (Too Many Requests)".to_string());
        }
        if status.as_u16() == 403 {
             return Err("Triggered publisher risk control (403 Forbidden)".to_string());
        }
        return Err(format!("Crawler failed: status {}", status));
    }

    let final_url = resp.url().clone();
    let domain = final_url.domain().unwrap_or("").to_lowercase();
    let html = resp.text().await.map_err(|e| e.to_string())?;

    // 3. Parse HTML
    // Check for global Captcha/Bot indicators
    if html.contains("google.com/recaptcha") || html.contains("distil_r_captcha.html") || html.contains("Human verification") {
        return Err("Triggered publisher risk control (Captcha detected)".to_string());
    }

    // 4. Dispatch based on domain
    println!("Crawler landed on domain: {}", domain);

    if domain.contains("springer.com") || domain.contains("nature.com") {
        return parse_springer_html(&html);
    } 
    // Example for future extension:
    // else if domain.contains("sciencedirect.com") {
    //     return parse_sciencedirect_html(&html);
    // }
    else {
        // Fallback or Try to detect via content structure if domain doesn't match
        if html.contains("Abs1-content") {
             println!("Domain not recognized as Springer but content matches. Trying Springer parser.");
             return parse_springer_html(&html);
        }
        
        return Err(format!("No crawler parser available for domain: {}", domain));
    }
}

fn parse_springer_html(html: &str) -> Result<Value, String> {
    // Extract Abstract
    // Structure: <div class="c-article-section__content" id="Abs1-content">...</div>
    let re = Regex::new(r#"(?s)<div[^>]*id="Abs1-content"[^>]*>(.*?)</div>"#).map_err(|e| e.to_string())?;
    
    let abstract_html = re.captures(html)
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str())
        .unwrap_or("");

    if abstract_html.is_empty() {
        // Try alternate ID for some Springer variants
        // e.g. <section id="Abs1" ...><p>...</p></section>
        println!("Springer Parser: No abstract found with primary pattern.");
    }

    let abstract_text = clean_html(abstract_html);

    // Title: <h1 class="c-article-title" ...>(.*?)</h1>
    let re_title = Regex::new(r#"(?s)<h1[^>]*class="c-article-title"[^>]*>(.*?)</h1>"#).map_err(|_| "regex error".to_string())?;
    let title = re_title.captures(html)
        .and_then(|caps| caps.get(1))
        .map(|m| clean_html(m.as_str()))
        .unwrap_or("".to_string());

    let mut result = serde_json::Map::new();
    result.insert("title".to_string(), Value::String(title));
    result.insert("abstract".to_string(), Value::String(abstract_text));
    result.insert("source".to_string(), Value::String("crawler_springer".to_string()));

    Ok(Value::Object(result))
}

fn clean_html(input: &str) -> String {
    // Basic tag stripping
    let re_tags = Regex::new(r"<[^>]*>").unwrap();
    let no_tags = re_tags.replace_all(input, " ");
    // Decode entities (basic)
    let decoded = no_tags.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#x3D;", "=");
    
    decoded.split_whitespace().collect::<Vec<&str>>().join(" ")
}

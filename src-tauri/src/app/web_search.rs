use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::error::{AppError, Result};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WebSearchItem {
    pub title: String,
    pub url: String,
    pub description: String,
}

pub async fn search_web(query: &str, api_key: &str) -> Result<Vec<WebSearchItem>> {
    let query = query.trim();
    if query.is_empty() || query.chars().count() > 600 {
        return Err(AppError::CalendarError("搜索词长度须为 1–600 字符".into()));
    }
    if api_key.trim().is_empty() {
        return Err(AppError::CalendarError("请填写 Brave Search API Key".into()));
    }
    let client = reqwest::Client::builder().timeout(Duration::from_secs(15)).build()?;
    let response = client
        .get("https://api.search.brave.com/res/v1/web/search")
        .header("X-Subscription-Token", api_key.trim())
        .query(&[("q", query), ("count", "10")])
        .send().await?;
    if !response.status().is_success() {
        return Err(AppError::CalendarError(format!("网页搜索失败：HTTP {}", response.status())));
    }
    let value: serde_json::Value = response.json().await?;
    let rows = value.pointer("/web/results").and_then(|items| items.as_array())
        .ok_or_else(|| AppError::CalendarError("搜索服务未返回网页结果".into()))?;
    Ok(rows.iter().filter_map(|row| {
        let url = row.get("url")?.as_str()?.to_owned();
        if !url.starts_with("https://") && !url.starts_with("http://") { return None; }
        Some(WebSearchItem {
            title: row.get("title").and_then(|value| value.as_str()).unwrap_or_default().to_owned(),
            url,
            description: row.get("description").and_then(|value| value.as_str()).unwrap_or_default().to_owned(),
        })
    }).collect())
}

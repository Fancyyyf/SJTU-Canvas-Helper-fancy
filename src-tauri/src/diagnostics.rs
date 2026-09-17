use regex::Regex;
use reqwest::Url;
use serde::Deserialize;
use serde_json::Value;

const MAX_LOG_FIELD_CHARS: usize = 16 * 1024;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendDiagnosticEvent {
    pub schema_version: u8,
    pub event_id: String,
    pub timestamp: String,
    pub level: i32,
    pub code: String,
    pub scope: String,
    pub action: String,
    pub outcome: String,
    pub recoverable: bool,
    #[serde(default)]
    pub fallback: Option<Value>,
    #[serde(default)]
    pub user_message: Option<String>,
    #[serde(default)]
    pub context: Option<Value>,
    #[serde(default)]
    pub error: Option<Value>,
    #[serde(default)]
    pub trace_id: Option<String>,
}

fn is_secret_key(name: &str) -> bool {
    let normalized = name.to_ascii_lowercase().replace('-', "_");
    [
        "authorization",
        "cookie",
        "password",
        "passwd",
        "secret",
        "token",
        "api_key",
        "apikey",
        "signature",
        "jwt",
        "credential",
        "session",
    ]
    .iter()
    .any(|secret| normalized == *secret || normalized.ends_with(&format!("_{secret}")))
        || normalized == "key"
}

fn truncate(value: String) -> String {
    if value.chars().count() <= MAX_LOG_FIELD_CHARS {
        return value;
    }
    let truncated = value.chars().take(MAX_LOG_FIELD_CHARS).collect::<String>();
    format!("{truncated}<truncated>")
}

pub fn sanitize_url(url: &Url) -> String {
    let mut sanitized = url.clone();
    let pairs = url
        .query_pairs()
        .map(|(name, value)| {
            let value = if is_secret_key(&name) {
                "<redacted>".into()
            } else {
                value
            };
            (name.into_owned(), value.into_owned())
        })
        .collect::<Vec<_>>();
    if !pairs.is_empty() {
        sanitized.query_pairs_mut().clear().extend_pairs(pairs);
    }
    if !sanitized.username().is_empty() {
        let _ = sanitized.set_username("<redacted>");
    }
    if sanitized.password().is_some() {
        let _ = sanitized.set_password(Some("<redacted>"));
    }
    sanitized.to_string()
}

pub fn sanitize_header_value(name: &str, value: &str) -> String {
    if is_secret_key(name) || name.eq_ignore_ascii_case("set-cookie") {
        "<redacted>".to_owned()
    } else {
        sanitize_text(value)
    }
}

pub fn redact_json(value: &mut Value) {
    match value {
        Value::Object(entries) => {
            for (key, child) in entries {
                if is_secret_key(key) {
                    *child = Value::String("<redacted>".to_owned());
                } else {
                    redact_json(child);
                }
            }
        }
        Value::Array(values) => values.iter_mut().for_each(redact_json),
        Value::String(value) => *value = sanitize_text(value),
        _ => {}
    }
}

pub fn sanitize_text(value: &str) -> String {
    let bearer = Regex::new(r"(?i)(Bearer\s+)[A-Za-z0-9._~+/=-]+").expect("valid regex");
    let assignments = Regex::new(
        r"(?i)((?:password|passwd|token|api[_-]?key|signature|jwt|cookie|secret)\s*[:=]\s*)[^\s,;&]+",
    )
    .expect("valid regex");
    let bearer_redacted = bearer.replace_all(value, "$1<redacted>");
    truncate(
        assignments
            .replace_all(&bearer_redacted, "$1<redacted>")
            .into_owned(),
    )
}

pub fn sanitize_body(body: &[u8]) -> String {
    if body.is_empty() {
        return String::new();
    }
    if let Ok(mut value) = serde_json::from_slice::<Value>(body) {
        redact_json(&mut value);
        return truncate(value.to_string());
    }
    sanitize_text(&String::from_utf8_lossy(body))
}

fn sanitized_value(value: Option<Value>) -> String {
    let Some(mut value) = value else {
        return "<none>".to_owned();
    };
    redact_json(&mut value);
    truncate(value.to_string())
}

pub fn emit_frontend_event(mut event: FrontendDiagnosticEvent) {
    if !cfg!(debug_assertions) && event.level < 2 {
        return;
    }
    event.code = sanitize_text(&event.code);
    event.scope = sanitize_text(&event.scope);
    event.action = sanitize_text(&event.action);
    event.outcome = sanitize_text(&event.outcome);
    event.user_message = event.user_message.map(|value| sanitize_text(&value));
    event.trace_id = event.trace_id.map(|value| sanitize_text(&value));

    let fallback = sanitized_value(event.fallback);
    let context = if cfg!(debug_assertions) {
        sanitized_value(event.context)
    } else {
        "<omitted-in-release>".to_owned()
    };
    let error = sanitized_value(event.error);
    let trace_id = event.trace_id.as_deref().unwrap_or("unscoped");
    let user_message = event.user_message.as_deref().unwrap_or("<none>");

    match event.level {
        i32::MIN..=0 => tracing::debug!(
            target: "frontend_diagnostic",
            schema_version = event.schema_version,
            event_id = %event.event_id,
            timestamp = %event.timestamp,
            code = %event.code,
            scope = %event.scope,
            action = %event.action,
            outcome = %event.outcome,
            recoverable = event.recoverable,
            %trace_id, %fallback, %user_message, %context, %error,
            "Frontend diagnostic event"
        ),
        1 => tracing::info!(
            target: "frontend_diagnostic",
            schema_version = event.schema_version,
            event_id = %event.event_id,
            timestamp = %event.timestamp,
            code = %event.code,
            scope = %event.scope,
            action = %event.action,
            outcome = %event.outcome,
            recoverable = event.recoverable,
            %trace_id, %fallback, %user_message, %context, %error,
            "Frontend diagnostic event"
        ),
        2 => tracing::warn!(
            target: "frontend_diagnostic",
            schema_version = event.schema_version,
            event_id = %event.event_id,
            timestamp = %event.timestamp,
            code = %event.code,
            scope = %event.scope,
            action = %event.action,
            outcome = %event.outcome,
            recoverable = event.recoverable,
            %trace_id, %fallback, %user_message, %context, %error,
            "Frontend diagnostic event"
        ),
        _ => tracing::error!(
            target: "frontend_diagnostic",
            schema_version = event.schema_version,
            event_id = %event.event_id,
            timestamp = %event.timestamp,
            code = %event.code,
            scope = %event.scope,
            action = %event.action,
            outcome = %event.outcome,
            recoverable = event.recoverable,
            %trace_id, %fallback, %user_message, %context, %error,
            "Frontend diagnostic event"
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_sensitive_url_values() {
        let url = Url::parse("https://example.com/video.mp4?key=secret&part=1").unwrap();
        let value = sanitize_url(&url);
        assert!(value.contains("key=%3Credacted%3E"));
        assert!(value.contains("part=1"));
        assert!(!value.contains("secret"));
    }

    #[test]
    fn redacts_nested_json_values() {
        let mut value = serde_json::json!({
            "token": "secret",
            "nested": { "password": "hidden", "status": "ok" }
        });
        redact_json(&mut value);
        assert_eq!(value["token"], "<redacted>");
        assert_eq!(value["nested"]["password"], "<redacted>");
        assert_eq!(value["nested"]["status"], "ok");
    }
}

use std::{path::PathBuf, process::Stdio};

use serde_json::json;
use sha2::{Digest, Sha256};
use tokio::{io::AsyncWriteExt, process::Command, time::{timeout, Duration}};
use uuid::Uuid;

use crate::{
    app::App,
    client::EffectiveLlmConfig,
    error::{AppError, Result},
    model::LLMChatMessage,
    APP,
};

const PI_KEY_ENV: &str = "SJTU_CANVAS_HELPER_PI_API_KEY";

fn pi_model_config(config: &EffectiveLlmConfig) -> serde_json::Value {
    json!({
        "providers": {
            "canvas-helper": {
                "baseUrl": config.base_url,
                "api": "openai-completions",
                "apiKey": format!("${PI_KEY_ENV}"),
                "models": [{ "id": config.model }]
            }
        }
    })
}

fn session_path(root: &std::path::Path, account: &str, conversation_id: &str) -> Result<PathBuf> {
    let id = Uuid::parse_str(conversation_id)
        .map_err(|_| AppError::LLMError("Invalid Pi conversation ID".into()))?;
    let digest = Sha256::digest(account.as_bytes());
    let account_id = format!("{digest:x}");
    Ok(root.join("sessions").join(&account_id[..16]).join(format!("{id}.jsonl")))
}

pub async fn chat_with_pi(
    messages: &[LLMChatMessage],
    context: &str,
    account: &str,
    conversation_id: &str,
) -> Result<String> {
    let latest = messages.last().filter(|message| message.role == "user" && !message.content.trim().is_empty())
        .ok_or_else(|| AppError::LLMError("Please enter a message".into()))?;
    if context.len() > 100_000 || latest.content.len() > 50_000 {
        return Err(AppError::LLMError("Pi message or context is too long".into()));
    }

    // The selected app profile drives both agents. The key stays out of argv and models.json.
    let config = EffectiveLlmConfig::from_app_config(&APP.get_config().await);
    if config.api_key.is_empty() {
        return Err(AppError::LLMError("Please configure an LLM API key in Settings".into()));
    }
    let root = PathBuf::from(App::config_dir()?).join("sjtu-canvas-helper-pi");
    let session = session_path(&root, account, conversation_id)?;
    tokio::fs::create_dir_all(session.parent().expect("Pi session has parent")).await?;
    tokio::fs::write(root.join("models.json"), pi_model_config(&config).to_string()).await?;

    let mut prompt = if session.exists() {
        String::from("Updated read-only local study data:\n")
    } else {
        String::from("You are an SJTU Canvas study assistant. The following local calendar and TODO data is read-only. Do not claim you can call Canvas APIs or modify data.\n\n")
    };
    prompt.push_str(context);
    prompt.push_str("\n\nUser request:\n");
    prompt.push_str(latest.content.trim());

    let executable = if cfg!(windows) { "pi.cmd" } else { "pi" };
    let mut command = Command::new(executable);
    command.args(["--print", "--no-tools", "--no-extensions", "--no-skills", "--no-context-files", "--no-approve", "--offline"])
        .arg("--provider").arg("canvas-helper")
        .arg("--model").arg(&config.model)
        .arg("--session").arg(&session)
        .current_dir(std::env::temp_dir())
        .env("PI_CODING_AGENT_DIR", &root)
        .env(PI_KEY_ENV, &config.api_key)
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped())
        .kill_on_drop(true);
    let mut child = command.spawn().map_err(|_| AppError::LLMError(
        "Pi CLI was not found. Install pi to use Pi Agent".into()))?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(prompt.as_bytes()).await?;
    }
    let output = timeout(Duration::from_secs(120), child.wait_with_output()).await
        .map_err(|_| AppError::LLMError("Pi response timed out".into()))??;
    if !output.status.success() {
        return Err(AppError::LLMError("Pi failed. Check the selected model and API endpoint".into()));
    }
    let answer = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    if answer.is_empty() {
        return Err(AppError::LLMError("Pi returned an empty response".into()));
    }
    Ok(answer)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_config_uses_environment_reference() {
        let config = EffectiveLlmConfig::from_parts("secret", "https://example.com/v1", "my-model", None);
        let value = pi_model_config(&config).to_string();
        assert!(value.contains("$SJTU_CANVAS_HELPER_PI_API_KEY"));
        assert!(!value.contains("secret"));
        assert!(value.contains("https://example.com/v1"));
    }

    #[test]
    fn session_path_rejects_non_uuid() {
        assert!(session_path(std::path::Path::new("/tmp"), "account", "../escape").is_err());
    }
}

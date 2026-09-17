use std::{path::PathBuf, process::Stdio};

use chrono::Utc;
use serde_json::Value;
use tauri::{Emitter, Manager, Window};
use tokio::{
    io::{AsyncBufReadExt, AsyncReadExt, BufReader},
    process::Command,
};

use crate::{
    error::{AppError, Result},
    model::{
        AppConfig, AttendanceEventPayload, AttendancePythonStatus, AttendanceSignResult,
        AttendanceWatchStatus,
    },
};

use super::App;

const MIN_SCAN_INTERVAL_MS: u64 = 500;
const MAX_SCAN_INTERVAL_MS: u64 = 10_000;
const PYTHON_IMPORT_CHECK: &str =
    "import requests, bs4, ddddocr, PIL, pyzbar, numpy, sys; print(sys.version.split()[0])";

#[derive(Clone)]
struct PythonInvocation {
    program: String,
    prefix_args: Vec<String>,
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn attendance_error(message: impl Into<String>) -> AppError {
    AppError::AttendanceError(message.into())
}

fn event_payload(
    kind: &str,
    message: impl Into<String>,
    qr_content: Option<String>,
) -> AttendanceEventPayload {
    AttendanceEventPayload {
        kind: kind.to_owned(),
        timestamp: now(),
        message: message.into(),
        qr_content,
    }
}

fn command_for(invocation: &PythonInvocation) -> Command {
    let mut command = Command::new(&invocation.program);
    command.args(&invocation.prefix_args);
    command
}

fn invocation_label(invocation: &PythonInvocation) -> String {
    std::iter::once(invocation.program.as_str())
        .chain(invocation.prefix_args.iter().map(String::as_str))
        .collect::<Vec<_>>()
        .join(" ")
}

fn python_candidates(preferred: &str) -> Vec<PythonInvocation> {
    let mut candidates = Vec::new();
    if !preferred.trim().is_empty() {
        candidates.push(PythonInvocation {
            program: preferred.trim().to_owned(),
            prefix_args: Vec::new(),
        });
    }
    for (program, prefix_args) in [
        ("python", Vec::new()),
        ("python3", Vec::new()),
        ("py", vec!["-3".to_owned()]),
    ] {
        if !candidates
            .iter()
            .any(|candidate| candidate.program == program)
        {
            candidates.push(PythonInvocation {
                program: program.to_owned(),
                prefix_args,
            });
        }
    }
    candidates
}

async fn check_python_dependencies(invocation: &PythonInvocation) -> Result<String> {
    let output = command_for(invocation)
        .arg("-c")
        .arg(PYTHON_IMPORT_CHECK)
        .output()
        .await?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned());
    }
    let error = String::from_utf8_lossy(&output.stderr).trim().to_owned();
    Err(attendance_error(format!(
        "Python 签到依赖不完整。请运行 `{} -m pip install -r python/attendance/requirements.txt`。{}",
        invocation_label(invocation),
        if error.is_empty() {
            String::new()
        } else {
            format!("\n{error}")
        }
    )))
}

async fn resolve_python_environment(preferred: &str) -> Result<(PythonInvocation, String)> {
    let mut dependency_error = None;
    for candidate in python_candidates(preferred) {
        let output = command_for(&candidate)
            .arg("-c")
            .arg("import sys; print(sys.version.split()[0])")
            .output()
            .await;
        let Ok(output) = output else {
            continue;
        };
        if !output.status.success() {
            continue;
        }
        let version = String::from_utf8_lossy(&output.stdout).trim().to_owned();
        match check_python_dependencies(&candidate).await {
            Ok(_) => return Ok((candidate, version)),
            Err(error) if dependency_error.is_none() => dependency_error = Some(error),
            Err(_) => {}
        }
    }
    if let Some(error) = dependency_error {
        Err(error)
    } else {
        Err(attendance_error(
            "没有找到可用的 Python 3。请安装 Python，或在签到守望页面填写解释器完整路径。",
        ))
    }
}

fn python_module_dir(window: &Window) -> Result<PathBuf> {
    let development_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../python/attendance");
    if development_path.join("nn.py").is_file() {
        return Ok(development_path);
    }

    let resource_dir = window
        .app_handle()
        .path()
        .resource_dir()
        .map_err(|error| attendance_error(format!("无法定位应用资源目录：{error}")))?;
    for relative in ["python/attendance", "_up_/python/attendance"] {
        let candidate = resource_dir.join(relative);
        if candidate.join("nn.py").is_file() {
            return Ok(candidate);
        }
    }
    Err(attendance_error(
        "应用资源中没有找到 python/attendance/nn.py。请重新安装完整版本。",
    ))
}

fn apply_python_environment(command: &mut Command, config: &AppConfig) {
    command
        .env(
            "SJTU_ATTENDANCE_USERNAME",
            if config.attendance_password_login_enabled {
                &config.attendance_username
            } else {
                ""
            },
        )
        .env(
            "SJTU_ATTENDANCE_PASSWORD",
            if config.attendance_password_login_enabled {
                &config.attendance_password
            } else {
                ""
            },
        )
        .env("SJTU_ATTENDANCE_JA_AUTH_COOKIE", &config.ja_auth_cookie)
        .env(
            "SJTU_ATTENDANCE_RISK_DELAY_MS",
            config.attendance_risk_delay_ms.to_string(),
        )
        .env("PYTHONUTF8", "1")
        .env("PYTHONIOENCODING", "utf-8");
}

fn parse_json_lines(output: &[u8]) -> Vec<Value> {
    String::from_utf8_lossy(output)
        .lines()
        .filter_map(|line| serde_json::from_str::<Value>(line.trim()).ok())
        .collect()
}

fn value_string(value: &Value, name: &str) -> Option<String> {
    value.get(name).and_then(Value::as_str).map(str::to_owned)
}

async fn handle_watch_event(window: &Window, value: Value) {
    let kind = value.get("kind").and_then(Value::as_str).unwrap_or("info");
    let message = value_string(&value, "message").unwrap_or_else(|| "Python 模块事件".to_owned());
    let qr_content = value_string(&value, "qrContent");

    match kind {
        "scan" => {
            let mut status = crate::APP.attendance_status.write().await;
            status.scan_count += 1;
            status.last_scan_at = Some(now());
            return;
        }
        "detected" => {
            let mut status = crate::APP.attendance_status.write().await;
            status.detected_count += 1;
            status.last_detected_at = Some(now());
            status.last_qr_content = qr_content.clone();
            status.last_message = message.clone();
        }
        "duplicate" => {
            crate::APP.attendance_status.write().await.duplicate_count += 1;
            return;
        }
        "success" => {
            let mut status = crate::APP.attendance_status.write().await;
            status.success_count += 1;
            status.last_message = message.clone();
        }
        "failed" | "error" => {
            let mut status = crate::APP.attendance_status.write().await;
            status.failure_count += 1;
            status.last_message = message.clone();
        }
        "started" => {
            crate::APP.attendance_status.write().await.last_message = message.clone();
        }
        "stopped" => {
            let mut status = crate::APP.attendance_status.write().await;
            status.running = false;
            status.last_message = message.clone();
        }
        "info" => {}
        _ => return,
    }

    let _ = window.emit(
        "attendance://event",
        AttendanceEventPayload {
            kind: kind.to_owned(),
            timestamp: value_string(&value, "timestamp").unwrap_or_else(now),
            message,
            qr_content,
        },
    );
}

impl App {
    pub async fn check_attendance_python(
        &self,
        window: &Window,
        python_command: Option<&str>,
    ) -> AttendancePythonStatus {
        let configured = self.config.read().await.attendance_python_command.clone();
        let preferred = python_command.unwrap_or(&configured);
        let module_dir = match python_module_dir(window) {
            Ok(path) => path.to_string_lossy().to_string(),
            Err(error) => {
                return AttendancePythonStatus {
                    message: error.to_string(),
                    ..Default::default()
                };
            }
        };
        match resolve_python_environment(&preferred).await {
            Ok((invocation, version)) => AttendancePythonStatus {
                available: true,
                interpreter: invocation_label(&invocation),
                version,
                module_dir,
                message: "Python 解释器和签到依赖均可用".to_owned(),
            },
            Err(error) => AttendancePythonStatus {
                available: false,
                module_dir,
                message: error.to_string(),
                ..Default::default()
            },
        }
    }

    pub async fn scan_attendance_once(&self, window: &Window) -> Result<Vec<String>> {
        let config = self.config.read().await.clone();
        let (python, _) = resolve_python_environment(&config.attendance_python_command).await?;
        let script = python_module_dir(window)?.join("nn.py");
        let output = command_for(&python)
            .arg("-u")
            .arg(script)
            .arg("--scan-once")
            .arg("--json")
            .env("PYTHONUTF8", "1")
            .env("PYTHONIOENCODING", "utf-8")
            .output()
            .await?;
        for value in parse_json_lines(&output.stdout).into_iter().rev() {
            if value.get("kind").and_then(Value::as_str) == Some("scan_result") {
                return Ok(value
                    .get("codes")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .filter_map(Value::as_str)
                    .map(str::to_owned)
                    .collect());
            }
        }
        Err(attendance_error(format!(
            "Python 单次扫描没有返回有效结果。{}",
            String::from_utf8_lossy(&output.stderr).trim()
        )))
    }

    pub async fn sign_attendance_url(
        &self,
        window: &Window,
        url: &str,
    ) -> Result<AttendanceSignResult> {
        let config = self.config.read().await.clone();
        let password_login_ready = config.attendance_password_login_enabled
            && !config.attendance_username.trim().is_empty()
            && !config.attendance_password.is_empty();
        if config.ja_auth_cookie.trim().is_empty() && !password_login_ready {
            return Err(attendance_error(
                "请先完成额外扫码登录，或保存签到守望的账号密码配置。",
            ));
        }

        let (python, _) = resolve_python_environment(&config.attendance_python_command).await?;
        let script = python_module_dir(window)?.join("surveil.py");
        let mut command = command_for(&python);
        command.arg("-u").arg(script).arg("--json");
        command.env("SJTU_ATTENDANCE_URL", url);
        apply_python_environment(&mut command, &config);
        let output = command.output().await?;
        for value in parse_json_lines(&output.stdout).into_iter().rev() {
            if value.get("kind").and_then(Value::as_str) == Some("result") {
                return Ok(AttendanceSignResult {
                    success: value
                        .get("success")
                        .and_then(Value::as_bool)
                        .unwrap_or(false),
                    message: value_string(&value, "message")
                        .unwrap_or_else(|| "Python 签到模块未返回说明".to_owned()),
                    qr_url: value_string(&value, "qrUrl").unwrap_or_else(|| url.to_owned()),
                    response_status: value
                        .get("responseStatus")
                        .and_then(Value::as_u64)
                        .unwrap_or_default() as u16,
                    response_body: value_string(&value, "responseBody").unwrap_or_default(),
                });
            }
        }
        Err(attendance_error(format!(
            "Python 签到模块没有返回有效结果。{}",
            String::from_utf8_lossy(&output.stderr).trim()
        )))
    }

    pub async fn get_attendance_watch_status(&self) -> AttendanceWatchStatus {
        self.attendance_status.read().await.clone()
    }

    pub async fn start_attendance_watch(&self, window: Window, interval_ms: u64) -> Result<bool> {
        if self.attendance_handle.read().await.is_some() {
            return Ok(false);
        }
        let config = self.config.read().await.clone();
        let password_login_ready = config.attendance_password_login_enabled
            && !config.attendance_username.trim().is_empty()
            && !config.attendance_password.is_empty();
        if config.ja_auth_cookie.trim().is_empty() && !password_login_ready {
            return Err(attendance_error(
                "请先完成额外扫码登录，或保存签到守望的账号密码配置。",
            ));
        }

        let (python, _) = resolve_python_environment(&config.attendance_python_command).await?;
        let interval_ms = interval_ms.clamp(MIN_SCAN_INTERVAL_MS, MAX_SCAN_INTERVAL_MS);
        let script = python_module_dir(&window)?.join("nn.py");
        let mut command = command_for(&python);
        command
            .arg("-u")
            .arg(script)
            .arg("--watch")
            .arg("--json")
            .arg("--interval-ms")
            .arg(interval_ms.to_string())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        apply_python_environment(&mut command, &config);
        let mut child = command
            .spawn()
            .map_err(|error| attendance_error(format!("无法启动 Python 签到模块：{error}")))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| attendance_error("无法读取 Python 签到模块输出"))?;
        let mut stderr = child.stderr.take();

        *self.attendance_status.write().await = AttendanceWatchStatus {
            running: true,
            interval_ms,
            started_at: Some(now()),
            last_message: "正在启动 Python 签到守望模块".to_owned(),
            ..Default::default()
        };
        let _ = window.emit(
            "attendance://event",
            event_payload("started", "正在启动 Python 签到守望模块", None),
        );

        let handle = tokio::spawn(async move {
            let stderr_task = tokio::spawn(async move {
                let mut text = String::new();
                if let Some(ref mut stderr) = stderr {
                    let _ = stderr.read_to_string(&mut text).await;
                }
                text
            });
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if let Ok(value) = serde_json::from_str::<Value>(&line) {
                    handle_watch_event(&window, value).await;
                }
            }
            let exit = child.wait().await;
            let stderr_text = stderr_task.await.unwrap_or_default();
            let mut status = crate::APP.attendance_status.write().await;
            let was_running = status.running;
            status.running = false;
            if was_running {
                let message = match exit {
                    Ok(code) if code.success() => "Python 签到守望已结束".to_owned(),
                    Ok(code) => format!(
                        "Python 签到守望异常退出（{}）：{}",
                        code,
                        stderr_text.trim()
                    ),
                    Err(error) => format!("等待 Python 签到进程失败：{error}"),
                };
                status.last_message = message.clone();
                drop(status);
                let _ = window.emit("attendance://event", event_payload("error", message, None));
            }
            *crate::APP.attendance_handle.write().await = None;
        });
        *self.attendance_handle.write().await = Some(handle);
        Ok(true)
    }

    pub async fn stop_attendance_watch(&self, window: Option<&Window>) {
        if let Some(task) = self.attendance_handle.write().await.take() {
            task.abort();
        }
        let mut status = self.attendance_status.write().await;
        status.running = false;
        status.last_message = "签到守望已停止，Python 子进程已关闭".to_owned();
        drop(status);
        if let Some(window) = window {
            let _ = window.emit(
                "attendance://event",
                event_payload("stopped", "签到守望已停止，Python 子进程已关闭", None),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_json_lines, python_candidates};

    #[test]
    fn python_candidates_keep_configured_interpreter_first() {
        let candidates = python_candidates("C:\\Python313\\python.exe");
        assert_eq!(candidates[0].program, "C:\\Python313\\python.exe");
        assert!(candidates
            .iter()
            .any(|candidate| candidate.program == "python"));
        assert!(candidates.iter().any(|candidate| candidate.program == "py"));
    }

    #[test]
    fn json_line_parser_ignores_non_protocol_output() {
        let values = parse_json_lines(
            b"diagnostic text\n{\"kind\":\"scan\",\"message\":\"ok\"}\ninvalid json\n",
        );
        assert_eq!(values.len(), 1);
        assert_eq!(values[0]["kind"], "scan");
    }
}

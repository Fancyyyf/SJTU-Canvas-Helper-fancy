use std::collections::BTreeMap;

use chrono::Utc;
use serde::Serialize;
use tauri::{Emitter, Window};

use crate::error::AppError;

use super::App;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthDomain {
    pub state: &'static str,
    pub detail: String,
    pub at: String,
    pub checked_at: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthTransition {
    pub domain: String,
    pub state: &'static str,
    pub detail: String,
    pub at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthReport {
    pub domains: BTreeMap<String, HealthDomain>,
    pub transitions: Vec<HealthTransition>,
}

fn classify_error(error: &AppError, login_hint: &str) -> (&'static str, String) {
    match error {
        AppError::Network(network)
            if network
                .status()
                .is_some_and(|status| status.as_u16() == 401 || status.as_u16() == 403) =>
        {
            ("fail", login_hint.to_owned())
        }
        AppError::LoginError => ("fail", login_hint.to_owned()),
        _ => (
            "unknown",
            "暂时无法检查，可能是网络或服务异常；请稍后重试".into(),
        ),
    }
}

fn update_domain(
    domains: &mut BTreeMap<String, HealthDomain>,
    name: &str,
    state: &'static str,
    detail: String,
    now: &str,
) -> Option<HealthTransition> {
    let changed = domains.get(name).is_none_or(|old| old.state != state);
    let at = if changed {
        now.to_owned()
    } else {
        domains[name].at.clone()
    };
    domains.insert(
        name.to_owned(),
        HealthDomain {
            state,
            detail: detail.clone(),
            at: at.clone(),
            checked_at: now.to_owned(),
        },
    );
    changed.then(|| HealthTransition {
        domain: name.to_owned(),
        state,
        detail,
        at,
    })
}

impl App {
    pub async fn check_service_health(
        &self,
        window: &Window,
        course_id: Option<i64>,
    ) -> HealthReport {
        let config = self.config.read().await.clone();
        let canvas = if config.token.trim().is_empty() {
            ("fail", "请在系统设置填写 Canvas Token".to_owned())
        } else {
            match self.client.test_credential(&config.token).await {
                Ok(_) => ("ok", "Canvas Token 可用".to_owned()),
                Err(error) => classify_error(&error, "Canvas Token 可能失效，请重新获取并测试"),
            }
        };
        let jaccount = if config.ja_auth_cookie.trim().is_empty() {
            ("fail", "请在系统设置完成额外扫码登录".to_owned())
        } else {
            match self
                .client
                .check_extra_login_status(&config.ja_auth_cookie)
                .await
            {
                Ok(true) => ("ok", "jAccount 登录态可用".to_owned()),
                Ok(false) => ("fail", "jAccount 登录态已失效，请重新扫码登录".to_owned()),
                Err(error) => classify_error(&error, "jAccount 登录态可能失效，请重新扫码登录"),
            }
        };
        let video = if jaccount.0 != "ok" {
            ("unknown", "请先确认 jAccount 登录状态".to_owned())
        } else {
            match self.check_extra_login_status().await {
                Ok(true) => ("ok", "视频登录链路可用".to_owned()),
                Ok(false) => ("fail", "视频登录链路失效，请在设置中重新登录".to_owned()),
                Err(error) => classify_error(&error, "视频登录链路可能失效，请在设置中重新登录"),
            }
        };
        let mlearning = match course_id {
            Some(id) if id > 0 && !config.ja_auth_cookie.trim().is_empty() => match self
                .read_course_attendance(window, id, "status", 1, 1)
                .await
            {
                Ok(value)
                    if value
                        .pointer("/data/resultCode")
                        .and_then(serde_json::Value::as_str)
                        == Some("200") =>
                {
                    ("ok", "mLearning 签到读取可用".to_owned())
                }
                Ok(_) => (
                    "unknown",
                    "mLearning 返回了未识别的业务状态，请查看查询结果".to_owned(),
                ),
                Err(AppError::AttendanceError(message))
                    if message.contains("登录态已失效") || message.contains("扫码登录") =>
                {
                    ("fail", "mLearning 登录态失效，请重新扫码登录".to_owned())
                }
                Err(_) => ("unknown", "mLearning 暂时无法检查，请稍后重试".to_owned()),
            },
            _ => (
                "unknown",
                "填写课程 ID 后可检查 mLearning；未执行签到操作".to_owned(),
            ),
        };
        let now = Utc::now().to_rfc3339();
        let mut domains = self.health.write().await;
        let mut transitions = Vec::new();
        for (name, (state, detail)) in [
            ("canvas", canvas),
            ("jaccount", jaccount),
            ("video", video),
            ("mlearning", mlearning),
        ] {
            if let Some(transition) = update_domain(&mut domains, name, state, detail, &now) {
                let _ = window.emit("service-health://transition", &transition);
                transitions.push(transition);
            }
        }
        HealthReport {
            domains: domains.clone(),
            transitions,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_state_keeps_transition_time() {
        let mut domains = BTreeMap::new();
        assert!(update_domain(&mut domains, "canvas", "fail", "expired".into(), "first").is_some());
        assert!(update_domain(
            &mut domains,
            "canvas",
            "fail",
            "still expired".into(),
            "second"
        )
        .is_none());
        assert_eq!(domains["canvas"].at, "first");
        assert_eq!(domains["canvas"].checked_at, "second");
        assert!(update_domain(&mut domains, "canvas", "ok", "restored".into(), "third").is_some());
    }
}

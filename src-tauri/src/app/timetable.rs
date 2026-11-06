use std::{sync::Arc, time::Duration};

use reqwest::{cookie::Jar, redirect::Policy};
use serde::{Deserialize, Serialize};
use tauri::Url;

use super::App;
use crate::error::{AppError, Result};

const ROOT: &str = "https://i.sjtu.edu.cn";
const LOGIN: &str = "https://i.sjtu.edu.cn/jaccountlogin";
const REFERER: &str = "https://i.sjtu.edu.cn/kbcx/xskbcx_cxXsgrkbIndex.html?gnmkdm=N2151";
const API: &str = "https://i.sjtu.edu.cn/kbcx/xskbcx_cxXsgrkb.html?gnmkdm=N2151";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimetableLesson {
    pub id: String,
    pub name: String,
    pub teacher: String,
    pub location: String,
    pub day: u8,
    pub periods: String,
    pub weeks: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimetableResult {
    pub year: i32,
    pub term: u8,
    pub lessons: Vec<TimetableLesson>,
    pub semester_start: Option<String>,
    pub fetched_at: String,
}

fn field(row: &serde_json::Value, name: &str) -> String {
    row.get(name).and_then(|value| value.as_str()).unwrap_or_default().trim().to_owned()
}

fn parse_lessons(value: &serde_json::Value) -> Result<Vec<TimetableLesson>> {
    let rows = value.get("kbList").and_then(|value| value.as_array())
        .ok_or_else(|| AppError::CalendarError("教学信息网返回了无法识别的课表数据".into()))?;
    if rows.len() > 2000 {
        return Err(AppError::CalendarError("教学信息网返回的课表条目过多，已停止导入".into()));
    }
    Ok(rows.iter().enumerate().filter_map(|(index, row)| {
        let day = row.get("xqj").and_then(|value| value.as_u64()
            .or_else(|| value.as_str().and_then(|text| text.parse::<u64>().ok())))
            .and_then(|value| u8::try_from(value).ok())?;
        if !(1..=7).contains(&day) { return None; }
        let name = field(row, "kcmc");
        if name.is_empty() { return None; }
        let periods = field(row, "jcs");
        let periods = if periods.is_empty() { field(row, "jc") } else { periods };
        Some(TimetableLesson {
            id: format!("{}:{}:{}:{}", field(row, "jxb_id"), day, periods, index),
            name,
            teacher: field(row, "xm"),
            location: field(row, "cdmc"),
            day,
            periods,
            weeks: field(row, "zcd"),
        })
    }).collect())
}

fn semester_start(value: &serde_json::Value) -> Option<String> {
    let pattern = regex::Regex::new(r"20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}").ok()?;
    let mut dates = value.get("rqazcList")?.as_array()?.iter()
        .filter_map(|item| serde_json::to_string(item).ok())
        .flat_map(|text| pattern.find_iter(&text).map(|match_| match_.as_str().replace('/', "-").replace('.', "-")).collect::<Vec<_>>())
        .filter_map(|text| chrono::NaiveDate::parse_from_str(&text, "%Y-%m-%d").ok())
        .collect::<Vec<_>>();
    dates.sort_unstable();
    dates.first().map(ToString::to_string)
}

impl App {
    pub async fn fetch_timetable(&self, year: i32, term: u8) -> Result<TimetableResult> {
        if !(2000..=2100).contains(&year) || ![3, 12, 16].contains(&term) {
            return Err(AppError::CalendarError("无效的学年或学期".into()));
        }
        let cookie = self.config.read().await.ja_auth_cookie.clone();
        if cookie.trim().is_empty() {
            return Err(AppError::CalendarError("请先在设置中登录 jAccount，课表需要校园网页登录态".into()));
        }
        let jar = Arc::new(Jar::default());
        for host in ["https://jaccount.sjtu.edu.cn", "https://my.sjtu.edu.cn", ROOT] {
            jar.add_cookie_str(&format!("JAAuthCookie={cookie}"), &Url::parse(host).unwrap());
        }
        let client = reqwest::Client::builder()
            .cookie_provider(jar)
            .redirect(Policy::limited(12))
            .timeout(Duration::from_secs(20))
            .build()?;
        let login = client.get(LOGIN).send().await?;
        if !login.status().is_success() || login.url().host_str() != Some("i.sjtu.edu.cn") {
            return Err(AppError::CalendarError("教学信息网登录态已失效，请在设置中重新登录 jAccount".into()));
        }
        let response = client.post(API)
            .header("X-Requested-With", "XMLHttpRequest")
            .header("Referer", REFERER)
            .form(&[("xnm", year.to_string()), ("xqm", term.to_string()),
                ("kzlx", "ck".to_owned()), ("xsdm", String::new())])
            .send().await?;
        if !response.status().is_success() || response.url().host_str() != Some("i.sjtu.edu.cn") {
            return Err(AppError::CalendarError("课表请求失败，请检查教学信息网登录态".into()));
        }
        let body = response.bytes().await?;
        if body.len() > 2_000_000 {
            return Err(AppError::CalendarError("教学信息网返回的课表数据过大，已停止导入".into()));
        }
        let value: serde_json::Value = serde_json::from_slice(&body).map_err(|_| {
            AppError::CalendarError("课表接口未返回 JSON，可能需要重新登录 jAccount".into())
        })?;
        Ok(TimetableResult { year, term, lessons: parse_lessons(&value)?, semester_start: semester_start(&value),
            fetched_at: chrono::Utc::now().to_rfc3339() })
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_lessons, semester_start};

    #[test]
    fn parses_timetable_rows_and_ignores_invalid_days() {
        let value = serde_json::json!({"kbList": [
            {"kcmc":"Math","xqj":"1","jcs":"1-2","zcd":"1-16周","cdmc":"A101","xm":"Teacher"},
            {"kcmc":"Bad","xqj":9},
            {"kcmc":"Wrapped","xqj":257}
        ]});
        let lessons = parse_lessons(&value).unwrap();
        assert_eq!(lessons.len(), 1);
        assert_eq!(lessons[0].periods, "1-2");
        assert_eq!(semester_start(&serde_json::json!({"rqazcList":[{"rq":"2026-09-07"},{"rq":"2026-09-14"}]})),
            Some("2026-09-07".to_owned()));
    }
}

use std::{fs, path::PathBuf, sync::Mutex};

use chrono::DateTime;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{
    app::App,
    error::{AppError, Result},
    model::Account,
};

static STORE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PersonalEvent {
    pub id: String,
    pub title: String,
    pub start_at: String,
    pub end_at: String,
    pub all_day: bool,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_key: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventDraft {
    pub title: String,
    pub start_at: String,
    pub end_at: String,
    pub all_day: bool,
    #[serde(default)]
    pub description: String,
    pub source_key: Option<String>,
}

fn invalid(message: &str) -> AppError {
    AppError::CalendarError(message.to_owned())
}

fn validate(draft: &EventDraft) -> Result<()> {
    if draft.title.trim().is_empty() {
        return Err(invalid("日程名称不能为空"));
    }
    if draft.title.chars().count() > 200 {
        return Err(invalid("日程名称不能超过 200 字"));
    }
    if draft.description.chars().count() > 10_000 {
        return Err(invalid("日程描述不能超过 10000 字"));
    }
    let start = DateTime::parse_from_rfc3339(&draft.start_at)
        .map_err(|_| invalid("开始时间必须是带时区的 ISO 8601 时间"))?;
    let end = DateTime::parse_from_rfc3339(&draft.end_at)
        .map_err(|_| invalid("结束时间必须是带时区的 ISO 8601 时间"))?;
    if end <= start {
        return Err(invalid("结束时间必须晚于开始时间"));
    }
    Ok(())
}

fn path(account: &Account) -> Result<PathBuf> {
    let identity = match account {
        Account::Default => "default:".to_owned(),
        Account::Custom(name) => format!("custom:{name}"),
    };
    let hash = format!("{:x}", Sha256::digest(identity.as_bytes()));
    Ok(PathBuf::from(App::config_dir()?)
        .join("personal_calendar")
        .join(format!("{hash}.json")))
}

fn read(path: &PathBuf) -> Result<Vec<PersonalEvent>> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    Ok(serde_json::from_slice(&fs::read(path)?)?)
}

fn write(path: &PathBuf, events: &[PersonalEvent]) -> Result<()> {
    fs::create_dir_all(path.parent().ok_or_else(|| invalid("日程存储路径无效"))?)?;
    fs::write(path, serde_json::to_vec(events)?)?;
    Ok(())
}

fn with_store<T>(
    account: &Account,
    operation: impl FnOnce(&PathBuf, &mut Vec<PersonalEvent>) -> Result<T>,
) -> Result<T> {
    with_store_path(path(account)?, operation)
}

fn with_store_path<T>(
    path: PathBuf,
    operation: impl FnOnce(&PathBuf, &mut Vec<PersonalEvent>) -> Result<T>,
) -> Result<T> {
    let _guard = STORE_LOCK.lock().map_err(|_| AppError::MutexError)?;
    let mut events = read(&path)?;
    operation(&path, &mut events)
}

pub fn list(account: &Account) -> Result<Vec<PersonalEvent>> {
    with_store(account, |_, events| Ok(events.clone()))
}

pub fn import_legacy(account: &Account, events: Vec<PersonalEvent>) -> Result<Vec<PersonalEvent>> {
    with_store(account, |path, current| {
        if !path.exists() {
            for event in &events {
                validate(&EventDraft {
                    title: event.title.clone(),
                    start_at: event.start_at.clone(),
                    end_at: event.end_at.clone(),
                    all_day: event.all_day,
                    description: event.description.clone(),
                    source_key: event.source_key.clone(),
                })?;
            }
            *current = events;
            write(path, current)?;
        }
        Ok(current.clone())
    })
}

pub fn create(account: &Account, draft: EventDraft) -> Result<PersonalEvent> {
    create_at(path(account)?, draft)
}

fn create_at(path: PathBuf, draft: EventDraft) -> Result<PersonalEvent> {
    validate(&draft)?;
    with_store_path(path, |path, events| {
        let event = PersonalEvent {
            id: Uuid::new_v4().to_string(),
            title: draft.title.trim().to_owned(),
            start_at: draft.start_at,
            end_at: draft.end_at,
            all_day: draft.all_day,
            description: draft.description,
            source_key: draft.source_key,
        };
        events.push(event.clone());
        write(path, events)?;
        Ok(event)
    })
}

pub fn update(account: &Account, id: &str, draft: EventDraft) -> Result<PersonalEvent> {
    update_at(path(account)?, id, draft)
}

fn update_at(path: PathBuf, id: &str, draft: EventDraft) -> Result<PersonalEvent> {
    validate(&draft)?;
    with_store_path(path, |path, events| {
        let event = events
            .iter_mut()
            .find(|event| event.id == id)
            .ok_or_else(|| invalid("找不到该个人日程"))?;
        event.title = draft.title.trim().to_owned();
        event.start_at = draft.start_at;
        event.end_at = draft.end_at;
        event.all_day = draft.all_day;
        event.description = draft.description;
        // Preserve import identity when editing an imported event.
        let updated = event.clone();
        write(path, events)?;
        Ok(updated)
    })
}

pub fn delete(account: &Account, id: &str) -> Result<PersonalEvent> {
    delete_at(path(account)?, id)
}

fn delete_at(path: PathBuf, id: &str) -> Result<PersonalEvent> {
    with_store_path(path, |path, events| {
        let index = events
            .iter()
            .position(|event| event.id == id)
            .ok_or_else(|| invalid("找不到该个人日程"))?;
        let removed = events.remove(index);
        write(path, events)?;
        Ok(removed)
    })
}

pub fn replace_if_unchanged(
    account: &Account,
    previous: Vec<PersonalEvent>,
    events: Vec<PersonalEvent>,
) -> Result<()> {
    replace_if_unchanged_at(path(account)?, previous, events)
}

fn replace_if_unchanged_at(
    path: PathBuf,
    previous: Vec<PersonalEvent>,
    events: Vec<PersonalEvent>,
) -> Result<()> {
    for event in &events {
        validate(&EventDraft {
            title: event.title.clone(),
            start_at: event.start_at.clone(),
            end_at: event.end_at.clone(),
            all_day: event.all_day,
            description: event.description.clone(),
            source_key: event.source_key.clone(),
        })?;
    }
    with_store_path(path, |path, current| {
        if *current != previous {
            return Err(invalid("日程已在其他页面更新，请重新打开日历后重试"));
        }
        *current = events;
        write(path, current)
    })
}

pub fn current_account() -> Result<Account> {
    Ok(App::read_account_info()?.current_account)
}

pub fn checked_account(name: &str) -> Result<Account> {
    let account = current_account()?;
    let current_name = match &account {
        Account::Default => "Default",
        Account::Custom(name) => name,
    };
    if current_name != name {
        return Err(invalid("账号已切换，请重新打开日程"));
    }
    Ok(account)
}

pub fn ensure_current(account: &Account) -> Result<()> {
    if &current_account()? != account {
        return Err(invalid("账号已切换，请重新提问"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn draft() -> EventDraft {
        EventDraft {
            title: "讨论".into(),
            start_at: "2026-10-29T10:00:00+08:00".into(),
            end_at: "2026-10-29T11:00:00+08:00".into(),
            all_day: false,
            description: String::new(),
            source_key: None,
        }
    }

    #[test]
    fn validates_calendar_times_and_account_paths() {
        assert!(validate(&draft()).is_ok());
        assert!(validate(&EventDraft {
            end_at: draft().start_at,
            ..draft()
        })
        .is_err());
        assert!(validate(&EventDraft {
            start_at: "2026-10-29".into(),
            ..draft()
        })
        .is_err());
        assert_ne!(
            path(&Account::Default).unwrap(),
            path(&Account::Custom("default".into())).unwrap()
        );
        assert_ne!(
            path(&Account::Custom("alice".into())).unwrap(),
            path(&Account::Custom("bob".into())).unwrap()
        );
    }

    #[test]
    fn creates_updates_deletes_and_rejects_stale_ui_writes() {
        let folder =
            std::env::temp_dir().join(format!("canvas-agent-calendar-test-{}", Uuid::new_v4()));
        let file = folder.join("events.json");
        let event = create_at(
            file.clone(),
            EventDraft {
                source_key: Some("ics:1".into()),
                ..draft()
            },
        )
        .unwrap();
        assert_eq!(read(&file).unwrap(), vec![event.clone()]);
        let updated = update_at(
            file.clone(),
            &event.id,
            EventDraft {
                title: "新标题".into(),
                ..draft()
            },
        )
        .unwrap();
        assert_eq!(updated.title, "新标题");
        assert_eq!(updated.source_key.as_deref(), Some("ics:1"));
        assert!(replace_if_unchanged_at(file.clone(), vec![event], vec![]).is_err());
        assert_eq!(read(&file).unwrap(), vec![updated.clone()]);
        assert!(update_at(
            file.clone(),
            &updated.id,
            EventDraft {
                end_at: draft().start_at,
                ..draft()
            }
        )
        .is_err());
        assert_eq!(delete_at(file.clone(), &updated.id).unwrap(), updated);
        assert!(read(&file).unwrap().is_empty());
        fs::remove_file(file).unwrap();
        fs::remove_dir(folder).unwrap();
    }
}

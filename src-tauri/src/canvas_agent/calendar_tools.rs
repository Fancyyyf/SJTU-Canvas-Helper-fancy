use chrono::{DateTime, FixedOffset};
use rig::{
    completion::ToolDefinition,
    tool::{Tool, ToolDyn},
};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{
    error::AppError,
    model::Account,
    personal_calendar::{self, EventDraft, PersonalEvent},
};

use super::CanvasAgentToolError;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedAssignment {
    pub id: i64,
    pub course_id: i64,
    pub course_name: String,
    pub title: String,
    pub due_at: String,
    pub html_url: String,
    pub published: bool,
    pub submission_types: Vec<String>,
    pub submitted_at: Option<String>,
    pub submission_state: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasCalendarSnapshot {
    pub updated_at: String,
    pub assignments: Vec<CachedAssignment>,
}

#[derive(Deserialize)]
struct DateRangeArgs {
    start_at: String,
    end_at: String,
}

fn range(
    start: &str,
    end: &str,
) -> Result<(DateTime<FixedOffset>, DateTime<FixedOffset>), CanvasAgentToolError> {
    let start = DateTime::parse_from_rfc3339(start)
        .map_err(|_| AppError::CalendarError("start_at 必须是带时区的 ISO 8601 时间".into()))?;
    let end = DateTime::parse_from_rfc3339(end)
        .map_err(|_| AppError::CalendarError("end_at 必须是带时区的 ISO 8601 时间".into()))?;
    if end <= start || (end - start).num_days() > 366 {
        return Err(AppError::CalendarError("查询范围必须大于零且不超过 366 天".into()).into());
    }
    Ok((start, end))
}

#[derive(Serialize)]
pub struct CalendarItems {
    pub personal_events: Vec<PersonalEvent>,
    pub canvas_assignments: Vec<CachedAssignment>,
    pub canvas_cached_at: Option<String>,
    pub truncated: bool,
}

fn list_items(
    account: &Account,
    snapshot: Option<&CanvasCalendarSnapshot>,
    start_at: &str,
    end_at: &str,
) -> Result<CalendarItems, CanvasAgentToolError> {
    personal_calendar::ensure_current(account)?;
    let (start, end) = range(start_at, end_at)?;
    let mut personal_events = personal_calendar::list(account)?
        .into_iter()
        .filter(|item| {
            let Ok(item_start) = DateTime::parse_from_rfc3339(&item.start_at) else {
                return false;
            };
            let Ok(item_end) = DateTime::parse_from_rfc3339(&item.end_at) else {
                return false;
            };
            item_end > start && item_start < end
        })
        .collect::<Vec<_>>();
    let mut canvas_assignments = snapshot
        .into_iter()
        .flat_map(|snapshot| snapshot.assignments.iter())
        .filter(|item| {
            DateTime::parse_from_rfc3339(&item.due_at).is_ok_and(|due| due >= start && due < end)
        })
        .cloned()
        .collect::<Vec<_>>();
    personal_events.sort_by(|a, b| a.start_at.cmp(&b.start_at));
    canvas_assignments.sort_by(|a, b| a.due_at.cmp(&b.due_at));
    let truncated = personal_events.len() > 200 || canvas_assignments.len() > 200;
    personal_events.truncate(200);
    canvas_assignments.truncate(200);
    Ok(CalendarItems {
        personal_events,
        canvas_assignments,
        canvas_cached_at: snapshot.map(|s| s.updated_at.clone()),
        truncated,
    })
}

#[derive(Clone, Serialize)]
struct ListCalendarItemsTool {
    account: Account,
    snapshot: Option<CanvasCalendarSnapshot>,
}

impl Tool for ListCalendarItemsTool {
    const NAME: &'static str = "list_local_calendar_items";
    type Error = CanvasAgentToolError;
    type Args = DateRangeArgs;
    type Output = CalendarItems;
    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition { name: Self::NAME.into(), description: "Read this account's local personal events and cached Canvas assignment due dates, including submission status. Use this for calendar questions. The end is exclusive; maximum range 366 days. If canvas_cached_at is null, the Canvas cache is unavailable. Never infer missing items.".into(), parameters: json!({"type":"object","properties":{"start_at":{"type":"string","description":"Range start, RFC3339 with timezone, e.g. 2026-10-27T00:00:00+08:00"},"end_at":{"type":"string","description":"Exclusive range end, RFC3339 with timezone"}},"required":["start_at","end_at"]}) }
    }
    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        list_items(
            &self.account,
            self.snapshot.as_ref(),
            &args.start_at,
            &args.end_at,
        )
    }
}

#[derive(Deserialize)]
struct CreateArgs {
    title: String,
    start_at: String,
    end_at: String,
    all_day: bool,
    #[serde(default)]
    description: String,
}

#[derive(Clone, Serialize)]
struct CreatePersonalEventTool {
    account: Account,
}

impl Tool for CreatePersonalEventTool {
    const NAME: &'static str = "create_personal_event";
    type Error = CanvasAgentToolError;
    type Args = CreateArgs;
    type Output = PersonalEvent;
    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition { name: Self::NAME.into(), description: "Create one local personal calendar event only when the user explicitly asks to create or schedule it. Times must include a timezone. For all-day events, end_at is exclusive midnight of the following day. Do not create Canvas assignments.".into(), parameters: event_schema(false) }
    }
    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        personal_calendar::ensure_current(&self.account)?;
        Ok(personal_calendar::create(
            &self.account,
            EventDraft {
                title: args.title,
                start_at: args.start_at,
                end_at: args.end_at,
                all_day: args.all_day,
                description: args.description,
                source_key: None,
            },
        )?)
    }
}

fn event_schema(with_id: bool) -> serde_json::Value {
    let mut properties = json!({"title":{"type":"string"},"start_at":{"type":"string","description":"RFC3339 time with timezone"},"end_at":{"type":"string","description":"Exclusive end time, RFC3339 with timezone"},"all_day":{"type":"boolean"},"description":{"type":"string"}});
    let mut required = vec!["title", "start_at", "end_at", "all_day"];
    if with_id {
        properties["id"] = json!({"type":"string","description":"Exact local personal event id returned by list_local_calendar_items"});
        required.push("id");
    }
    json!({"type":"object","properties":properties,"required":required})
}

#[derive(Deserialize)]
struct UpdateArgs {
    id: String,
    title: String,
    start_at: String,
    end_at: String,
    all_day: bool,
    #[serde(default)]
    description: String,
}

#[derive(Clone, Serialize)]
struct UpdatePersonalEventTool {
    account: Account,
}

impl Tool for UpdatePersonalEventTool {
    const NAME: &'static str = "update_personal_event";
    type Error = CanvasAgentToolError;
    type Args = UpdateArgs;
    type Output = PersonalEvent;
    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition { name: Self::NAME.into(), description: "Update one local personal event only when explicitly requested. Obtain its exact id from list_local_calendar_items first. Supply the complete final event, preserving fields the user did not ask to change. Never update Canvas assignments.".into(), parameters: event_schema(true) }
    }
    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        personal_calendar::ensure_current(&self.account)?;
        Ok(personal_calendar::update(
            &self.account,
            &args.id,
            EventDraft {
                title: args.title,
                start_at: args.start_at,
                end_at: args.end_at,
                all_day: args.all_day,
                description: args.description,
                source_key: None,
            },
        )?)
    }
}

#[derive(Deserialize)]
struct DeleteArgs {
    id: String,
}

#[derive(Clone, Serialize)]
struct DeletePersonalEventTool {
    account: Account,
}

impl Tool for DeletePersonalEventTool {
    const NAME: &'static str = "delete_personal_event";
    type Error = CanvasAgentToolError;
    type Args = DeleteArgs;
    type Output = PersonalEvent;
    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition { name: Self::NAME.into(), description: "Delete one local personal event only when the user explicitly asks to delete it. First look up its exact id with list_local_calendar_items. Never delete Canvas assignments.".into(), parameters: json!({"type":"object","properties":{"id":{"type":"string","description":"Exact local personal event id"}},"required":["id"]}) }
    }
    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        personal_calendar::ensure_current(&self.account)?;
        Ok(personal_calendar::delete(&self.account, &args.id)?)
    }
}

pub(super) fn tools(
    account: Account,
    snapshot: Option<CanvasCalendarSnapshot>,
) -> Vec<Box<dyn ToolDyn>> {
    vec![
        Box::new(ListCalendarItemsTool {
            account: account.clone(),
            snapshot,
        }),
        Box::new(CreatePersonalEventTool {
            account: account.clone(),
        }),
        Box::new(UpdatePersonalEventTool {
            account: account.clone(),
        }),
        Box::new(DeletePersonalEventTool { account }),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn range_rejects_unbounded_or_invalid_queries() {
        assert!(range("2026-10-27", "2026-10-28").is_err());
        assert!(range("2026-10-27T00:00:00+08:00", "2026-10-27T00:00:00+08:00").is_err());
        assert!(range("2026-10-27T00:00:00+08:00", "2028-10-27T00:00:00+08:00").is_err());
    }
}

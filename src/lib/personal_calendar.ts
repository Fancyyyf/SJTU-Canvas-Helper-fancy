import ICAL from "ical.js";
import { invoke } from "@tauri-apps/api/core";

export interface PersonalEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  description: string;
  sourceKey?: string;
}

export type PersonalEventDraft = Omit<PersonalEvent, "id">;

export function personalEventsKey(account: string) {
  return `canvas-helper.personal-events.v1.${encodeURIComponent(account)}`;
}

export function readPersonalEvents(account: string): PersonalEvent[] {
  const raw = localStorage.getItem(personalEventsKey(account));
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error("本地日程数据格式无效");
  const valid = value.every((item): item is PersonalEvent =>
    typeof item?.id === "string" && typeof item.title === "string" &&
    typeof item.startAt === "string" && typeof item.endAt === "string" &&
    typeof item.allDay === "boolean" && typeof item.description === "string" &&
    Number.isFinite(Date.parse(item.startAt)) && Number.isFinite(Date.parse(item.endAt))
  );
  if (!valid) throw new Error("本地日程数据格式无效");
  return value as PersonalEvent[];
}

export function savePersonalEvents(account: string, events: PersonalEvent[]) {
  localStorage.setItem(personalEventsKey(account), JSON.stringify(events));
}

/** Migrate the old localStorage calendar once; native storage is shared with Agent tools. */
export async function loadPersonalEvents(account: string): Promise<PersonalEvent[]> {
  const key = personalEventsKey(account);
  const legacy = localStorage.getItem(key);
  if (legacy !== null) {
    const events = readPersonalEvents(account);
    const migrated = await invoke<PersonalEvent[]>("import_legacy_personal_events", { account, events });
    localStorage.removeItem(key);
    return migrated;
  }
  return invoke<PersonalEvent[]>("list_personal_events", { account });
}

export async function persistPersonalEvents(account: string, previousEvents: PersonalEvent[], events: PersonalEvent[]): Promise<void> {
  await invoke("replace_personal_events", { account, previousEvents, events });
}

export function createPersonalEvent(draft: PersonalEventDraft): PersonalEvent {
  return { ...draft, id: crypto.randomUUID() };
}

export function validatePersonalEvent(draft: PersonalEventDraft): string | null {
  if (!draft.title.trim()) return "请填写日程名称";
  const start = Date.parse(draft.startAt);
  const end = Date.parse(draft.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "请填写有效的开始与结束时间";
  if (end <= start) return "结束时间必须晚于开始时间";
  return null;
}

export function mergeImportedEvents(existing: PersonalEvent[], imported: PersonalEventDraft[]) {
  const keys = new Set(existing.map((event) => event.sourceKey).filter(Boolean));
  const added: PersonalEvent[] = [];
  let skipped = 0;
  for (const draft of imported) {
    if (draft.sourceKey && keys.has(draft.sourceKey)) {
      skipped++;
      continue;
    }
    if (draft.sourceKey) keys.add(draft.sourceKey);
    added.push(createPersonalEvent(draft));
  }
  return { events: [...existing, ...added], added, skipped };
}

export function parseIcsEvents(content: string): { events: PersonalEventDraft[]; warnings: string[] } {
  if (new Blob([content]).size > 2_000_000) throw new Error("ICS 文件不能超过 2 MB");
  if (!/BEGIN:VCALENDAR/i.test(content)) throw new Error("文件不是有效的 ICS 日历");
  const calendar = new ICAL.Component(ICAL.parse(content));
  const components = calendar.getAllSubcomponents("vevent");
  if (!components.length) throw new Error("ICS 文件中没有日程事件");
  const events: PersonalEventDraft[] = [];
  const warnings: string[] = [];
  const horizon = new Date();
  horizon.setFullYear(horizon.getFullYear() + 2);

  for (const component of components) {
    // Recurrence exceptions are resolved through the parent event.
    if (component.hasProperty("recurrence-id")) continue;
    const event = new ICAL.Event(component);
    const uid = String(component.getFirstPropertyValue("uid") ?? "");
    const title = event.summary?.trim();
    if (!title || !event.startDate) {
      warnings.push("跳过缺少名称或开始时间的事件");
      continue;
    }
    if (String(component.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED") continue;
    const append = (start: ICAL.Time, end: ICAL.Time, occurrenceKey: string, item = event) => {
      const startAt = start.toJSDate().toISOString();
      const endAt = end.toJSDate().toISOString();
      const itemTitle = item.summary?.trim() || title;
      const draft: PersonalEventDraft = {
        title: itemTitle, startAt, endAt, allDay: start.isDate,
        description: [item.location, item.description].filter(Boolean).join("\n"),
        sourceKey: uid ? `ics:${uid}:${occurrenceKey}` : `ics:auto:${itemTitle}:${startAt}:${endAt}`,
      };
      if (validatePersonalEvent(draft)) {
        warnings.push(`跳过时间无效的事件：${title}`);
        return;
      }
      events.push(draft);
    };
    if (!event.isRecurring()) {
      append(event.startDate, event.endDate, event.startDate.toString());
      continue;
    }
    const iterator = event.iterator();
    let count = 0;
    let occurrence = iterator.next();
    while (occurrence && count < 1000 && events.length < 5000) {
      count++;
      const details = event.getOccurrenceDetails(occurrence);
      if (details.startDate.toJSDate() > horizon) {
        warnings.push(`${title}：重复日程只导入未来两年内的日期`);
        break;
      }
      if (String(details.item.component.getFirstPropertyValue("status") ?? "").toUpperCase() !== "CANCELLED") {
        append(details.startDate, details.endDate, occurrence.toString(), details.item);
      }
      occurrence = iterator.next();
    }
    if (occurrence && count >= 1000) warnings.push(`${title}：最多导入 1000 次重复日程`);
    if (events.length >= 5000) {
      warnings.push("最多导入 5000 条日程");
      break;
    }
  }
  return { events, warnings };
}

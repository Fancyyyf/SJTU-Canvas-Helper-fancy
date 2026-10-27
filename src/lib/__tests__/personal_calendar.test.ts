import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPersonalEvent, loadPersonalEvents, mergeImportedEvents, parseIcsEvents, personalEventsKey, readPersonalEvents, savePersonalEvents, validatePersonalEvent } from "../personal_calendar";

const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));

beforeEach(() => { localStorage.clear(); native.invoke.mockReset(); });

describe("personal calendar", () => {
  it("migrates localStorage once and keeps it if native storage rejects the import", async () => {
    const event = createPersonalEvent({ title: "讨论", startAt: "2026-10-29T02:00:00Z", endAt: "2026-10-29T03:00:00Z", allDay: false, description: "" });
    savePersonalEvents("alice", [event]);
    native.invoke.mockRejectedValueOnce(new Error("disk full"));
    await expect(loadPersonalEvents("alice")).rejects.toThrow("disk full");
    expect(readPersonalEvents("alice")).toEqual([event]);
    native.invoke.mockResolvedValueOnce([event]);
    expect(await loadPersonalEvents("alice")).toEqual([event]);
    expect(localStorage.getItem(personalEventsKey("alice"))).toBeNull();
    expect(native.invoke).toHaveBeenLastCalledWith("import_legacy_personal_events", { account: "alice", events: [event] });
  });

  it("stores events by account and preserves edits", () => {
    const event = createPersonalEvent({ title: "讨论", startAt: "2026-10-29T02:00:00Z", endAt: "2026-10-29T03:00:00Z", allDay: false, description: "地点 A" });
    savePersonalEvents("alice", [event]);
    expect(readPersonalEvents("alice")).toEqual([event]);
    expect(readPersonalEvents("bob")).toEqual([]);
    expect(validatePersonalEvent({ ...event, endAt: event.startAt })).toBe("结束时间必须晚于开始时间");
    localStorage.setItem(personalEventsKey("alice"), JSON.stringify([{ id: "broken" }]));
    expect(() => readPersonalEvents("alice")).toThrow("本地日程数据格式无效");
  });

  it("imports weekly ICS occurrences and skips them on a repeated import", () => {
    const content = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:course-1",
      "SUMMARY:算法课", "DTSTART:20261028T090000Z", "DTEND:20261028T100000Z",
      "RRULE:FREQ=WEEKLY;COUNT=3", "DESCRIPTION:第一教室", "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const parsed = parseIcsEvents(content);
    expect(parsed.events).toHaveLength(3);
    expect(parsed.events[0].description).toBe("第一教室");
    expect(parsed.events[1].startAt).toBe("2026-11-04T09:00:00.000Z");
    const first = mergeImportedEvents([], parsed.events);
    expect(first.added).toHaveLength(3);
    const second = mergeImportedEvents(first.events, parsed.events);
    expect(second.added).toHaveLength(0);
    expect(second.skipped).toBe(3);
  });

  it("uses an exclusive end for ICS all-day events", () => {
    const content = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:day-1", "SUMMARY:假期", "DTSTART;VALUE=DATE:20261101", "DTEND;VALUE=DATE:20261102", "END:VEVENT", "END:VCALENDAR"].join("\n");
    const event = parseIcsEvents(content).events[0];
    expect(event.allDay).toBe(true);
    expect(Date.parse(event.endAt) - Date.parse(event.startAt)).toBe(24 * 60 * 60 * 1000);
  });

  it("applies a recurrence exception and deduplicates events without a UID", () => {
    const content = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:series-1", "SUMMARY:每周例会",
      "DTSTART:20261028T090000Z", "DTEND:20261028T100000Z", "RRULE:FREQ=WEEKLY;COUNT=2",
      "END:VEVENT", "BEGIN:VEVENT", "UID:series-1", "RECURRENCE-ID:20261104T090000Z",
      "SUMMARY:改期例会", "DTSTART:20261104T110000Z", "DTEND:20261104T120000Z", "END:VEVENT",
      "BEGIN:VEVENT", "SUMMARY:无编号", "DTSTART:20261101T090000Z", "DTEND:20261101T100000Z", "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const parsed = parseIcsEvents(content);
    expect(parsed.events).toHaveLength(3);
    expect(parsed.events.find((event) => event.title === "改期例会")?.startAt).toBe("2026-11-04T11:00:00.000Z");
    const first = mergeImportedEvents([], parsed.events);
    expect(mergeImportedEvents(first.events, parsed.events).skipped).toBe(3);
  });

  it("keeps a named timezone's local time", () => {
    const content = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VTIMEZONE", "TZID:Asia/Shanghai",
      "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:+0800", "TZOFFSETTO:+0800",
      "TZNAME:CST", "END:STANDARD", "END:VTIMEZONE", "BEGIN:VEVENT", "UID:tz-1",
      "SUMMARY:上海会议", "DTSTART;TZID=Asia/Shanghai:20261101T090000",
      "DTEND;TZID=Asia/Shanghai:20261101T100000", "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    expect(parseIcsEvents(content).events[0].startAt).toBe("2026-11-01T01:00:00.000Z");
  });
});

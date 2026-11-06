import { beforeEach, describe, expect, it } from "vitest";
import dayjs from "dayjs";
import {
  beginTimetableCheck, currentTimetableTerm, effectiveFirstWeekMonday, failTimetableCheck,
  finishTimetableCheck, listTimetableRecords, officialFirstWeekMonday, readTimetableRecord, sameTimetable, setFirstWeekMonday,
} from "../timetable_store";
import type { TimetableResult } from "../timetable";
import { readPersonalEvents, savePersonalEvents } from "../personal_calendar";

const account = "user@example.com";
const result = (name = "高等数学", fetchedAt = "2026-09-02T10:00:00Z"): TimetableResult => ({
  year: 2026, term: 3, semesterStart: "2026-09-07", fetchedAt,
  lessons: [{ id: "row-1", name, teacher: "教师", location: "教室", day: 1, periods: "1-2", weeks: "1-16周" }],
});

beforeEach(() => localStorage.clear());

describe("formal timetable local cache", () => {
  it("records import, unchanged check, update, and failed attempt without losing lessons", () => {
    beginTimetableCheck(account, 2026, 3, "2026-09-02T09:00:00Z");
    expect(readTimetableRecord(account, 2026, 3).lastStatus).toBe("checking");
    const imported = finishTimetableCheck(account, 2026, 3, result(), "2026-09-02T10:00:00Z");
    expect(imported.lastStatus).toBe("imported");
    const same = finishTimetableCheck(account, 2026, 3, result("高等数学", "2026-09-03T10:00:00Z"), "2026-09-03T10:00:00Z");
    expect(same.lastStatus).toBe("unchanged");
    expect(same.result?.fetchedAt).toBe("2026-09-02T10:00:00Z");
    const updated = finishTimetableCheck(account, 2026, 3, result("线性代数"), "2026-09-04T10:00:00Z");
    expect(updated.lastStatus).toBe("updated");
    const failed = failTimetableCheck(account, 2026, 3, "登录态失效", "2026-09-05T10:00:00Z");
    expect(failed.lastStatus).toBe("failed");
    expect(failed.result?.lessons[0].name).toBe("线性代数");
    expect(failed.lastAttemptAt).toBe("2026-09-05T10:00:00Z");
    expect(failed.lastCheckedAt).toBe("2026-09-04T10:00:00Z");
  });

  it("compares semester content without treating timestamps or row order as changes", () => {
    const first = result();
    const second = result("高等数学", "2026-09-03T10:00:00Z");
    second.lessons[0].id = "different-row-index";
    second.semesterStart = "2026-09-14";
    expect(sameTimetable(first, second)).toBe(true);
    second.lessons[0].location = "另一教室";
    expect(sameTimetable(first, second)).toBe(false);
  });

  it("migrates legacy cached lessons and the week start for the same account", () => {
    localStorage.setItem("canvas-helper.timetable.v1.user%40example.com.2026.3", JSON.stringify(result()));
    localStorage.setItem("canvas-helper.timetable.v1.user%40example.com.2026.3.start", "2026-09-14");
    const record = readTimetableRecord(account, 2026, 3);
    expect(record.result?.lessons).toHaveLength(1);
    expect(effectiveFirstWeekMonday(record)).toBe("2026-09-14");
    expect(listTimetableRecords("other")).toEqual([]);
    expect(listTimetableRecords(account)).toHaveLength(1);
  });

  it("keeps first-week overrides separate from fetched data", () => {
    finishTimetableCheck(account, 2026, 3, result(), "2026-09-02T10:00:00Z");
    expect(officialFirstWeekMonday(2026, 3)).toBe("2026-09-14");
    expect(effectiveFirstWeekMonday(readTimetableRecord(account, 2026, 3))).toBe("2026-09-14");
    const changed = setFirstWeekMonday(account, 2026, 3, "2026-09-14");
    expect(effectiveFirstWeekMonday(changed)).toBe("2026-09-14");
    expect(changed.result?.semesterStart).toBe("2026-09-07");
    expect(() => setFirstWeekMonday(account, 2026, 3, "2026-09-15")).toThrow();
  });

  it("requires a saved first Monday for terms without a bundled calendar reference", () => {
    expect(officialFirstWeekMonday(2027, 3)).toBeNull();
    expect(effectiveFirstWeekMonday(readTimetableRecord(account, 2027, 3))).toBeNull();
    setFirstWeekMonday(account, 2027, 3, "2027-09-13");
    expect(effectiveFirstWeekMonday(readTimetableRecord(account, 2027, 3))).toBe("2027-09-13");
  });

  it("does not change the time or content of existing personal events", () => {
    const events = [{ id: "event-1", title: "复习", startAt: "2026-09-07T12:30:00.000Z",
      endAt: "2026-09-07T13:30:00.000Z", allDay: false, description: "原定时间" }];
    savePersonalEvents(account, events);
    finishTimetableCheck(account, 2026, 3, result(), "2026-09-02T10:00:00Z");
    finishTimetableCheck(account, 2026, 3, result("线性代数"), "2026-09-03T10:00:00Z");
    expect(readPersonalEvents(account)).toEqual(events);
  });

  it("maps dates to academic terms", () => {
    expect(currentTimetableTerm(dayjs("2026-11-06"))).toEqual({ year: 2026, term: 3 });
    expect(currentTimetableTerm(dayjs("2027-03-06"))).toEqual({ year: 2026, term: 12 });
    expect(currentTimetableTerm(dayjs("2027-07-06"))).toEqual({ year: 2026, term: 16 });
  });
});

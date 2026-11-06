import dayjs from "dayjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasLessonInWeek, lessonDates, teachingWeekForDate } from "../timetable";
import { assignmentStatus, dueReminderCandidates, markReminderSent, readTodos, saveTodos } from "../todo";
import type { Assignment } from "../model";

describe("formal timetable recurrence", () => {
  it("honors ranged, odd, even and single weeks", () => {
    expect(hasLessonInWeek("1-8周(单),10-12周(双),15周", 3)).toBe(true);
    expect(hasLessonInWeek("1-8周(单),10-12周(双),15周", 4)).toBe(false);
    expect(hasLessonInWeek("1-8周(单),10-12周(双),15周", 10)).toBe(true);
    expect(hasLessonInWeek("1-8周(单),10-12周(双),15周", 11)).toBe(false);
    expect(hasLessonInWeek("1-8周(单),10-12周(双),15周", 15)).toBe(true);
  });
  it("maps weeks to calendar dates from first Monday", () => {
    const lesson = { id: "1", name: "Math", teacher: "", location: "", day: 3, periods: "1-2", weeks: "1-2周" };
    expect(lessonDates(lesson, "2026-09-07", dayjs("2026-09-01"), dayjs("2026-09-30"))
      .map((date) => date.format("YYYY-MM-DD"))).toEqual(["2026-09-09", "2026-09-16"]);
  });
  it("uses calendar days to identify the teaching week", () => {
    expect(teachingWeekForDate(dayjs("2026-11-06"), "2026-09-14")).toBe(8);
    expect(teachingWeekForDate(dayjs("2026-11-02"), "2026-09-14")).toBe(8);
    expect(teachingWeekForDate(dayjs("2026-09-13"), "2026-09-14")).toBeNull();
    expect(teachingWeekForDate(dayjs("2027-01-04"), "2026-09-14")).toBe(17);
    expect(teachingWeekForDate(dayjs("2027-01-11"), "2026-09-14")).toBe(18);
    expect(teachingWeekForDate(dayjs("2027-01-18"), "2026-09-14")).toBeNull();
  });
});

describe("TODO status and reminders", () => {
  beforeEach(() => { localStorage.clear(); vi.useRealTimers(); });
  it("distinguishes submitted and graded from pending work", () => {
    const assignment = { submission_types: ["online_upload"], submission: null } as Assignment;
    expect(assignmentStatus(assignment)).toBe("pending");
    expect(assignmentStatus({ ...assignment, submission: { workflow_state: "submitted", submitted_at: null } as Assignment["submission"] })).toBe("submitted");
    expect(assignmentStatus({ ...assignment, submission: { workflow_state: "graded", submitted_at: null } as Assignment["submission"] })).toBe("graded");
  });
  it("sends one reminder per deadline and keeps accounts isolated", () => {
    const now = Date.parse("2026-11-04T12:00:00Z");
    const item = { id: "personal:1", source: "personal" as const, title: "Task",
      dueAt: "2026-11-05T00:00:00Z", status: "pending" as const, read: true, createdAt: "2026-11-01T00:00:00Z" };
    saveTodos("alice", { updatedAt: null, items: [item], failedCourses: [] });
    expect(dueReminderCandidates("alice", now)).toHaveLength(1);
    markReminderSent("alice", item);
    expect(dueReminderCandidates("alice", now)).toHaveLength(0);
    expect(readTodos("bob").items).toHaveLength(0);
  });
});

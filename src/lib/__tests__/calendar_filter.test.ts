import { describe, expect, it } from "vitest";
import { filterCalendarEvents, isCompletedAssignment } from "../calendar_filter";
import type { CalendarEvent } from "../model";

function assignment(id: number, state?: "submitted" | "unsubmitted" | "graded"): CalendarEvent {
  return { id: String(id), type_field: "assignment", assignment: {
    id, submission_types: ["online_upload"],
    submission: state ? { workflow_state: state, submitted_at: state === "unsubmitted" ? null : "2026-10-20T10:00:00Z" } : null,
  } } as CalendarEvent;
}

describe("calendar assignment status", () => {
  it("filters submitted, graded and unfinished work while keeping all events in the default view", () => {
    const submitted = assignment(1, "submitted");
    const graded = assignment(2, "graded");
    const unfinished = assignment(3, "unsubmitted");
    const event = { id: "notice", type_field: "event", assignment: { id: 0 } } as CalendarEvent;
    const entries = [submitted, graded, unfinished, event];
    expect(filterCalendarEvents(entries, "all")).toEqual(entries);
    expect(filterCalendarEvents(entries, "completed")).toEqual([submitted, graded]);
    expect(filterCalendarEvents(entries, "incomplete")).toEqual([unfinished]);
  });

  it("treats a no-submission assignment as complete", () => {
    const notice = assignment(4);
    notice.assignment.submission_types = ["none"];
    expect(isCompletedAssignment(notice)).toBe(true);
  });
});

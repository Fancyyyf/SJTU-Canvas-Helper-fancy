import type { CalendarEvent } from "./model";

export type AssignmentFilter = "all" | "completed" | "incomplete";

export function isAssignmentEvent(event: CalendarEvent): boolean {
  return event.type_field === "assignment" || event.assignment?.id > 0;
}

export function isCompletedAssignment(event: CalendarEvent): boolean {
  if (!isAssignmentEvent(event)) return false;
  const assignment = event.assignment;
  if (!assignment) return false;
  if (assignment.submission_types?.includes("none")) return true;
  const submission = assignment.submission;
  return Boolean(
    submission?.submitted_at ||
    (submission?.workflow_state && submission.workflow_state !== "unsubmitted")
  );
}

export function filterCalendarEvents(events: CalendarEvent[], filter: AssignmentFilter): CalendarEvent[] {
  if (filter === "all") return events;
  return events.filter((event) =>
    isAssignmentEvent(event) && isCompletedAssignment(event) === (filter === "completed")
  );
}

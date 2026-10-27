import { invoke } from "@tauri-apps/api/core";
import type { Assignment, CalendarEvent, Course } from "./model";
import { logHandledError } from "./logger";
import { runLimited } from "./run_limited";

export interface CachedCanvasAssignment {
  id: number;
  courseId: number;
  courseName: string;
  title: string;
  dueAt: string;
  htmlUrl: string;
  published: boolean;
  submissionTypes: string[];
  submittedAt: string | null;
  submissionState: string | null;
}

export interface CanvasCalendarSnapshot {
  updatedAt: string;
  assignments: CachedCanvasAssignment[];
}

export interface CalendarSyncState {
  account: string | null;
  syncing: boolean;
  error: string | null;
  failedCourses: string[];
}

export interface CalendarSyncResult {
  updated: boolean;
  failedCourses: string[];
  error: string | null;
}

let syncState: CalendarSyncState = { account: null, syncing: false, error: null, failedCourses: [] };
let revision = 0;
let inFlight: { account: string; promise: Promise<CalendarSyncResult> } | null = null;
const listeners = new Set<() => void>();

export function canvasCalendarCacheKey(account: string) {
  return `canvas-helper.canvas-calendar.v1.${encodeURIComponent(account)}`;
}

export function readCanvasCalendarSnapshot(account: string): CanvasCalendarSnapshot | null {
  try {
    const raw = localStorage.getItem(canvasCalendarCacheKey(account));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || !("updatedAt" in value) || !("assignments" in value)) return null;
    if (typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt)) || !Array.isArray(value.assignments)) return null;
    if (!value.assignments.every((item: unknown) => {
      if (!item || typeof item !== "object" || !("id" in item) || !("courseId" in item) || !("dueAt" in item) ||
          !("courseName" in item) || !("title" in item) || !("htmlUrl" in item) || !("published" in item) ||
          !("submissionTypes" in item) || !("submittedAt" in item) || !("submissionState" in item)) return false;
      return typeof item.id === "number" && typeof item.courseId === "number" &&
        typeof item.courseName === "string" && typeof item.title === "string" &&
        typeof item.dueAt === "string" && Number.isFinite(Date.parse(item.dueAt)) &&
        typeof item.htmlUrl === "string" && typeof item.published === "boolean" &&
        Array.isArray(item.submissionTypes) && item.submissionTypes.every((type: unknown) => typeof type === "string") &&
        (item.submittedAt === null || typeof item.submittedAt === "string") &&
        (item.submissionState === null || typeof item.submissionState === "string");
    })) return null;
    return value as CanvasCalendarSnapshot;
  } catch {
    return null;
  }
}

export function writeCanvasCalendarSnapshot(account: string, snapshot: CanvasCalendarSnapshot) {
  localStorage.setItem(canvasCalendarCacheKey(account), JSON.stringify(snapshot));
  revision++;
  listeners.forEach((listener) => listener());
}

export function subscribeCanvasCalendar(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getCanvasCalendarRevision() { return revision; }
export function getCanvasCalendarSyncState() { return syncState; }

function updateSyncState(next: CalendarSyncState) {
  syncState = next;
  revision++;
  listeners.forEach((listener) => listener());
}

export function cacheAssignment(assignment: Assignment, course: Course): CachedCanvasAssignment | null {
  if (!assignment.due_at || !Number.isFinite(Date.parse(assignment.due_at))) return null;
  return {
    id: assignment.id,
    courseId: course.id,
    courseName: course.name,
    title: assignment.name,
    dueAt: assignment.due_at,
    htmlUrl: assignment.html_url,
    published: assignment.published,
    submissionTypes: assignment.submission_types ?? [],
    submittedAt: assignment.submission?.submitted_at ?? null,
    submissionState: assignment.submission?.workflow_state ?? null,
  };
}

export function cachedAssignmentToEvent(item: CachedCanvasAssignment): CalendarEvent {
  return {
    id: `assignment_${item.courseId}_${item.id}`,
    title: item.title,
    type_field: "assignment",
    workflow_state: item.published ? "published" : "unpublished",
    assignment: {
      id: item.id,
      submission_types: item.submissionTypes,
      submission: item.submissionState || item.submittedAt
        ? { workflow_state: item.submissionState, submitted_at: item.submittedAt }
        : null,
    } as CalendarEvent["assignment"],
    html_url: item.htmlUrl,
    start_at: item.dueAt,
    end_at: item.dueAt,
    context_code: `course_${item.courseId}`,
    context_name: item.courseName,
    url: item.htmlUrl,
    important_dates: true,
  };
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function performSync(account: string): Promise<CalendarSyncResult> {
  updateSyncState({ account, syncing: true, error: null, failedCourses: [] });
  try {
    const courses = await invoke<Course[]>("refresh_courses");
    const previous = readCanvasCalendarSnapshot(account);
    if (courses.length === 0 && previous?.assignments.length) {
      throw new Error("Canvas 未返回课程，已保留本地记录");
    }
    const byCourse = new Map<number, CachedCanvasAssignment[]>();
    for (const item of previous?.assignments ?? []) {
      const group = byCourse.get(item.courseId) ?? [];
      group.push(item);
      byCourse.set(item.courseId, group);
    }
    const failedCourses: string[] = [];
    let succeeded = 0;
    await runLimited(courses, 4, async (course) => {
      try {
        const assignments = await invoke<Assignment[]>("list_course_assignments", { courseId: course.id });
        byCourse.set(course.id, assignments.map((item) => cacheAssignment(item, course)).filter((item): item is CachedCanvasAssignment => item !== null));
        succeeded++;
      } catch (error) {
        failedCourses.push(course.name);
        logHandledError({
          code: "CALENDAR.COURSE_SYNC_FAILED", scope: "calendar", action: "list_course_assignments",
          error, userMessage: `${course.name} 的作业更新失败，已保留本地记录。`, recoverable: true,
          fallback: { used: true, strategy: "keep_cached_course", result: "success" },
          context: { courseId: course.id },
        });
      }
    });
    const current = await invoke<{ current_account: string }>("read_account_info");
    if ((current.current_account || "local") !== account) throw new Error("账号已切换，本次更新已取消");
    if (courses.length > 0 && succeeded === 0) throw new Error("所有课程的作业更新均失败，已保留本地记录");
    const snapshot: CanvasCalendarSnapshot = {
      updatedAt: new Date().toISOString(),
      assignments: [...byCourse.values()].flat(),
    };
    writeCanvasCalendarSnapshot(account, snapshot);
    updateSyncState({ account, syncing: false, error: null, failedCourses });
    return { updated: true, failedCourses, error: null };
  } catch (error) {
    const message = errorText(error);
    const hasCache = readCanvasCalendarSnapshot(account) !== null;
    updateSyncState({ account, syncing: false, error: message, failedCourses: [] });
    logHandledError({
      code: "CALENDAR.SYNC_FAILED", scope: "calendar", action: "sync_canvas_calendar",
      error, userMessage: hasCache ? "Canvas 日历更新失败，已继续显示本地记录。" : "Canvas 日历更新失败，尚无本地记录。", recoverable: true,
      fallback: { used: hasCache, strategy: "keep_cached_calendar", result: hasCache ? "success" : "failed" },
    });
    return { updated: false, failedCourses: [], error: message };
  }
}

export async function syncCanvasCalendar(): Promise<CalendarSyncResult> {
  let account: string;
  try {
    const info = await invoke<{ current_account: string }>("read_account_info");
    account = info.current_account || "local";
  } catch (error) {
    return { updated: false, failedCourses: [], error: errorText(error) };
  }
  if (inFlight?.account === account) return inFlight.promise;
  const promise = performSync(account);
  inFlight = { account, promise };
  try {
    return await promise;
  } finally {
    if (inFlight?.promise === promise) inFlight = null;
  }
}

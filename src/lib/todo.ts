import { invoke } from "@tauri-apps/api/core";
import type { Assignment, Course } from "./model";
import { runLimited } from "./run_limited";

export type TodoStatus = "pending" | "submitted" | "graded" | "completed" | "offline";
export interface TodoItem {
  id: string;
  source: "canvas" | "personal";
  title: string;
  courseName?: string;
  dueAt: string | null;
  status: TodoStatus;
  url?: string;
  read: boolean;
  createdAt: string;
  eventId?: string;
}
export interface TodoSnapshot {
  updatedAt: string | null;
  items: TodoItem[];
  failedCourses: string[];
}

const listeners = new Set<() => void>();
const key = (account: string) => "canvas-helper.todo.v1." + encodeURIComponent(account);
let inFlight: { account: string; promise: Promise<TodoSnapshot> } | null = null;
export function subscribeTodos(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function changed() { listeners.forEach((listener) => listener()); }
export function readTodos(account: string): TodoSnapshot {
  try {
    const value = JSON.parse(localStorage.getItem(key(account)) || "null") as TodoSnapshot | null;
    if (value && Array.isArray(value.items)) return value;
  } catch { /* Treat a damaged cache as empty. */ }
  return { updatedAt: null, items: [], failedCourses: [] };
}
export function saveTodos(account: string, snapshot: TodoSnapshot) {
  localStorage.setItem(key(account), JSON.stringify(snapshot));
  changed();
}
export function assignmentStatus(assignment: Assignment): TodoStatus {
  const submission = assignment.submission;
  if (submission?.workflow_state === "graded") return "graded";
  if (submission?.submitted_at || submission?.workflow_state === "submitted" ||
      submission?.workflow_state === "pending_review") return "submitted";
  if (assignment.submission_types?.includes("none") || assignment.submission_types?.includes("on_paper")) return "offline";
  return "pending";
}
export function fromAssignment(assignment: Assignment, course: Course, old?: TodoItem): TodoItem {
  return {
    id: "canvas:" + course.id + ":" + assignment.id,
    source: "canvas",
    title: assignment.name,
    courseName: course.name,
    dueAt: assignment.due_at && Number.isFinite(Date.parse(assignment.due_at)) ? assignment.due_at : null,
    status: assignmentStatus(assignment),
    url: assignment.html_url,
    read: old?.read ?? false,
    createdAt: old?.createdAt ?? new Date().toISOString(),
  };
}
export function addPersonalTodo(account: string, title: string, dueAt: string | null, eventId?: string) {
  const snapshot = readTodos(account);
  const item: TodoItem = { id: "personal:" + crypto.randomUUID(), source: "personal", title: title.trim(),
    dueAt, status: "pending", read: true, createdAt: new Date().toISOString(), eventId };
  snapshot.items.push(item);
  saveTodos(account, snapshot);
  return item;
}
export function updateTodo(account: string, id: string, changes: Partial<Pick<TodoItem, "title" | "dueAt" | "status" | "read">>) {
  const snapshot = readTodos(account);
  snapshot.items = snapshot.items.map((item) => item.id === id ? { ...item, ...changes } : item);
  saveTodos(account, snapshot);
}
export function removePersonalTodo(account: string, id: string) {
  const snapshot = readTodos(account);
  snapshot.items = snapshot.items.filter((item) => item.id !== id || item.source !== "personal");
  saveTodos(account, snapshot);
}
async function performSync(account: string): Promise<TodoSnapshot> {
  const old = readTodos(account);
  const oldById = new Map(old.items.map((item) => [item.id, item]));
  const courses = await invoke<Course[]>("refresh_courses");
  const studentCourses = courses.filter((course) => course.enrollments?.some((enrollment) =>
    enrollment.role === "StudentEnrollment" || enrollment.role === "TemporaryStudentEnrollment"));
  const byCourse = new Map<number, TodoItem[]>();
  for (const item of old.items.filter((entry) => entry.source === "canvas")) {
    const courseId = Number(item.id.split(":")[1]);
    byCourse.set(courseId, [...(byCourse.get(courseId) || []), item]);
  }
  const failedCourses: string[] = [];
  let succeeded = 0;
  await runLimited(studentCourses, 4, async (course) => {
    try {
      const assignments = await invoke<Assignment[]>("list_course_assignments", { courseId: course.id });
      byCourse.set(course.id, assignments.filter((item) => item.published).map((assignment) =>
        fromAssignment(assignment, course, oldById.get("canvas:" + course.id + ":" + assignment.id))));
      succeeded++;
    } catch {
      failedCourses.push(course.name);
    }
  });
  const current = await invoke<{ current_account: string }>("read_account_info");
  if ((current.current_account || "local") !== account) throw new Error("账号已切换，已取消待办同步");
  if (studentCourses.length && !succeeded) throw new Error("Canvas 作业同步失败，已保留本地待办");
  const latest = readTodos(account);
  const latestById = new Map(latest.items.map((item) => [item.id, item]));
  const snapshot = { updatedAt: new Date().toISOString(),
    items: [...latest.items.filter((item) => item.source === "personal"), ...[...byCourse.values()].flat().map((item) => ({
      ...item, read: latestById.get(item.id)?.read ?? item.read,
    }))],
    failedCourses };
  saveTodos(account, snapshot);
  if (old.updatedAt) {
    const newItems = snapshot.items.filter((item) => item.source === "canvas" && !oldById.has(item.id));
    if (newItems.length) {
      void import("./todo_reminders").then(({ notifyNewAssignments }) => notifyNewAssignments(newItems)).catch(() => {});
    }
  }
  return snapshot;
}
export async function syncTodos(account: string) {
  if (inFlight?.account === account) return inFlight.promise;
  const promise = performSync(account);
  inFlight = { account, promise };
  try { return await promise; } finally { if (inFlight?.promise === promise) inFlight = null; }
}

const reminderKey = (account: string) => "canvas-helper.todo-reminders.v1." + encodeURIComponent(account);
function sentReminders(account: string) {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(reminderKey(account)) || "[]");
    return new Set<string>(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch { return new Set<string>(); }
}
export function dueReminderCandidates(account: string, now = Date.now()) {
  const sent = sentReminders(account);
  return readTodos(account).items.filter((item) => {
    if (item.status !== "pending" && item.status !== "offline") return false;
    const due = item.dueAt ? Date.parse(item.dueAt) : NaN;
    return Number.isFinite(due) && due > now && due - now <= 24 * 60 * 60 * 1000 &&
      !sent.has(item.id + ":" + item.dueAt);
  });
}
export function markReminderSent(account: string, item: TodoItem) {
  const sent = sentReminders(account);
  sent.add(item.id + ":" + item.dueAt);
  localStorage.setItem(reminderKey(account), JSON.stringify([...sent].slice(-500)));
}

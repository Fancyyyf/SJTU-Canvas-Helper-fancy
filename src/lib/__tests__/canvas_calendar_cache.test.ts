import { beforeEach, describe, expect, it, vi } from "vitest";
import { cacheAssignment, cachedAssignmentToEvent, readCanvasCalendarSnapshot, syncCanvasCalendar, writeCanvasCalendarSnapshot } from "../canvas_calendar_cache";
import { isCompletedAssignment } from "../calendar_filter";
import type { Assignment, Course } from "../model";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("../logger", () => ({ logHandledError: vi.fn() }));

const course = (id: number): Course => ({ id, name: `课程 ${id}` } as Course);
const assignment = (id: number, state: "submitted" | "unsubmitted"): Assignment => ({
  id, name: `作业 ${id}`, due_at: "2026-11-01T12:00:00Z", html_url: `https://canvas.example/${id}`,
  published: true, submission_types: ["online_upload"],
  submission: { workflow_state: state, submitted_at: state === "submitted" ? "2026-10-27T01:00:00Z" : null },
} as Assignment);

beforeEach(() => { localStorage.clear(); mocks.invoke.mockReset(); });

describe("Canvas calendar cache", () => {
  it("refreshes submission state and preserves a failed course's cached records", async () => {
    const old = cacheAssignment(assignment(2, "unsubmitted"), course(2));
    expect(old).not.toBeNull();
    writeCanvasCalendarSnapshot("alice", { updatedAt: "2026-10-26T00:00:00Z", assignments: [old!] });
    mocks.invoke.mockImplementation((command: string, args?: { courseId: number }) => {
      if (command === "read_account_info") return Promise.resolve({ current_account: "alice" });
      if (command === "refresh_courses") return Promise.resolve([course(1), course(2)]);
      if (command === "list_course_assignments" && args?.courseId === 1) return Promise.resolve([assignment(1, "submitted")]);
      if (command === "list_course_assignments" && args?.courseId === 2) return Promise.reject(new Error("offline"));
      throw new Error(`Unexpected command: ${command}`);
    });
    const result = await syncCanvasCalendar();
    expect(result.updated).toBe(true);
    expect(result.failedCourses).toEqual(["课程 2"]);
    const saved = readCanvasCalendarSnapshot("alice")!;
    expect(saved.assignments).toHaveLength(2);
    expect(isCompletedAssignment(cachedAssignmentToEvent(saved.assignments.find((item) => item.id === 1)!))).toBe(true);
    expect(isCompletedAssignment(cachedAssignmentToEvent(saved.assignments.find((item) => item.id === 2)!))).toBe(false);
    expect(readCanvasCalendarSnapshot("bob")).toBeNull();
  });

  it("keeps the previous snapshot when the course list cannot load", async () => {
    const old = cacheAssignment(assignment(3, "submitted"), course(3))!;
    const snapshot = { updatedAt: "2026-10-26T00:00:00Z", assignments: [old] };
    writeCanvasCalendarSnapshot("alice", snapshot);
    mocks.invoke.mockImplementation((command: string) => {
      if (command === "read_account_info") return Promise.resolve({ current_account: "alice" });
      if (command === "refresh_courses") return Promise.reject(new Error("network down"));
      throw new Error(`Unexpected command: ${command}`);
    });
    const result = await syncCanvasCalendar();
    expect(result.updated).toBe(false);
    expect(result.error).toContain("network down");
    expect(readCanvasCalendarSnapshot("alice")).toEqual(snapshot);
  });

  it("removes a cached deadline when a successful course refresh no longer returns it", async () => {
    writeCanvasCalendarSnapshot("alice", {
      updatedAt: "2026-10-26T00:00:00Z",
      assignments: [cacheAssignment(assignment(4, "unsubmitted"), course(4))!],
    });
    mocks.invoke.mockImplementation((command: string) => {
      if (command === "read_account_info") return Promise.resolve({ current_account: "alice" });
      if (command === "refresh_courses") return Promise.resolve([course(4)]);
      if (command === "list_course_assignments") return Promise.resolve([]);
      throw new Error(`Unexpected command: ${command}`);
    });
    expect((await syncCanvasCalendar()).updated).toBe(true);
    expect(readCanvasCalendarSnapshot("alice")?.assignments).toEqual([]);
  });

  it("does not replace an existing calendar when Canvas unexpectedly returns no courses", async () => {
    const snapshot = {
      updatedAt: "2026-10-26T00:00:00Z",
      assignments: [cacheAssignment(assignment(5, "submitted"), course(5))!],
    };
    writeCanvasCalendarSnapshot("alice", snapshot);
    mocks.invoke.mockImplementation((command: string) => {
      if (command === "read_account_info") return Promise.resolve({ current_account: "alice" });
      if (command === "refresh_courses") return Promise.resolve([]);
      throw new Error(`Unexpected command: ${command}`);
    });
    expect((await syncCanvasCalendar()).updated).toBe(false);
    expect(readCanvasCalendarSnapshot("alice")).toEqual(snapshot);
  });

  it("shares one in-flight update between startup and a manual refresh", async () => {
    let complete!: (courses: Course[]) => void;
    mocks.invoke.mockImplementation((command: string) => {
      if (command === "read_account_info") return Promise.resolve({ current_account: "alice" });
      if (command === "refresh_courses") return new Promise<Course[]>((resolve) => { complete = resolve; });
      throw new Error(`Unexpected command: ${command}`);
    });
    const startup = syncCanvasCalendar();
    const manual = syncCanvasCalendar();
    await vi.waitFor(() => expect(complete).toBeDefined());
    complete([]);
    await Promise.all([startup, manual]);
    expect(mocks.invoke.mock.calls.filter(([command]) => command === "refresh_courses")).toHaveLength(1);
  });
});

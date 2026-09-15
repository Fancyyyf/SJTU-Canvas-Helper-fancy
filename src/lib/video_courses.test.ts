import { describe, expect, it, vi } from "vitest";
import type { CanvasVideo, Course } from "./model";
import { loadVideoCourse, mergeVideoCourses } from "./video_courses";

function course(id: number, overrides: Partial<Course> = {}): Course {
  return {
    id, uuid: "", name: "测试课程甲", course_code: "TEST-001", enrollments: [],
    access_restricted_by_date: false, teachers: [],
    term: { id: 1, name: "2098-2099-1", start_at: null, end_at: null, created_at: null, workflow_state: "" },
    ...overrides,
  };
}

describe("video course merging", () => {
  it("merges matching courses across differently formatted semesters and preserves backend IDs", () => {
    const space = course(80);
    space.term.name = "2098-2099 第一学期";
    expect(mergeVideoCourses([course(10)], [space])).toMatchObject([
      { id: 10, canvasId: 10, teachingClassId: 80, sourceLabel: "" },
    ]);
  });
  it("keeps different terms and ID namespaces separate", () => {
    const space = course(10);
    space.term.name = "2097-2098 第一学期";
    const result = mergeVideoCourses([course(10)], [space]);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ id: -11, teachingClassId: 10, sourceLabel: "视频空间" });
  });
  it("does not merge ambiguous classes", () => {
    expect(mergeVideoCourses([course(10), course(11)], [course(80)])).toHaveLength(3);
    expect(mergeVideoCourses([course(10)], [course(80), course(81)])).toHaveLength(3);
  });
  it("deduplicates repeated records within a source", () => {
    expect(mergeVideoCourses([course(10), course(10)], [course(80), course(80)])).toHaveLength(1);
  });
  it("matches names and teachers when course codes differ", () => {
    const teachers = [{ id: 1, anonymous_id: "", display_name: "测试教师甲", avatar_image_url: "", html_url: "" }];
    expect(mergeVideoCourses([course(10, { teachers })], [course(80, { teachers, course_code: "" })])).toHaveLength(1);
    expect(mergeVideoCourses([course(10, { teachers })], [course(80, {
      teachers: [{ ...teachers[0], display_name: "测试教师乙" }],
    })])).toHaveLength(2);
    expect(mergeVideoCourses([course(10)], [course(80, { course_code: "" })])).toHaveLength(2);
  });
});

describe("video course fallback", () => {
  const merged = mergeVideoCourses([course(10)], [course(80)])[0];
  const videos = [{ videoId: "recording" }] as CanvasVideo[];
  it("prefers Canvas without requesting video space", async () => {
    const canvas = vi.fn().mockResolvedValue(videos);
    const space = vi.fn();
    expect(await loadVideoCourse(merged, canvas, space)).toBe(videos);
    expect(canvas).toHaveBeenCalledWith(10);
    expect(space).not.toHaveBeenCalled();
  });
  it.each(["empty", "failure"])("falls back after Canvas %s", async (mode) => {
    const canvas = mode === "empty" ? vi.fn().mockResolvedValue([]) : vi.fn().mockRejectedValue(new Error("offline"));
    const space = vi.fn().mockResolvedValue(videos);
    expect(await loadVideoCourse(merged, canvas, space)).toBe(videos);
    expect(space).toHaveBeenCalledWith(80);
  });
  it("loads space-only courses using their original teaching class ID", async () => {
    const canvas = vi.fn();
    const space = vi.fn().mockResolvedValue(videos);
    await loadVideoCourse(mergeVideoCourses([], [course(80)])[0], canvas, space);
    expect(canvas).not.toHaveBeenCalled();
    expect(space).toHaveBeenCalledWith(80);
  });
  it("reports both failures", async () => {
    await expect(loadVideoCourse(merged, vi.fn().mockRejectedValue("first"), vi.fn().mockRejectedValue("second")))
      .rejects.toThrow("Canvas：first；视频空间：second");
  });
});

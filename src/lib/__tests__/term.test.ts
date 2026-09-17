import { describe, expect, it } from "vitest";

import type { Course } from "../model";
import {
  filterCoursesByTerm,
  findDefaultTermId,
  formatTermName,
  listTermOptions,
  resolveTermSelection,
} from "../term";

function course(id: number, termId: number, termName: string, start: string, end: string): Course {
  return {
    id,
    uuid: `course-${id}`,
    name: `Course ${id}`,
    course_code: `C${id}`,
    enrollments: [],
    access_restricted_by_date: false,
    teachers: [],
    term: {
      id: termId,
      name: termName,
      start_at: start,
      end_at: end,
      created_at: start,
      workflow_state: "available",
    },
  };
}

const courses = [
  course(1, 10, "2024 Fall", "2024-09-01", "2025-01-31"),
  course(2, 20, "Current Spring", "2000-01-01", "2999-12-31"),
  course(3, 20, "Current Spring", "2000-01-01", "2999-12-31"),
];

describe("term filters", () => {
  it("deduplicates terms and reports course counts", () => {
    expect(listTermOptions(courses)).toEqual([
      expect.objectContaining({ id: 20, courseCount: 2 }),
      expect.objectContaining({ id: 10, courseCount: 1 }),
    ]);
  });

  it("selects the active term by default and repairs stale selections", () => {
    expect(findDefaultTermId(courses)).toBe(20);
    expect(resolveTermSelection(null, courses)).toBe(20);
    expect(resolveTermSelection(999, courses)).toBe(20);
    expect(resolveTermSelection("all", courses)).toBe("all");
  });

  it("filters courses only for a concrete term", () => {
    expect(filterCoursesByTerm(courses, 20).map((item) => item.id)).toEqual([2, 3]);
    expect(filterCoursesByTerm(courses, "all")).toHaveLength(3);
  });

  it("formats common English term names", () => {
    expect(formatTermName("2025 Fall")).toBe("2025 秋季学期");
  });
});

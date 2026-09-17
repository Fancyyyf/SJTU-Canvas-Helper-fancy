import dayjs from "dayjs";

import type { Course, Term, TermSelection } from "./model";

export interface TermOption {
  id: number;
  name: string;
  startAt?: string | null;
  endAt?: string | null;
  courseCount: number;
}

export function formatTermName(name: string): string {
  return name
    .replace(/Spring/gi, "春季学期")
    .replace(/Summer/gi, "夏季学期")
    .replace(/Fall/gi, "秋季学期")
    .replace(/Winter/gi, "冬季学期");
}

function termTimestamp(term: Pick<Term, "start_at" | "end_at" | "created_at" | "id">) {
  for (const value of [term.end_at, term.start_at, term.created_at]) {
    const timestamp = dayjs(value).valueOf();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return term.id;
}

export function listTermOptions(courses: Course[]): TermOption[] {
  const terms = new Map<number, TermOption & { sortValue: number }>();
  for (const course of courses) {
    const current = terms.get(course.term.id);
    if (current) {
      current.courseCount += 1;
      continue;
    }
    terms.set(course.term.id, {
      id: course.term.id,
      name: course.term.name,
      startAt: course.term.start_at,
      endAt: course.term.end_at,
      courseCount: 1,
      sortValue: termTimestamp(course.term),
    });
  }
  return [...terms.values()]
    .sort((a, b) => b.sortValue - a.sortValue || b.id - a.id)
    .map(({ sortValue: _sortValue, ...term }) => term);
}

export function findDefaultTermId(courses: Course[]): number | null {
  const now = dayjs();
  const activeTerms = listTermOptions(courses).filter((term) => {
    const startsBeforeNow = !term.startAt || !dayjs(term.startAt).isAfter(now);
    const endsAfterNow = !term.endAt || !dayjs(term.endAt).isBefore(now);
    return startsBeforeNow && endsAfterNow;
  });
  return activeTerms[0]?.id ?? listTermOptions(courses)[0]?.id ?? null;
}

export function resolveTermSelection(
  selection: TermSelection,
  courses: Course[]
): TermSelection {
  if (selection === "all") return selection;
  if (selection !== null && courses.some((course) => course.term.id === selection)) {
    return selection;
  }
  return findDefaultTermId(courses);
}

export function filterCoursesByTerm(
  courses: Course[],
  selection: TermSelection
): Course[] {
  if (selection === "all" || selection === null) return courses;
  return courses.filter((course) => course.term.id === selection);
}

import dayjs, { type Dayjs } from "dayjs";

export interface TimetableLesson {
  id: string;
  name: string;
  teacher: string;
  location: string;
  day: number;
  periods: string;
  weeks: string;
}
export interface TimetableResult {
  year: number;
  term: number;
  lessons: TimetableLesson[];
  semesterStart: string | null;
  fetchedAt: string;
}

export function teachingWeekForDate(date: Dayjs, firstWeekMonday: string): number | null {
  const start = dayjs(firstWeekMonday);
  if (!date.isValid() || !start.isValid() || start.day() !== 1) return null;
  const dayNumber = (value: Dayjs) => Date.UTC(value.year(), value.month(), value.date()) / 86_400_000;
  const week = Math.floor((dayNumber(date) - dayNumber(start)) / 7) + 1;
  return week >= 1 && week <= 18 ? week : null;
}

export function hasLessonInWeek(pattern: string, week: number) {
  if (week < 1 || week > 30) return false;
  const normalized = pattern.replace(/，|、/g, ",").replace(/周次|周/g, "");
  const pieces = normalized.split(/[,/]/);
  return pieces.some((piece) => {
    const odd = /单|奇/.test(piece);
    const even = /双|偶/.test(piece);
    if (odd && week % 2 === 0 || even && week % 2 !== 0) return false;
    const range = piece.match(/(\d+)\s*[-~至]\s*(\d+)/);
    if (range) return week >= Number(range[1]) && week <= Number(range[2]);
    const single = piece.match(/\d+/);
    return single ? Number(single[0]) === week : false;
  });
}
export function lessonDates(lesson: TimetableLesson, semesterStart: string, from: Dayjs, to: Dayjs) {
  const start = dayjs(semesterStart).startOf("day");
  if (!start.isValid()) return [];
  const dates: Dayjs[] = [];
  for (let week = 1; week <= 30; week++) {
    if (!hasLessonInWeek(lesson.weeks, week)) continue;
    const date = start.add((week - 1) * 7 + lesson.day - 1, "day");
    if (!date.isBefore(from, "day") && !date.isAfter(to, "day")) dates.push(date);
  }
  return dates;
}
export function periodLabel(periods: string) {
  const match = periods.match(/(\d+)(?:\s*[-~]\s*(\d+))?/);
  return match ? "第 " + match[1] + (match[2] ? "–" + match[2] : "") + " 节" : periods;
}

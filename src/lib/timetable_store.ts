import dayjs from "dayjs";
import type { TimetableLesson, TimetableResult } from "./timetable";

export type TimetableTerm = { year: number; term: 3 | 12 | 16 };
export type TimetableCheckStatus = "checking" | "imported" | "unchanged" | "updated" | "failed";

export interface TimetableRecord {
  version: 2;
  year: number;
  term: 3 | 12 | 16;
  result: TimetableResult | null;
  firstFetchedAt: string | null;
  lastCheckedAt: string | null;
  lastAttemptAt: string | null;
  lastStatus: TimetableCheckStatus | null;
  lastError: string | null;
  firstWeekMonday: string | null;
}

const prefix = (account: string) => `canvas-helper.timetable.v2.${encodeURIComponent(account)}.`;
const legacyPrefix = (account: string) => `canvas-helper.timetable.v1.${encodeURIComponent(account)}.`;
const key = (account: string, year: number, term: number) => `${prefix(account)}${year}.${term}`;
const legacyKey = (account: string, year: number, term: number) => `${legacyPrefix(account)}${year}.${term}`;
const validTerm = (term: number): term is TimetableTerm["term"] => term === 3 || term === 12 || term === 16;
const validYear = (year: number) => Number.isInteger(year) && year >= 2000 && year <= 2100;
const validTimestamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const optionalTimestamp = (value: unknown) => value === null || validTimestamp(value);
const validDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  dayjs(value).isValid() && dayjs(value).format("YYYY-MM-DD") === value;
const monday = (value: string) => dayjs(value).subtract((dayjs(value).day() + 6) % 7, "day").format("YYYY-MM-DD");

export function currentTimetableTerm(date = dayjs()): TimetableTerm {
  const month = date.month() + 1;
  if (month >= 9) return { year: date.year(), term: 3 };
  if (month === 1) return { year: date.year() - 1, term: 3 };
  if (month >= 7) return { year: date.year() - 1, term: 16 };
  return { year: date.year() - 1, term: 12 };
}

export function timetableTermLabel(year: number, term: number) {
  const name = term === 3 ? "秋季" : term === 12 ? "春季" : "夏季";
  return `${year}–${year + 1} 学年 · ${name}学期`;
}

export function officialFirstWeekMonday(year: number, term: number): string | null {
  // Bundled reference from the published academic calendar, not a live calendar fetch.
  return year === 2026 && term === 3 ? "2026-09-14" : null;
}

function validLesson(value: unknown): value is TimetableLesson {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TimetableLesson>;
  return typeof item.id === "string" && typeof item.name === "string" && item.name.trim().length > 0 &&
    typeof item.teacher === "string" && typeof item.location === "string" &&
    Number.isInteger(item.day) && Number(item.day) >= 1 && Number(item.day) <= 7 &&
    typeof item.periods === "string" && typeof item.weeks === "string";
}

function validResult(value: unknown, year: number, term: number): value is TimetableResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<TimetableResult>;
  return result.year === year && result.term === term && Array.isArray(result.lessons) &&
    result.lessons.every(validLesson) &&
    (result.semesterStart === null || validDate(result.semesterStart)) &&
    validTimestamp(result.fetchedAt);
}

function emptyRecord(year: number, term: TimetableTerm["term"]): TimetableRecord {
  return { version: 2, year, term, result: null, firstFetchedAt: null, lastCheckedAt: null,
    lastAttemptAt: null, lastStatus: null, lastError: null, firstWeekMonday: null };
}

function parseRecord(raw: string, year: number, term: TimetableTerm["term"]): TimetableRecord {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("本地课表记录格式无效");
  const record = value as TimetableRecord;
  if (record.version !== 2 || record.year !== year || record.term !== term ||
      (record.result !== null && !validResult(record.result, year, term)) ||
      !optionalTimestamp(record.firstFetchedAt) || !optionalTimestamp(record.lastCheckedAt) ||
      !optionalTimestamp(record.lastAttemptAt) ||
      (record.lastError !== null && typeof record.lastError !== "string") ||
      (record.firstWeekMonday !== null && !validDate(record.firstWeekMonday)) ||
      (record.lastStatus !== null && !["checking", "imported", "unchanged", "updated", "failed"].includes(record.lastStatus))) {
    throw new Error("本地课表记录格式无效");
  }
  return record;
}

export function readTimetableRecord(account: string, year: number, term: TimetableTerm["term"]): TimetableRecord {
  if (!validYear(year)) throw new Error("学年无效");
  const raw = localStorage.getItem(key(account, year, term));
  if (raw) return parseRecord(raw, year, term);
  const oldKey = legacyKey(account, year, term);
  const legacy = localStorage.getItem(oldKey);
  if (!legacy) return emptyRecord(year, term);
  const result: unknown = JSON.parse(legacy);
  if (!validResult(result, year, term)) throw new Error("旧版课表缓存格式无效");
  const savedStart = localStorage.getItem(oldKey + ".start");
  const record: TimetableRecord = {
    ...emptyRecord(year, term), result, firstFetchedAt: result.fetchedAt,
    lastCheckedAt: result.fetchedAt, lastAttemptAt: result.fetchedAt,
    lastStatus: "imported", firstWeekMonday: savedStart && validDate(savedStart) ? monday(savedStart) : null,
  };
  localStorage.setItem(key(account, year, term), JSON.stringify(record));
  return record;
}

export function listTimetableRecords(account: string): TimetableRecord[] {
  const terms = new Map<string, TimetableTerm>();
  for (let index = 0; index < localStorage.length; index++) {
    const item = localStorage.key(index);
    if (!item) continue;
    const matched = [prefix(account), legacyPrefix(account)]
      .map((candidate) => item.startsWith(candidate) ? item.slice(candidate.length).match(/^(\d{4})\.(3|12|16)$/) : null)
      .find(Boolean);
    if (!matched) continue;
    const year = Number(matched[1]);
    const term = Number(matched[2]);
    if (validYear(year) && validTerm(term)) terms.set(`${year}.${term}`, { year, term });
  }
  return [...terms.values()].map(({ year, term }) => readTimetableRecord(account, year, term))
    .sort((a, b) => b.year - a.year || b.term - a.term);
}

function writeRecord(account: string, record: TimetableRecord) {
  localStorage.setItem(key(account, record.year, record.term), JSON.stringify(record));
  return record;
}

export function beginTimetableCheck(account: string, year: number, term: TimetableTerm["term"], at: string) {
  const previous = readTimetableRecord(account, year, term);
  return writeRecord(account, { ...previous, lastAttemptAt: at, lastStatus: "checking", lastError: null });
}

function lessonSignature(lesson: TimetableLesson) {
  return JSON.stringify([lesson.name, lesson.teacher, lesson.location, lesson.day, lesson.periods, lesson.weeks]);
}

export function sameTimetable(a: TimetableResult, b: TimetableResult) {
  return JSON.stringify(a.lessons.map(lessonSignature).sort()) === JSON.stringify(b.lessons.map(lessonSignature).sort());
}

export function finishTimetableCheck(account: string, year: number, term: TimetableTerm["term"], result: TimetableResult, at: string) {
  if (!validResult(result, year, term)) throw new Error("教学信息网返回了无效的课表数据");
  const previous = readTimetableRecord(account, year, term);
  const status: TimetableCheckStatus = !previous.result ? "imported" :
    sameTimetable(previous.result, result) ? "unchanged" : "updated";
  return writeRecord(account, {
    ...previous, result: status === "unchanged" ? previous.result : result,
    firstFetchedAt: previous.firstFetchedAt ?? at, lastCheckedAt: at,
    lastAttemptAt: previous.lastStatus === "checking" ? previous.lastAttemptAt : at,
    lastStatus: status, lastError: null,
  });
}

export function failTimetableCheck(account: string, year: number, term: TimetableTerm["term"], error: string, at: string) {
  const previous = readTimetableRecord(account, year, term);
  return writeRecord(account, { ...previous, lastAttemptAt: previous.lastStatus === "checking" ? previous.lastAttemptAt : at,
    lastStatus: "failed", lastError: error.slice(0, 300) });
}

export function setFirstWeekMonday(account: string, year: number, term: TimetableTerm["term"], date: string | null) {
  if (date !== null && (!validDate(date) || dayjs(date).day() !== 1)) throw new Error("第一周开始日期必须是周一");
  return writeRecord(account, { ...readTimetableRecord(account, year, term), firstWeekMonday: date });
}

export function effectiveFirstWeekMonday(record: TimetableRecord) {
  // rqazcList includes dates unrelated to week 1, so its earliest date is only a hint.
  return record.firstWeekMonday ?? officialFirstWeekMonday(record.year, record.term);
}

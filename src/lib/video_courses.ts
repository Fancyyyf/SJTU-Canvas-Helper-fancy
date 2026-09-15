import type { CanvasVideo, Course } from "./model";

export interface VideoCourseOption extends Course {
  canvasId?: number;
  teachingClassId?: number;
  sourceLabel: string;
}

const normalize = (value: string) => value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();

export function normalizeVideoTermName(name: string): string {
  const seasons: Record<string, string> = { "1": "秋", "2": "春", "3": "夏", 一: "秋", 二: "春", 三: "夏" };
  return name.normalize("NFKC")
    .replace(/第?\s*([一二三123])\s*学期/g, (_, semester: string) => seasons[semester])
    .replace(/(20\d{2}\s*[-_/]\s*20\d{2})\s*[-_/]\s*([123])$/, (_, years: string, semester: string) => `${years} ${seasons[semester]}`)
    .replace(/Fall/gi, "秋").replace(/Spring/gi, "春").replace(/Summer/gi, "夏")
    .replace(/(20\d{2})\s*[-_/]\s*(20\d{2})\s*(?:学年)?\s*([秋春夏])/, "$1-$2 $3")
    .trim();
}

function termKey(name: string): string {
  const text = normalize(normalizeVideoTermName(name));
  const years = text.match(/(20\d{2})\D*(20\d{2})/);
  const semester = text.match(/第?([一二三123])学期/)?.[1]
    ?? text.match(/20\d{2}\D*20\d{2}[-_/]([123])$/)?.[1]
    ?? (/秋/.test(text) ? "1" : /春/.test(text) ? "2" : /夏/.test(text) ? "3" : undefined);
  return years && semester
    ? `${years[1]}-${years[2]}-${({ 一: "1", 二: "2", 三: "3" } as Record<string, string>)[semester] ?? semester}`
    : text;
}

export function compareVideoCourses(a: Course, b: Course): number {
  const rank = (name: string) => {
    const match = termKey(name).match(/^(20\d{2})-(20\d{2})-([123])$/);
    return match ? Number(match[1]) * 3 + Number(match[3]) : -1;
  };
  // Academic years run autumn, spring, summer; newest semesters come first.
  return rank(b.term.name) - rank(a.term.name)
    || a.name.localeCompare(b.name, "zh-CN", { numeric: true });
}

function matches(canvas: Course, space: Course): boolean {
  const term = termKey(canvas.term.name);
  if (!term || term !== termKey(space.term.name)) return false;
  const teachers = new Set(canvas.teachers.map((teacher) => normalize(teacher.display_name)).filter(Boolean));
  const spaceTeachers = space.teachers.map((teacher) => normalize(teacher.display_name)).filter(Boolean);
  const sameTeacher = spaceTeachers.some((teacher) => teachers.has(teacher));
  if (teachers.size && spaceTeachers.length && !sameTeacher) return false;
  if (canvas.course_code && space.course_code
    && normalize(canvas.course_code) === normalize(space.course_code)) return true;
  if (normalize(canvas.name) !== normalize(space.name)) return false;
  return sameTeacher;
}

export function mergeVideoCourses(canvas: Course[], space: Course[]): VideoCourseOption[] {
  const uniqueCanvas = [...new Map(canvas.map((course) => [course.id, course])).values()];
  const uniqueSpace = [...new Map(space.map((course) => [course.id, course])).values()];
  const candidates = uniqueSpace.map((course) => uniqueCanvas.filter((other) => matches(other, course)));
  const used = new Set<number>();
  const result: VideoCourseOption[] = uniqueCanvas.map((course) => {
    // Only merge an unambiguous pair; names alone can identify different classes.
    const indexes = candidates.flatMap((items, index) => items.some((item) => item.id === course.id) ? [index] : []);
    const index = indexes.length === 1 && candidates[indexes[0]].length === 1 ? indexes[0] : undefined;
    if (index !== undefined) used.add(index);
    return {
      ...course,
      term: { ...course.term, name: normalizeVideoTermName(course.term.name) },
      canvasId: course.id,
      teachingClassId: index !== undefined ? uniqueSpace[index].id : undefined,
      sourceLabel: "",
    };
  });
  uniqueSpace.forEach((course, index) => {
    if (!used.has(index)) result.push({
      ...course, id: -course.id - 1, teachingClassId: course.id, sourceLabel: "视频空间",
      term: { ...course.term, name: normalizeVideoTermName(course.term.name) },
    });
  });
  return result;
}

export async function loadVideoCourse(
  course: VideoCourseOption,
  canvas: (id: number) => Promise<CanvasVideo[]>,
  space: (id: number) => Promise<CanvasVideo[]>,
): Promise<CanvasVideo[]> {
  const errors: string[] = [];
  if (course.canvasId !== undefined) {
    try {
      const videos = await canvas(course.canvasId);
      if (videos.length || course.teachingClassId === undefined) return videos;
    } catch (error) { errors.push(`Canvas：${String(error)}`); }
  }
  if (course.teachingClassId !== undefined) {
    try { return await space(course.teachingClassId); }
    catch (error) { errors.push(`视频空间：${String(error)}`); }
  }
  throw new Error(errors.join("；") || "课程没有可用的视频来源");
}

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import CalendarPage from "../../page/calendar";
import { finishTimetableCheck, readTimetableRecord } from "../../lib/timetable_store";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("../../lib/hooks", () => ({ useCourses: () => ({ data: [], isLoading: false, error: null, mutate: vi.fn() }) }));
vi.mock("../../lib/message", () => ({ useAppMessage: () => [mocks.message, null] }));
vi.mock("../layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocks.invoke.mockImplementation((command: string) => command === "read_account_info"
    ? Promise.resolve({ current_account: "test" }) : command === "list_personal_events"
      ? Promise.resolve([{ id: "personal-1", title: "个人会议", startAt: "2026-11-09T08:30:00.000Z",
          endAt: "2026-11-09T09:30:00.000Z", allDay: false, description: "" }])
      : command === "get_colors" ? Promise.resolve({ custom_colors: {} }) : Promise.resolve([]));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("shows cached formal lessons beside personal events in the calendar", async () => {
  finishTimetableCheck("test", 2026, 3, {
    year: 2026, term: 3, semesterStart: "2026-09-07", fetchedAt: "2026-11-05T00:00:00Z",
    lessons: [{ id: "math-1", name: "高等数学", teacher: "张老师", location: "A101", day: 1,
      periods: "1-2", weeks: "1-16周" }],
  }, "2026-11-05T00:00:00Z");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-09T04:00:00Z"));
  render(<MemoryRouter><CalendarPage /></MemoryRouter>);
  vi.useRealTimers();
  expect((await screen.findAllByText("高等数学")).length).toBeGreaterThan(0);
  expect((await screen.findAllByText("个人会议")).length).toBeGreaterThan(0);
  expect(screen.getByText(/当前学期.*已拉取/)).toBeInTheDocument();
});

it("uses the official eighth week, saves a manual correction, and jumps across dates", async () => {
  finishTimetableCheck("test", 2026, 3, {
    year: 2026, term: 3, semesterStart: "2026-09-07", fetchedAt: "2026-11-05T00:00:00Z",
    lessons: [1, 2, 3].map((number) => ({ id: `friday-${number}`, name: `Friday class ${number}`,
      teacher: "", location: "", day: 5, periods: `${number}-${number}`, weeks: "8周" })),
  }, "2026-11-05T00:00:00Z");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-06T04:00:00Z"));
  render(<MemoryRouter><CalendarPage /></MemoryRouter>);
  expect(await screen.findByText(/本周是学期第 8 周/)).toBeInTheDocument();
  expect(await screen.findByText(/当前采用 2026-09-14 作为第一周周一/)).toBeInTheDocument();
  expect(screen.getAllByText("Friday class 1").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Friday class 2").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Friday class 3").length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole("button", { name: "应用周次起点" }));
  expect(readTimetableRecord("test", 2026, 3).firstWeekMonday).toBe("2026-09-14");

  fireEvent.change(screen.getByLabelText("第一周周一"), { target: { value: "2026-09-21" } });
  expect(screen.getByRole("button", { name: "应用周次起点" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "应用周次起点" }));
  expect(screen.getByText(/本周是学期第 7 周/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "恢复参考起点" }));
  expect(screen.getByText(/本周是学期第 8 周/)).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("跳转日期"), { target: { value: "2027-03-15" } });
  fireEvent.click(screen.getByRole("button", { name: "前往日期" }));
  expect(screen.getByText("2027 年 3 月 15 日 事项")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "上个月" }));
  expect(screen.getByText("2027 年 2 月")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "后一天" }));
  expect(screen.getByText("2027 年 2 月 16 日 事项")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("跳转日期"), { target: { value: "2040-12-25" } });
  fireEvent.click(screen.getByRole("button", { name: "前往日期" }));
  expect(screen.getByText("2040 年 12 月 25 日 事项")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "年份" })).toHaveTextContent("2040 年");
});

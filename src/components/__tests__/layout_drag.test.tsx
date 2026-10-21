import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import BasicLayout from "../layout";

const mocks = vi.hoisted(() => ({ dispatch: vi.fn() }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: async () => "test" }));
vi.mock("@tauri-apps/plugin-shell", () => ({ open: vi.fn() }));
vi.mock("../../lib/hooks", () => ({
  useConfigDispatch: () => mocks.dispatch,
  useConfigSelector: (selector: (state: unknown) => unknown) => selector({
    config: { data: {} }, navigation: { visibleItemKeys: ["video", "settings"] },
  }),
}));
vi.mock("../../lib/task_hooks", () => ({ useTasks: () => [] }));
vi.mock("../../lib/task_manager", () => ({ isTaskActive: () => false, taskManager: { markCompletionsRead: vi.fn() } }));
vi.mock("../../lib/message", () => ({ useAppMessage: () => [{}, null] }));
vi.mock("../../lib/utils", () => ({ checkForUpdates: vi.fn() }));
vi.mock("../../lib/update_notice", () => ({ useUpdateNotice: () => ({ availableVersion: null, setAvailableVersion: vi.fn(), previewOnly: false }) }));
vi.mock("../change_log_modal", () => ({ ChangeLogModal: () => null }));
vi.mock("../task_popover", () => ({ default: () => null }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width:1200px"), media: query,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); mocks.dispatch.mockClear(); });

it("reorders a shortcut after a long press on its icon", async () => {
  render(<MemoryRouter><BasicLayout>内容</BasicLayout></MemoryRouter>);
  const source = screen.getByRole("link", { name: "视频管理" });
  const target = screen.getByRole("link", { name: "系统设置" });
  const icon = source.querySelector(".MuiListItemIcon-root") as HTMLElement;
  icon.setPointerCapture = vi.fn();
  fireEvent.pointerDown(icon, { pointerId: 1, button: 0, clientX: 20, clientY: 50 });
  await waitFor(() => expect(screen.getByText("拖到这里移除快捷入口")).toBeInTheDocument());
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn(() => target) });
  fireEvent.pointerMove(icon, { pointerId: 1, clientX: 20, clientY: 200 });
  fireEvent.pointerUp(icon, { pointerId: 1 });
  expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({
    type: "navigation/setVisibleItemKeys", payload: ["settings", "video"],
  }));
});

it("removes a shortcut when dropped on the visible remove area", async () => {
  render(<MemoryRouter><BasicLayout>内容</BasicLayout></MemoryRouter>);
  const source = screen.getByRole("link", { name: "视频管理" });
  const icon = source.querySelector(".MuiListItemIcon-root") as HTMLElement;
  icon.setPointerCapture = vi.fn();
  fireEvent.pointerDown(icon, { pointerId: 1, button: 0, clientX: 20, clientY: 50 });
  const remove = await screen.findByText("拖到这里移除快捷入口");
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn(() => remove) });
  fireEvent.pointerMove(icon, { pointerId: 1, clientX: 20, clientY: 120 });
  fireEvent.pointerUp(icon, { pointerId: 1 });
  expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({
    type: "navigation/setVisibleItemKeys", payload: ["settings"],
  }));
});

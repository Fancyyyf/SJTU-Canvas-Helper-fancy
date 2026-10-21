import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
  createRoot: vi.fn(),
  render: vi.fn(),
}));

vi.mock("react-dom/client", () => ({ default: { createRoot: mocks.createRoot } }));
vi.mock("../App", () => ({ default: () => null }));
vi.mock("../lib/config", () => ({ getConfig: mocks.getConfig }));
vi.mock("../lib/store", () => ({ configStore: {} }));
vi.mock("../lib/logger", () => ({ installGlobalDiagnosticHandlers: vi.fn(), logDiagnostic: vi.fn() }));

it("loads the saved palette before mounting the app", async () => {
  let finish!: () => void;
  mocks.getConfig.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
  mocks.createRoot.mockReturnValue({ render: mocks.render });
  await import("../main");
  expect(mocks.getConfig).toHaveBeenCalledOnce();
  expect(mocks.createRoot).not.toHaveBeenCalled();
  finish();
  await vi.waitFor(() => expect(mocks.render).toHaveBeenCalledOnce());
});

import { expect, it } from "vitest";
import { moveSidebarItem } from "../sidebar_order";

it("moves a shortcut before or after another without losing items", () => {
  const keys = ["agent", "files", "calendar", "settings"];
  expect(moveSidebarItem(keys, "calendar", "agent", false)).toEqual(["calendar", "agent", "files", "settings"]);
  expect(moveSidebarItem(keys, "agent", "calendar", true)).toEqual(["files", "calendar", "agent", "settings"]);
  expect(keys).toEqual(["agent", "files", "calendar", "settings"]);
});

it("leaves the list intact when a drop target is invalid", () => {
  const keys = ["agent", "calendar"];
  expect(moveSidebarItem(keys, "agent", "home", false)).toBe(keys);
});

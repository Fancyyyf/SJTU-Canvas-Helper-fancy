import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { FeatureTourDialog } from "../feature_tour_dialog";

describe("feature tour", () => {
  it("shows concise module actions and navigates through all pages", () => {
    const onClose = vi.fn();
    render(<MemoryRouter><FeatureTourDialog open onClose={onClose} /></MemoryRouter>);
    const dialog = screen.getByRole("dialog", { name: "功能使用指南" });
    expect(within(dialog).getByText("系统设置")).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "上一页" })).toBeDisabled();

    fireEvent.click(within(dialog).getByRole("button", { name: "下一页" }));
    expect(within(dialog).getByText("TODO 与提醒")).toBeVisible();
    expect(within(dialog).getByText("日程管理与课表")).toBeVisible();
    expect(within(dialog).getByText("第 2 / 5 页")).toBeVisible();

    for (let page = 3; page <= 5; page++) {
      fireEvent.click(within(dialog).getByRole("button", { name: "下一页" }));
    }
    expect(within(dialog).getByText("网页搜索")).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: "完成" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

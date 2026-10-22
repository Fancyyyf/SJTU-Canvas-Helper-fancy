import { describe, expect, it } from "vitest";
import { runLimited } from "./run_limited";

describe("runLimited", () => {
  it("keeps at most two lessons active while processing the whole batch", async () => {
    let active = 0;
    let peak = 0;
    const completed: number[] = [];
    await runLimited([0, 1, 2, 3, 4], 2, async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      completed.push(item);
      active -= 1;
    });
    expect(peak).toBe(2);
    expect(completed.sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it("does not start another lesson after stop is requested", async () => {
    let stop = false;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const started: number[] = [];
    const task = runLimited([0, 1, 2, 3], 2, async (item) => {
      started.push(item);
      await gate;
    }, () => stop);
    expect(started).toEqual([0, 1]);
    stop = true;
    release();
    await task;
    expect(started).toEqual([0, 1]);
  });
});

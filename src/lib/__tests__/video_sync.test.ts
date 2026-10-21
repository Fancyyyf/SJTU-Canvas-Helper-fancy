import { expect, it, vi } from "vitest";
import { attachSynchronizedPlayback } from "../video_sync";

function media() {
  const element = document.createElement("video");
  Object.defineProperty(element, "readyState", { configurable: true, value: 1 });
  vi.spyOn(element, "pause").mockImplementation(() => {});
  vi.spyOn(element, "play").mockResolvedValue(undefined);
  return element;
}

it("aligns both screens and mirrors seeks in either direction", () => {
  const primary = media();
  const secondary = media();
  primary.currentTime = 12;
  const detach = attachSynchronizedPlayback(primary, secondary);
  expect(secondary.currentTime).toBe(12);

  // A user can grab the secondary scrubber before the initial alignment finishes.
  secondary.currentTime = 31;
  secondary.dispatchEvent(new Event("seeking"));
  expect(primary.currentTime).toBe(31);
  primary.dispatchEvent(new Event("seeked"));
  primary.currentTime = 45;
  primary.dispatchEvent(new Event("seeking"));
  expect(secondary.currentTime).toBe(45);
  detach();
});

it("mirrors playback speed and corrects drift from the primary clock", () => {
  const primary = media();
  const secondary = media();
  const detach = attachSynchronizedPlayback(primary, secondary);
  primary.playbackRate = 1.5;
  primary.dispatchEvent(new Event("ratechange"));
  expect(secondary.playbackRate).toBe(1.5);
  primary.currentTime = 20;
  secondary.currentTime = 18;
  primary.dispatchEvent(new Event("timeupdate"));
  expect(secondary.currentTime).toBe(20);
  detach();
});

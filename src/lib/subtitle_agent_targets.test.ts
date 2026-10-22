import { describe, expect, it } from "vitest";
import { cleanedSourceAvailable, missingAgentResults } from "./subtitle_agent_targets";

const lessons = [
  { stem: "first", hasCleaned: true, hasKnowledgeRaw: true, hasKnowledgeCleaned: false },
  { stem: "second", hasCleaned: true, hasKnowledgeRaw: false, hasKnowledgeCleaned: true },
  { stem: "third", hasCleaned: false, hasKnowledgeRaw: false, hasKnowledgeCleaned: false },
];

describe("subtitle Agent existing results", () => {
  it("skips completed cleaning for one lesson and for a course batch", () => {
    expect(missingAgentResults([lessons[0]], "clean", "raw")).toEqual([]);
    expect(missingAgentResults(lessons, "clean", "raw").map((item) => item.stem)).toEqual(["third"]);
  });

  it("treats notes from raw and cleaned subtitles as separate results", () => {
    expect(missingAgentResults(lessons, "knowledge", "raw").map((item) => item.stem)).toEqual(["second", "third"]);
    expect(missingAgentResults(lessons, "knowledge", "cleaned").map((item) => item.stem)).toEqual(["first", "third"]);
  });

  it("allows cleaned input only when every pending lesson has it or already has its result", () => {
    expect(cleanedSourceAvailable(lessons)).toBe(false);
    expect(cleanedSourceAvailable(lessons.slice(0, 2))).toBe(true);
  });
});

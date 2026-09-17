import { describe, expect, it } from "vitest";

import { sanitizeDiagnosticValue } from "../logger";

describe("sanitizeDiagnosticValue", () => {
  it("redacts nested credentials while preserving useful metadata", () => {
    const result = sanitizeDiagnosticValue({
      authorization: "Bearer top-secret",
      nested: {
        apiKey: "secret-key",
        status: 401,
      },
    });

    expect(result).toEqual({
      authorization: "<redacted>",
      nested: {
        apiKey: "<redacted>",
        status: 401,
      },
    });
  });

  it("redacts secret query parameters without hiding ordinary parameters", () => {
    const result = sanitizeDiagnosticValue(
      "GET https://example.test/video.mp4?token=secret&page=2 failed"
    );

    expect(result).toContain("token=<redacted>");
    expect(result).toContain("page=2");
    expect(result).not.toContain("token=secret");
  });

  it("handles errors and circular objects safely", () => {
    const circular: Record<string, unknown> = { name: "request" };
    circular.self = circular;

    expect(sanitizeDiagnosticValue(circular)).toEqual({
      name: "request",
      self: "<circular>",
    });

    const error = sanitizeDiagnosticValue(
      new Error("Authorization: Bearer secret-token")
    ) as { message: string };
    expect(error.message).toContain("Bearer <redacted>");
    expect(error.message).not.toContain("secret-token");
  });
});

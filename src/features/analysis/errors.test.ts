import { describe, expect, it } from "vitest";

import {
  AnalysisError,
  analysisErrorStatus,
} from "@/features/analysis/errors";

describe("analysis errors", () => {
  it.each([
    ["validation", 400],
    ["unsupported_media_type", 415],
    ["payload_too_large", 413],
    ["in_progress", 202],
    ["duplicate", 409],
    ["rate_limited", 429],
    ["project_changed", 409],
    ["model_timeout", 504],
    ["model_unavailable", 503],
    ["analysis_disabled", 503],
    ["recording_unavailable", 503],
    ["fallback_unavailable", 503],
    ["fallback_quota_exhausted", 503],
    ["model_refusal", 422],
    ["model_invalid", 422],
    ["persistence", 503],
  ] as const)("maps %s to a safe status", (code, expectedStatus) => {
    const error = new AnalysisError(code);

    expect(analysisErrorStatus(error)).toBe(expectedStatus);
    expect(error.message).not.toContain("database");
    expect(error.message).not.toContain("API key");
  });

  it("does not include an internal cause in its response body", () => {
    const error = new AnalysisError(
      "persistence",
      undefined,
      new Error("private database host and token"),
    );

    expect(error.toResponseBody()).toEqual({
      error: {
        code: "persistence",
        message: "The analysis could not be saved. Try again safely.",
      },
    });
    expect(JSON.stringify(error.toResponseBody())).not.toContain("private");
  });

  it.each([
    "analysis_disabled",
    "recording_unavailable",
    "fallback_unavailable",
    "fallback_quota_exhausted",
  ] as const)("keeps %s database details out of the response body", (code) => {
    const privateDetail = "private database host and service-role token";
    const error = new AnalysisError(code, undefined, new Error(privateDetail));

    expect(analysisErrorStatus(error)).toBe(503);
    expect(JSON.stringify(error.toResponseBody())).not.toContain(privateDetail);
  });
});

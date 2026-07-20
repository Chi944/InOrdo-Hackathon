import { describe, expect, it } from "vitest";

import {
  AnalysisError,
  analysisErrorStatus,
} from "@/features/analysis/errors";

describe("analysis errors", () => {
  it.each([
    [
      "analysis_disabled",
      "Live AI analysis is disabled in this public demo to protect the operator's API budget. No OpenAI request was made and no project data changed. You can inspect the verified synthetic result and non-model project controls. To run a new analysis, deploy InOrdo with your own OpenAI API project and key.",
    ],
    [
      "recording_unavailable",
      "The approved GPT-5.6 recording window is unavailable. No model request was made and no project data changed.",
    ],
    [
      "fallback_unavailable",
      "Free fallback analysis is not configured for this deployment. No paid OpenAI request was made and no project data changed. You can inspect the verified synthetic result or deploy InOrdo with your own provider credentials.",
    ],
    [
      "fallback_quota_exhausted",
      "Free fallback analysis is unavailable because its capped allowance has been exhausted. No paid OpenAI request was made, and no project item or proposal changed. The submitted source remains immutable evidence with a failed analysis status.",
    ],
  ] as const)("uses the approved non-retry-promoting copy for %s", (code, message) => {
    const error = new AnalysisError(code);

    expect(error.message).toBe(message);
    expect(error.toResponseBody()).toEqual({
      error: { code, message },
    });
    expect(error.message).not.toMatch(/try again|retry/i);
  });

  it.each([
    [
      "model_timeout",
      "The analysis timed out after the source was preserved. Immutable evidence and a failed analysis status may remain, but no project item or proposal changed.",
    ],
    [
      "model_unavailable",
      "The analysis provider became unavailable after the source was preserved. Immutable evidence and a failed analysis status may remain, but no project item or proposal changed.",
    ],
    [
      "model_refusal",
      "The provider could not analyze the update safely after the source was preserved. Immutable evidence and a failed analysis status may remain, but no project item or proposal changed.",
    ],
    [
      "model_invalid",
      "The analysis output could not be validated after the source was preserved. Immutable evidence and a failed analysis status may remain, but no project item or proposal changed.",
    ],
  ] as const)("explains the post-claim state for %s", (code, message) => {
    expect(new AnalysisError(code).message).toBe(message);
  });

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

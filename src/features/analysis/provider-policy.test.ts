import { describe, expect, it } from "vitest";

import {
  buildAnalysisAvailability,
  type AnalysisProviderPolicy,
} from "@/features/analysis/provider-policy";

describe("analysis provider policy", () => {
  it.each([
    [
      { mode: "recording", recordingReady: true, gatewayReady: false },
      "recording_configured",
    ],
    [
      { mode: "recording", recordingReady: false, gatewayReady: false },
      "recording_unavailable",
    ],
    [
      { mode: "auto", recordingReady: false, gatewayReady: true },
      "fallback_configured",
    ],
    [
      { mode: "auto", recordingReady: false, gatewayReady: false },
      "fallback_unavailable",
    ],
    [
      { mode: "disabled", recordingReady: false, gatewayReady: false },
      "disabled",
    ],
  ] as const)("maps %j to %s", (partialPolicy, expected) => {
    const policy: AnalysisProviderPolicy = {
      ...partialPolicy,
      recordingModelName: "gpt-5.6-luna",
      gatewayModelName: "openai/gpt-oss-20b",
    };

    expect(buildAnalysisAvailability(policy).status).toBe(expected);
  });

  it("describes disabled analysis without claiming project unavailability", () => {
    expect(
      buildAnalysisAvailability({
        mode: "disabled",
        recordingReady: false,
        gatewayReady: false,
        recordingModelName: "gpt-5.6-luna",
        gatewayModelName: "openai/gpt-oss-20b",
      }),
    ).toEqual({
      mode: "disabled",
      status: "disabled",
      canAnalyze: false,
      provider: null,
      model: null,
      message:
        "Live AI analysis is disabled. Preserved synthetic results remain available for review.",
    });
  });
});

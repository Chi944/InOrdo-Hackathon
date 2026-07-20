export const analysisModes = ["recording", "auto", "disabled"] as const;
export type AnalysisMode = (typeof analysisModes)[number];

export const recordingModels = ["gpt-5.6-luna"] as const;
export type RecordingModel = (typeof recordingModels)[number];

export const gatewayModels = ["openai/gpt-oss-20b"] as const;
export type GatewayModel = (typeof gatewayModels)[number];

export type AnalysisProviderRoute =
  | "openai_recording"
  | "gateway_fallback";

export type AnalysisProviderPolicy = {
  mode: AnalysisMode;
  recordingReady: boolean;
  gatewayReady: boolean;
  recordingModelName: RecordingModel;
  gatewayModelName: GatewayModel;
};

export type AnalysisAvailability =
  | {
      mode: "recording";
      status: "recording_configured";
      canAnalyze: true;
      provider: "OpenAI";
      model: RecordingModel;
      message: string;
    }
  | {
      mode: "recording";
      status: "recording_unavailable";
      canAnalyze: false;
      provider: null;
      model: null;
      message: string;
    }
  | {
      mode: "auto";
      status: "fallback_configured";
      canAnalyze: true;
      provider: "Vercel AI Gateway";
      model: GatewayModel;
      message: string;
    }
  | {
      mode: "auto";
      status: "fallback_unavailable";
      canAnalyze: false;
      provider: null;
      model: null;
      message: string;
    }
  | {
      mode: "disabled";
      status: "disabled";
      canAnalyze: false;
      provider: null;
      model: null;
      message: string;
    };

export function buildAnalysisAvailability(
  policy: AnalysisProviderPolicy,
): AnalysisAvailability {
  if (policy.mode === "recording") {
    return policy.recordingReady
      ? {
          mode: policy.mode,
          status: "recording_configured",
          canAnalyze: true,
          provider: "OpenAI",
          model: policy.recordingModelName,
          message:
            "An approved GPT-5.6 recording window is configured. The exact grant is checked only when the source is submitted.",
        }
      : {
          mode: policy.mode,
          status: "recording_unavailable",
          canAnalyze: false,
          provider: null,
          model: null,
          message:
            "The approved GPT-5.6 recording window is unavailable. No model request will be made.",
        };
  }

  if (policy.mode === "auto") {
    return policy.gatewayReady
      ? {
          mode: policy.mode,
          status: "fallback_configured",
          canAnalyze: true,
          provider: "Vercel AI Gateway",
          model: policy.gatewayModelName,
          message:
            "The capped GPT-OSS fallback is available for authorized contributors.",
        }
      : {
          mode: policy.mode,
          status: "fallback_unavailable",
          canAnalyze: false,
          provider: null,
          model: null,
          message:
            "The capped fallback is unavailable. No model request will be made.",
        };
  }

  return {
    mode: "disabled",
    status: "disabled",
    canAnalyze: false,
    provider: null,
    model: null,
    message:
      "Live AI analysis is disabled. Preserved synthetic results remain available for review.",
  };
}

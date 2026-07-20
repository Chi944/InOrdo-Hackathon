export type AnalysisErrorCode =
  | "validation"
  | "unsupported_media_type"
  | "payload_too_large"
  | "in_progress"
  | "duplicate"
  | "rate_limited"
  | "project_changed"
  | "model_timeout"
  | "model_unavailable"
  | "analysis_disabled"
  | "recording_unavailable"
  | "fallback_unavailable"
  | "fallback_quota_exhausted"
  | "model_refusal"
  | "model_invalid"
  | "persistence";

const safeMessages: Record<AnalysisErrorCode, string> = {
  validation: "Check the submitted project update.",
  unsupported_media_type: "Send the project update as JSON.",
  payload_too_large: "The analysis request is too large.",
  in_progress: "This project update is already being analyzed.",
  duplicate: "This project update has already been analyzed at this project version.",
  rate_limited: "Too many new analyses were requested. Try again shortly.",
  project_changed: "The project changed during analysis. Review it and try again.",
  model_timeout:
    "The analysis timed out after the source was preserved. Immutable evidence and a failed analysis status may remain, but no project item or proposal changed.",
  model_unavailable:
    "The analysis provider became unavailable after the source was preserved. Immutable evidence and a failed analysis status may remain, but no project item or proposal changed.",
  analysis_disabled:
    "Live AI analysis is disabled in this public demo to protect the operator's API budget. No OpenAI request was made and no project data changed. You can inspect the verified synthetic result and non-model project controls. To run a new analysis, deploy InOrdo with your own OpenAI API project and key.",
  recording_unavailable:
    "The approved GPT-5.6 recording window is unavailable. No model request was made and no project data changed.",
  fallback_unavailable:
    "Free fallback analysis is not configured for this deployment. No paid OpenAI request was made and no project data changed. You can inspect the verified synthetic result or deploy InOrdo with your own provider credentials.",
  fallback_quota_exhausted:
    "Free fallback analysis is unavailable because its capped allowance has been exhausted. No paid OpenAI request was made, and no project item or proposal changed. The submitted source remains immutable evidence with a failed analysis status.",
  model_refusal:
    "The provider could not analyze the update safely after the source was preserved. Immutable evidence and a failed analysis status may remain, but no project item or proposal changed.",
  model_invalid:
    "The analysis output could not be validated after the source was preserved. Immutable evidence and a failed analysis status may remain, but no project item or proposal changed.",
  persistence: "The analysis could not be saved. Try again safely.",
};

const errorStatuses: Record<AnalysisErrorCode, number> = {
  validation: 400,
  unsupported_media_type: 415,
  payload_too_large: 413,
  in_progress: 202,
  duplicate: 409,
  rate_limited: 429,
  project_changed: 409,
  model_timeout: 504,
  model_unavailable: 503,
  analysis_disabled: 503,
  recording_unavailable: 503,
  fallback_unavailable: 503,
  fallback_quota_exhausted: 503,
  model_refusal: 422,
  model_invalid: 422,
  persistence: 503,
};

export class AnalysisError extends Error {
  readonly code: AnalysisErrorCode;
  readonly retryAfterSeconds: number | null;

  constructor(
    code: AnalysisErrorCode,
    message = safeMessages[code],
    cause?: unknown,
    retryAfterSeconds?: number,
  ) {
    super(message, { cause });
    this.name = "AnalysisError";
    this.code = code;
    this.retryAfterSeconds =
      Number.isSafeInteger(retryAfterSeconds) &&
      (retryAfterSeconds ?? 0) >= 1 &&
      (retryAfterSeconds ?? 0) <= 600
        ? (retryAfterSeconds ?? null)
        : null;
  }

  toResponseBody() {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }
}

export function analysisErrorStatus(error: AnalysisError): number {
  return errorStatuses[error.code];
}

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
  model_timeout: "The analysis timed out before completion. Try again safely.",
  model_unavailable: "The analysis service is temporarily unavailable.",
  model_refusal: "The update could not be analyzed safely.",
  model_invalid: "The analysis result could not be validated safely.",
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

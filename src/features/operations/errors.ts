export type OperationErrorCode =
  | "validation"
  | "payload_too_large"
  | "forbidden"
  | "conflict"
  | "rate_limited"
  | "persistence"
  | "reset_unavailable";

export type OperationConflictDetail = {
  itemId: string;
  expectedVersion: number;
  actualVersion: number | null;
  reason: "item_missing" | "version_mismatch" | "state_mismatch";
};

export type OperationErrorDetails = {
  conflicts: OperationConflictDetail[];
};

const safeMessages: Record<OperationErrorCode, string> = {
  validation: "The operation request is invalid.",
  payload_too_large: "The operation request is too large.",
  forbidden: "You are not allowed to perform this operation.",
  conflict: "The project changed before the operation could be completed.",
  rate_limited: "Please wait before resetting the demo again.",
  persistence: "The operation could not be completed.",
  reset_unavailable: "Demo reset is not available.",
};

const safeStatuses = {
  validation: 400,
  payload_too_large: 413,
  forbidden: 403,
  conflict: 409,
  rate_limited: 429,
  persistence: 500,
  reset_unavailable: 404,
} as const satisfies Record<OperationErrorCode, number>;

export class OperationError extends Error {
  constructor(
    public readonly code: OperationErrorCode,
    public readonly details?: OperationErrorDetails,
  ) {
    super(safeMessages[code]);
    this.name = "OperationError";
  }
}

export function operationErrorStatus(error: OperationError) {
  return safeStatuses[error.code];
}

export type ProjectRecordErrorCode =
  | "validation"
  | "conflict"
  | "invalid_reference"
  | "forbidden"
  | "not_found"
  | "internal";

const errorStatus = {
  validation: 400,
  conflict: 409,
  invalid_reference: 400,
  forbidden: 403,
  not_found: 404,
  internal: 500,
} as const satisfies Record<ProjectRecordErrorCode, number>;

export class ProjectRecordError extends Error {
  readonly code: ProjectRecordErrorCode;
  readonly status: (typeof errorStatus)[ProjectRecordErrorCode];

  constructor(code: ProjectRecordErrorCode, message: string) {
    super(message);
    this.name = "ProjectRecordError";
    this.code = code;
    this.status = errorStatus[code];
  }
}

type DatabaseErrorShape = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const mappedDatabaseErrors = {
  "23503": [
    "invalid_reference",
    "A selected project record is no longer available.",
  ],
  "23505": [
    "conflict",
    "A project record with those identifying values already exists.",
  ],
  "23514": [
    "validation",
    "The project record does not satisfy the required rules.",
  ],
  "42501": ["forbidden", "You do not have permission to change this project."],
} as const satisfies Record<
  string,
  readonly [ProjectRecordErrorCode, string]
>;

function isMappedDatabaseCode(
  code: string,
): code is keyof typeof mappedDatabaseErrors {
  return Object.hasOwn(mappedDatabaseErrors, code);
}

export function mapProjectRecordDatabaseError(
  error: DatabaseErrorShape,
): ProjectRecordError {
  const mapped =
    error.code && isMappedDatabaseCode(error.code)
      ? mappedDatabaseErrors[error.code]
      : undefined;

  if (mapped) {
    return new ProjectRecordError(mapped[0], mapped[1]);
  }

  return new ProjectRecordError(
    "internal",
    "The project record could not be saved. Please try again.",
  );
}

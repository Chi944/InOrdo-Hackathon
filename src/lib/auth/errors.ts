export type AuthorizationErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found";

export type AuthorizationStatus = 401 | 403 | 404;

const messages: Record<AuthorizationErrorCode, string> = {
  unauthenticated: "Authentication is required.",
  forbidden: "You do not have permission to perform this action.",
  not_found: "The requested resource was not found.",
};

const statuses: Record<AuthorizationErrorCode, AuthorizationStatus> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
};

export class AuthorizationError extends Error {
  readonly code: AuthorizationErrorCode;
  readonly status: AuthorizationStatus;

  constructor(code: AuthorizationErrorCode) {
    super(messages[code]);
    this.name = "AuthorizationError";
    this.code = code;
    this.status = statuses[code];
  }
}

export function mapAuthorizationError(error: unknown) {
  if (error instanceof AuthorizationError) {
    return {
      status: error.status,
      body: { error: error.code, message: error.message },
    } as const;
  }

  return {
    status: 500,
    body: {
      error: "internal_error",
      message: "The request could not be completed.",
    },
  } as const;
}

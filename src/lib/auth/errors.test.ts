import { describe, expect, it } from "vitest";

import {
  AuthorizationError,
  mapAuthorizationError,
} from "@/lib/auth/errors";

describe("mapAuthorizationError", () => {
  it.each([
    ["unauthenticated", 401],
    ["forbidden", 403],
    ["not_found", 404],
  ] as const)("maps %s without internal details", (code, status) => {
    const result = mapAuthorizationError(new AuthorizationError(code));
    expect(result.status).toBe(status);
    expect(result.body.error).toBe(code);
    expect(result.body.message).not.toMatch(/database|supabase|tenant/i);
  });

  it("hides unknown failure details", () => {
    expect(mapAuthorizationError(new Error("private database detail"))).toEqual({
      status: 500,
      body: {
        error: "internal_error",
        message: "The request could not be completed.",
      },
    });
  });
});

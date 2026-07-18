import { describe, expect, it } from "vitest";

import { shouldRotateOperationIdempotencyKey } from "@/app/app/operation-idempotency";

describe("operation idempotency response policy", () => {
  it("rotates after definitive client failures but retains a key for ambiguous server outcomes", () => {
    expect(shouldRotateOperationIdempotencyKey(400)).toBe(true);
    expect(shouldRotateOperationIdempotencyKey(409)).toBe(true);
    expect(shouldRotateOperationIdempotencyKey(429)).toBe(true);
    expect(shouldRotateOperationIdempotencyKey(500)).toBe(false);
    expect(shouldRotateOperationIdempotencyKey(503)).toBe(false);
  });
});

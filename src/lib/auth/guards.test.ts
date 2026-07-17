import { describe, expect, it, vi } from "vitest";

import type { ServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { requireUser } from "@/lib/auth/guards";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function clientWithClaims(claims: Record<string, unknown>) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: { claims },
        error: null,
      }),
    },
  } as unknown as ServerSupabaseClient;
}

describe("requireUser", () => {
  it("accepts a validated non-anonymous authenticated identity", async () => {
    await expect(
      requireUser(
        clientWithClaims({
          sub: userId,
          email: "demo@example.test",
          role: "authenticated",
          is_anonymous: false,
        }),
      ),
    ).resolves.toEqual({ id: userId, email: "demo@example.test" });
  });

  it("rejects an anonymous identity", async () => {
    await expect(
      requireUser(
        clientWithClaims({
          sub: userId,
          role: "authenticated",
          is_anonymous: true,
        }),
      ),
    ).rejects.toMatchObject({ code: "unauthenticated", status: 401 });
  });

  it("rejects a token outside the authenticated role", async () => {
    await expect(
      requireUser(
        clientWithClaims({
          sub: userId,
          role: "service_role",
          is_anonymous: false,
        }),
      ),
    ).rejects.toMatchObject({ code: "unauthenticated", status: 401 });
  });
});

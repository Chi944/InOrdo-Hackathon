import { describe, expect, it, vi } from "vitest";

import type { ServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

import {
  requireCurrentUserProjectAccess,
  requireUser,
} from "@/lib/auth/guards";

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

describe("requireCurrentUserProjectAccess", () => {
  it("binds project authorization to the verified claim subject", async () => {
    const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
    const workspaceId = "166645ec-1ab3-48dc-98c7-3b6f99b70301";
    const membershipEqual = vi.fn();
    const projectBuilder = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: projectId, workspace_id: workspaceId },
        error: null,
      }),
    };
    projectBuilder.select.mockReturnValue(projectBuilder);
    projectBuilder.eq.mockReturnValue(projectBuilder);
    const membershipBuilder = {
      select: vi.fn(),
      eq: membershipEqual,
      maybeSingle: vi.fn().mockResolvedValue({
        data: { workspace_id: workspaceId, user_id: userId, role: "member" },
        error: null,
      }),
    };
    membershipBuilder.select.mockReturnValue(membershipBuilder);
    membershipEqual.mockReturnValue(membershipBuilder);
    const client = {
      auth: clientWithClaims({
        sub: userId,
        email: "demo@example.test",
        role: "authenticated",
        is_anonymous: false,
      }).auth,
      from: vi.fn((table: string) =>
        table === "projects" ? projectBuilder : membershipBuilder,
      ),
    } as unknown as ServerSupabaseClient;

    await expect(
      requireCurrentUserProjectAccess(client, projectId),
    ).resolves.toMatchObject({
      user: { id: userId },
      scope: { workspaceId, projectId, membership: { userId } },
    });
    expect(membershipEqual).toHaveBeenCalledWith("user_id", userId);
  });
});

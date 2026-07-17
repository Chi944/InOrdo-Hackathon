import { describe, expect, it, vi } from "vitest";

import {
  getRequiredMembership,
  requireWorkspaceRole,
} from "@/lib/auth/membership";

const member = {
  workspaceId: "workspace-a",
  userId: "user-a",
  role: "member" as const,
};

describe("workspace membership", () => {
  it("returns the bounded lookup result", async () => {
    const lookup = vi.fn().mockResolvedValue(member);
    await expect(
      getRequiredMembership("workspace-a", "user-a", lookup),
    ).resolves.toEqual(member);
    expect(lookup).toHaveBeenCalledWith("workspace-a", "user-a");
  });

  it("uses not-found for a non-member", async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    await expect(
      getRequiredMembership("workspace-b", "user-a", lookup),
    ).rejects.toMatchObject({ code: "not_found", status: 404 });
  });

  it("denies roles outside the explicit set", () => {
    expect(() => requireWorkspaceRole(member, ["owner", "admin"])).toThrow(
      expect.objectContaining({ code: "forbidden", status: 403 }),
    );
  });
});

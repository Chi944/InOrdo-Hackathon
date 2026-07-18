import { AuthorizationError } from "@/lib/auth/errors";
import type { Enums } from "@/types/database";

export type WorkspaceRole = Enums<"workspace_role">;

export type WorkspaceMembership = {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
};

export type MembershipLookup = (
  workspaceId: string,
  userId: string,
) => Promise<WorkspaceMembership | null>;

export async function getRequiredMembership(
  workspaceId: string,
  userId: string,
  lookup: MembershipLookup,
): Promise<WorkspaceMembership> {
  const membership = await lookup(workspaceId, userId);

  if (!membership) {
    // Do not reveal whether another tenant's workspace exists.
    throw new AuthorizationError("not_found");
  }

  return membership;
}

export function requireWorkspaceRole(
  membership: WorkspaceMembership,
  allowedRoles: readonly WorkspaceRole[],
): WorkspaceMembership {
  if (!allowedRoles.includes(membership.role)) {
    throw new AuthorizationError("forbidden");
  }

  return membership;
}

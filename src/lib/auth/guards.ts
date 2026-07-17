import "server-only";

import { z } from "zod";

import { AuthorizationError } from "@/lib/auth/errors";
import {
  getRequiredMembership,
  requireWorkspaceRole,
  type WorkspaceMembership,
  type WorkspaceRole,
} from "@/lib/auth/membership";
import {
  createServerSupabaseClient,
  type ServerSupabaseClient,
} from "@/lib/supabase/server";

const userIdSchema = z.string().uuid();

export const workspaceReadRoles = [
  "owner",
  "admin",
  "member",
  "viewer",
] as const satisfies readonly WorkspaceRole[];

export const workspaceContributorRoles = [
  "owner",
  "admin",
  "member",
] as const satisfies readonly WorkspaceRole[];

export const workspaceAdministratorRoles = [
  "owner",
  "admin",
] as const satisfies readonly WorkspaceRole[];

export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

export type AuthorizedProjectScope = {
  workspaceId: string;
  projectId: string;
  membership: WorkspaceMembership;
};

export async function requireUser(
  client?: ServerSupabaseClient,
): Promise<AuthenticatedUser> {
  const supabase = client ?? (await createServerSupabaseClient());
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const parsedUserId = userIdSchema.safeParse(claims?.sub);

  if (
    error ||
    !parsedUserId.success ||
    claims?.role !== "authenticated" ||
    claims.is_anonymous === true
  ) {
    throw new AuthorizationError("unauthenticated");
  }

  const email = claims.email;

  return {
    id: parsedUserId.data,
    email: typeof email === "string" ? email : null,
  };
}

export async function requireWorkspaceMember(
  client: ServerSupabaseClient,
  userId: string,
  workspaceId: string,
): Promise<WorkspaceMembership> {
  return getRequiredMembership(workspaceId, userId, async () => {
    const { data, error } = await client
      .from("workspace_members")
      .select("workspace_id,user_id,role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error("Workspace membership lookup failed.");
    }

    if (!data) {
      return null;
    }

    return {
      workspaceId: data.workspace_id,
      userId: data.user_id,
      role: data.role,
    };
  });
}

export function requireRole(
  membership: WorkspaceMembership,
  allowedRoles: readonly WorkspaceRole[],
): WorkspaceMembership {
  return requireWorkspaceRole(membership, allowedRoles);
}

export async function requireProjectToWorkspace(
  client: ServerSupabaseClient,
  userId: string,
  workspaceId: string,
  projectId: string,
  allowedRoles: readonly WorkspaceRole[] = workspaceReadRoles,
): Promise<AuthorizedProjectScope> {
  const membership = requireRole(
    await requireWorkspaceMember(client, userId, workspaceId),
    allowedRoles,
  );

  const { data, error } = await client
    .from("projects")
    .select("id,workspace_id")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error("Project authorization lookup failed.");
  }

  if (!data) {
    throw new AuthorizationError("not_found");
  }

  return {
    workspaceId: data.workspace_id,
    projectId: data.id,
    membership,
  };
}

export async function requireProjectAccess(
  client: ServerSupabaseClient,
  userId: string,
  projectId: string,
  allowedRoles: readonly WorkspaceRole[] = workspaceReadRoles,
): Promise<AuthorizedProjectScope> {
  const { data, error } = await client
    .from("projects")
    .select("id,workspace_id")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new Error("Project authorization lookup failed.");
  }

  if (!data) {
    throw new AuthorizationError("not_found");
  }

  const membership = requireRole(
    await requireWorkspaceMember(client, userId, data.workspace_id),
    allowedRoles,
  );

  return {
    workspaceId: data.workspace_id,
    projectId: data.id,
    membership,
  };
}

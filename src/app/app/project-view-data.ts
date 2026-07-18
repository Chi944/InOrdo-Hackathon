import "server-only";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { createProjectRecordOperations } from "@/features/project-records/operations";
import { AuthorizationError } from "@/lib/auth/errors";
import {
  requireProjectToWorkspace,
  requireUser,
} from "@/lib/auth/guards";
import {
  getDemoWorkspaceProject,
  getItemAndDependencies,
  getProjectOverview,
  listProjectItems,
} from "@/lib/repositories/project-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const itemIdSchema = z.uuid();

async function resolveDemoProjectContext() {
  try {
    const client = await createServerSupabaseClient();
    const user = await requireUser(client);
    const demoProject = await getDemoWorkspaceProject(client);
    const scope = await requireProjectToWorkspace(
      client,
      user.id,
      demoProject.workspace_id,
      demoProject.id,
    );

    return { client, scope };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "unauthenticated") {
        redirect("/login?next=/app");
      }
      if (error.code === "not_found") {
        notFound();
      }
    }
    throw error;
  }
}

export async function loadProjectViewData() {
  const { client, scope } = await resolveDemoProjectContext();
  const projectRecords = createProjectRecordOperations({ client });
  const [overview, displayItems, itemPage, dependencies] = await Promise.all([
    getProjectOverview(client, scope),
    listProjectItems(client, scope, { limit: 100 }),
    projectRecords.listItems(scope.projectId, { limit: 100 }),
    projectRecords.listDependencies(scope.projectId),
  ]);

  const displayById = new Map(
    displayItems.data.map((item) => [item.id, item] as const),
  );
  const items = itemPage.items.map((item) => ({
    ...item,
    owner: displayById.get(item.id)?.owner ?? null,
  }));
  const memberOptions = [
    ...new Map(
      items.flatMap((item) => {
        if (!item.owner_id || !item.owner?.display_name) return [];
        return [
          [
            item.owner_id,
            { id: item.owner_id, name: item.owner.display_name },
          ] as const,
        ];
      }),
    ).values(),
  ].sort((left, right) => left.name.localeCompare(right.name));

  return {
    overview,
    items,
    dependencies,
    memberOptions,
    role: scope.membership.role,
  };
}

export async function loadProjectItemView(itemId: string) {
  if (!itemIdSchema.safeParse(itemId).success) {
    notFound();
  }

  const { client, scope } = await resolveDemoProjectContext();
  const projectRecords = createProjectRecordOperations({ client });
  const [overview, displayItems, itemPage, dependencies, detail] =
    await Promise.all([
      getProjectOverview(client, scope),
      listProjectItems(client, scope, { limit: 100 }),
      projectRecords.listItems(scope.projectId, { limit: 100 }),
      projectRecords.listDependencies(scope.projectId),
      getItemAndDependencies(client, scope, itemId),
    ]);

  const displayById = new Map(
    displayItems.data.map((item) => [item.id, item] as const),
  );
  const items = itemPage.items.map((item) => ({
    ...item,
    owner: displayById.get(item.id)?.owner ?? null,
  }));
  const item = items.find((candidate) => candidate.id === itemId);

  if (!item) {
    notFound();
  }

  const memberOptions = [
    ...new Map(
      items.flatMap((candidate) => {
        if (!candidate.owner_id || !candidate.owner?.display_name) return [];
        return [
          [
            candidate.owner_id,
            { id: candidate.owner_id, name: candidate.owner.display_name },
          ] as const,
        ];
      }),
    ).values(),
  ].sort((left, right) => left.name.localeCompare(right.name));

  return {
    overview,
    items,
    item,
    dependencies,
    prerequisites: detail.prerequisites,
    dependents: detail.dependents,
    memberOptions,
    role: scope.membership.role,
  };
}

import "server-only";

import { impactTraversalOutputSchema } from "@/features/impact/schemas";
import { traverseImpactGraph } from "@/features/impact/traverse";
import type {
  DependencyEdge,
  ImpactTraversalInput,
  ImpactTraversalOutput,
} from "@/features/impact/types";
import type { AuthorizedProjectScope } from "@/lib/auth/guards";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

export const activeItemStatuses = [
  "not_started",
  "in_progress",
  "blocked",
  "at_risk",
] as const;

export const maxProjectGraphItems = 500;
export const maxProjectGraphDependencies = 2_000;
const dependencyPageSize = 500;

export class ImpactGraphLoadError extends Error {
  constructor() {
    super("The project dependency graph could not be loaded.");
    this.name = "ImpactGraphLoadError";
  }
}

export interface ProjectGraphSource {
  listActiveItemIds(scope: AuthorizedProjectScope): Promise<string[]>;
  listDependencies(scope: AuthorizedProjectScope): Promise<DependencyEdge[]>;
}

function createSupabaseProjectGraphSource(
  client: ServerSupabaseClient,
): ProjectGraphSource {
  return {
    async listActiveItemIds(scope) {
      const { data, error } = await client
        .from("project_items")
        .select("id")
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .in("status", activeItemStatuses)
        .order("id")
        .limit(maxProjectGraphItems + 1);

      if (error) throw new ImpactGraphLoadError();
      const items = data ?? [];
      if (items.length > maxProjectGraphItems) {
        throw new ImpactGraphLoadError();
      }

      return items.map((item) => item.id);
    },

    async listDependencies(scope) {
      const dependencyFetchLimit = maxProjectGraphDependencies + 1;
      const rows: Array<{
        from_item_id: string;
        to_item_id: string;
        relationship: DependencyEdge["relationship"];
      }> = [];

      for (
        let offset = 0;
        offset < dependencyFetchLimit;
        offset += dependencyPageSize
      ) {
        const lastIndex = Math.min(
          offset + dependencyPageSize - 1,
          dependencyFetchLimit - 1,
        );
        const { data, error } = await client
          .from("item_dependencies")
          .select("from_item_id,to_item_id,relationship")
          .eq("workspace_id", scope.workspaceId)
          .eq("project_id", scope.projectId)
          .order("to_item_id")
          .order("from_item_id")
          .order("relationship")
          .range(offset, lastIndex);

        if (error) throw new ImpactGraphLoadError();
        const page = data ?? [];
        rows.push(...page);

        if (rows.length > maxProjectGraphDependencies) {
          throw new ImpactGraphLoadError();
        }
        if (page.length < lastIndex - offset + 1) break;
      }

      return rows.map((dependency) => ({
        fromItemId: dependency.from_item_id,
        toItemId: dependency.to_item_id,
        relationship: dependency.relationship,
      }));
    },
  };
}

type ProjectImpactGraphInput = Pick<
  ImpactTraversalInput,
  "changedItemId" | "maxDepth"
>;

export async function loadProjectImpactGraph(
  client: ServerSupabaseClient,
  scope: AuthorizedProjectScope,
  input: ProjectImpactGraphInput,
  source: ProjectGraphSource = createSupabaseProjectGraphSource(client),
): Promise<ImpactTraversalOutput> {
  const [activeItemIds, dependencies] = await Promise.all([
    source.listActiveItemIds(scope),
    source.listDependencies(scope),
  ]);

  if (
    activeItemIds.length > maxProjectGraphItems ||
    dependencies.length > maxProjectGraphDependencies
  ) {
    throw new ImpactGraphLoadError();
  }

  if (activeItemIds.length === 0) {
    return impactTraversalOutputSchema.parse({
      changedItemId: input.changedItemId,
      impacts: [],
    });
  }

  return traverseImpactGraph({
    changedItemId: input.changedItemId,
    items: activeItemIds.map((id) => ({ id, active: true })),
    dependencies,
    maxDepth: input.maxDepth,
  });
}

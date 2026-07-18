import "server-only";

import { createHash } from "node:crypto";

import type { DependencyEdge, ImpactGraphItem } from "@/features/impact/types";
import type { AuthorizedProjectScope } from "@/lib/auth/guards";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export const maxAnalysisContextItems = 200;
export const maxAnalysisContextDependencies = 1_000;

const dependencyPageSize = 500;
const analysisContextItemSelector =
  "id,item_key,item_type,title,description,status,priority,owner_id,start_date,due_date,event_date,version" as const;
const analysisContextDependencySelector =
  "from_item_id,to_item_id,relationship" as const;

export const analysisContextActiveItemStatuses = [
  "not_started",
  "in_progress",
  "blocked",
  "at_risk",
] as const satisfies readonly Enums<"project_item_status">[];

export type AnalysisContextItem = {
  id: string;
  itemKey: string;
  itemType: Enums<"project_item_type">;
  title: string;
  description: string | null;
  status: Enums<"project_item_status">;
  priority: Enums<"item_priority">;
  ownerId: string | null;
  startDate: string | null;
  dueDate: string | null;
  eventDate: string | null;
  version: number;
};

export type ProjectAnalysisContext = {
  revision: string;
  items: AnalysisContextItem[];
  graph: {
    items: ImpactGraphItem[];
    dependencies: DependencyEdge[];
  };
};

export interface ProjectAnalysisContextSource {
  listActiveItems(scope: AuthorizedProjectScope): Promise<AnalysisContextItem[]>;
  listDependencies(scope: AuthorizedProjectScope): Promise<DependencyEdge[]>;
}

export class ProjectAnalysisContextError extends Error {
  constructor() {
    super("The project analysis context could not be loaded.");
    this.name = "ProjectAnalysisContextError";
  }
}

function compareStrings(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareContextItems(
  left: AnalysisContextItem,
  right: AnalysisContextItem,
) {
  return compareStrings(left.id, right.id);
}

function compareDependencies(left: DependencyEdge, right: DependencyEdge) {
  return (
    compareStrings(left.toItemId, right.toItemId) ||
    compareStrings(left.fromItemId, right.fromItemId) ||
    compareStrings(left.relationship, right.relationship)
  );
}

function dependencyIdentity(edge: DependencyEdge) {
  return JSON.stringify([
    edge.fromItemId,
    edge.toItemId,
    edge.relationship,
  ]);
}

function normalizeDependencies(
  dependencies: readonly DependencyEdge[],
  activeItemIds: ReadonlySet<string>,
) {
  const seen = new Set<string>();
  const normalized: DependencyEdge[] = [];

  for (const dependency of dependencies) {
    if (
      dependency.fromItemId === dependency.toItemId ||
      !activeItemIds.has(dependency.fromItemId) ||
      !activeItemIds.has(dependency.toItemId)
    ) {
      continue;
    }

    const identity = dependencyIdentity(dependency);
    if (seen.has(identity)) continue;
    seen.add(identity);
    normalized.push({ ...dependency });
  }

  return normalized.sort(compareDependencies);
}

export function computeImpactGraphRevision(
  items: readonly AnalysisContextItem[],
  dependencies: readonly DependencyEdge[],
) {
  const activeItemIds = new Set(items.map(({ id }) => id));
  const itemVersions = items
    .map(({ id, version }) => [id, version] as const)
    .sort(([leftId, leftVersion], [rightId, rightVersion]) =>
      compareStrings(leftId, rightId) || leftVersion - rightVersion,
    );
  const endpointPairs = new Map<string, readonly [string, string]>();

  for (const dependency of dependencies) {
    if (
      dependency.fromItemId === dependency.toItemId ||
      !activeItemIds.has(dependency.fromItemId) ||
      !activeItemIds.has(dependency.toItemId)
    ) {
      continue;
    }

    const pair = [dependency.fromItemId, dependency.toItemId] as const;
    endpointPairs.set(JSON.stringify(pair), pair);
  }

  const edges = [...endpointPairs.values()].sort(
    ([leftFrom, leftTo], [rightFrom, rightTo]) =>
      compareStrings(leftFrom, rightFrom) || compareStrings(leftTo, rightTo),
  );
  // Keep this line-oriented contract in SQL-parity form. The persistence RPC
  // can reproduce it with ordered string_agg calls without relying on JSON
  // serialization details. Project item IDs are UUIDs, so `:` is unambiguous.
  const canonicalGraph =
    `impact-graph-v1\nitems\n${itemVersions
      .map(([id, version]) => `${id}:${version}`)
      .join("\n")}\nedges\n${edges
      .map(([fromItemId, toItemId]) => `${fromItemId}:${toItemId}`)
      .join("\n")}`;

  return createHash("sha256").update(canonicalGraph, "utf8").digest("hex");
}

function createSupabaseProjectAnalysisContextSource(
  client: ServerSupabaseClient,
): ProjectAnalysisContextSource {
  return {
    async listActiveItems(scope) {
      const { data, error } = await client
        .from("project_items")
        .select(analysisContextItemSelector)
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .in("status", analysisContextActiveItemStatuses)
        .order("id")
        .limit(maxAnalysisContextItems + 1);

      if (error) throw new ProjectAnalysisContextError();

      return (data ?? []).map((record) => ({
        id: record.id,
        itemKey: record.item_key,
        itemType: record.item_type,
        title: record.title,
        description: record.description,
        status: record.status,
        priority: record.priority,
        ownerId: record.owner_id,
        startDate: record.start_date,
        dueDate: record.due_date,
        eventDate: record.event_date,
        version: record.version,
      }));
    },

    async listDependencies(scope) {
      const rows: DependencyEdge[] = [];
      const fetchLimit = maxAnalysisContextDependencies + 1;

      for (let offset = 0; offset < fetchLimit; offset += dependencyPageSize) {
        const lastIndex = Math.min(
          offset + dependencyPageSize - 1,
          fetchLimit - 1,
        );
        const { data, error } = await client
          .from("item_dependencies")
          .select(analysisContextDependencySelector)
          .eq("workspace_id", scope.workspaceId)
          .eq("project_id", scope.projectId)
          .order("to_item_id")
          .order("from_item_id")
          .order("relationship")
          .range(offset, lastIndex);

        if (error) throw new ProjectAnalysisContextError();

        const page = data ?? [];
        rows.push(
          ...page.map((record) => ({
            fromItemId: record.from_item_id,
            toItemId: record.to_item_id,
            relationship: record.relationship,
          })),
        );

        if (rows.length > maxAnalysisContextDependencies) {
          throw new ProjectAnalysisContextError();
        }
        if (page.length < lastIndex - offset + 1) break;
      }

      return rows;
    },
  };
}

export async function loadProjectAnalysisContext(
  client: ServerSupabaseClient,
  scope: AuthorizedProjectScope,
  source: ProjectAnalysisContextSource =
    createSupabaseProjectAnalysisContextSource(client),
): Promise<ProjectAnalysisContext> {
  let items: AnalysisContextItem[];
  let dependencies: DependencyEdge[];

  try {
    [items, dependencies] = await Promise.all([
      source.listActiveItems(scope),
      source.listDependencies(scope),
    ]);
  } catch (error) {
    if (error instanceof ProjectAnalysisContextError) throw error;
    throw new ProjectAnalysisContextError();
  }

  if (
    items.length > maxAnalysisContextItems ||
    dependencies.length > maxAnalysisContextDependencies
  ) {
    throw new ProjectAnalysisContextError();
  }

  const stableItems = [...items].sort(compareContextItems);
  const activeItemIds = new Set(stableItems.map(({ id }) => id));
  const stableDependencies = normalizeDependencies(
    dependencies,
    activeItemIds,
  );
  const graphItems = stableItems.map(
    ({ id }): ImpactGraphItem => ({ id, active: true }),
  );

  return {
    revision: computeImpactGraphRevision(stableItems, stableDependencies),
    items: stableItems,
    graph: {
      items: graphItems,
      dependencies: stableDependencies,
    },
  };
}

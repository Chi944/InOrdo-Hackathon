import { impactTraversalInputSchema, impactTraversalOutputSchema } from "@/features/impact/schemas";
import type {
  DependencyEdge,
  ImpactedItem,
  ImpactTraversalInput,
  ImpactTraversalOutput,
} from "@/features/impact/types";

type PendingImpact = {
  itemId: string;
  depth: number;
  path: string[];
};

function edgeKey(edge: DependencyEdge) {
  return `${edge.fromItemId.length}:${edge.fromItemId}${edge.toItemId.length}:${edge.toItemId}`;
}

function compareItemIds(left: string, right: string) {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function compareImpacts(left: ImpactedItem, right: ImpactedItem) {
  return left.depth - right.depth || compareItemIds(left.itemId, right.itemId);
}

/**
 * Finds active items that depend directly or indirectly on the changed item.
 * Dependency rows point from the dependent item to its upstream prerequisite.
 */
export function traverseImpactGraph(
  input: ImpactTraversalInput,
): ImpactTraversalOutput {
  const graph = impactTraversalInputSchema.parse(input);
  const activeItemIds = new Set(
    graph.items.filter((item) => item.active).map((item) => item.id),
  );

  if (!activeItemIds.has(graph.changedItemId)) {
    return impactTraversalOutputSchema.parse({
      changedItemId: graph.changedItemId,
      impacts: [],
    });
  }

  const dependentsByUpstream = new Map<string, string[]>();
  const seenEdges = new Set<string>();

  for (const edge of graph.dependencies) {
    if (
      edge.fromItemId === edge.toItemId ||
      !activeItemIds.has(edge.fromItemId) ||
      !activeItemIds.has(edge.toItemId) ||
      seenEdges.has(edgeKey(edge))
    ) {
      continue;
    }

    seenEdges.add(edgeKey(edge));
    const dependents = dependentsByUpstream.get(edge.toItemId) ?? [];
    dependents.push(edge.fromItemId);
    dependentsByUpstream.set(edge.toItemId, dependents);
  }

  for (const dependents of dependentsByUpstream.values()) {
    dependents.sort(compareItemIds);
  }

  const bestDepth = new Map<string, number>([[graph.changedItemId, 0]]);
  const impacts = new Map<string, ImpactedItem>();
  const pending: PendingImpact[] = [
    { itemId: graph.changedItemId, depth: 0, path: [graph.changedItemId] },
  ];

  for (let index = 0; index < pending.length; index += 1) {
    const current = pending[index];
    if (!current || current.depth >= graph.maxDepth) {
      continue;
    }

    for (const dependentId of dependentsByUpstream.get(current.itemId) ?? []) {
      const nextDepth = current.depth + 1;
      const previousDepth = bestDepth.get(dependentId);

      if (
        dependentId === graph.changedItemId ||
        (previousDepth !== undefined && previousDepth <= nextDepth)
      ) {
        continue;
      }

      const next: PendingImpact = {
        itemId: dependentId,
        depth: nextDepth,
        path: [...current.path, dependentId],
      };
      bestDepth.set(dependentId, nextDepth);
      impacts.set(dependentId, next);
      pending.push(next);
    }
  }

  return impactTraversalOutputSchema.parse({
    changedItemId: graph.changedItemId,
    impacts: [...impacts.values()].sort(compareImpacts),
  });
}

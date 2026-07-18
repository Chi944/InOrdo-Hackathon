import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  computeImpactGraphRevision,
  loadProjectAnalysisContext,
  maxAnalysisContextDependencies,
  maxAnalysisContextItems,
  ProjectAnalysisContextError,
  type AnalysisContextItem,
  type ProjectAnalysisContextSource,
} from "@/features/analysis/context";
import type { DependencyEdge } from "@/features/impact/types";
import type { AuthorizedProjectScope } from "@/lib/auth/guards";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

const workspaceId = "166645ec-1ab3-48dc-98c7-3b6f99b70301";
const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
const userId = "6519012e-13a6-4e3e-9ae5-d09bd3054401";

const scope: AuthorizedProjectScope = {
  workspaceId,
  projectId,
  membership: { workspaceId, userId, role: "admin" },
};

function item(
  id: string,
  version: number,
  overrides: Partial<AnalysisContextItem> = {},
): AnalysisContextItem {
  return {
    id,
    itemKey: `ITEM-${version + 10}`,
    itemType: "task",
    title: `Item ${id}`,
    description: null,
    status: "in_progress",
    priority: "medium",
    ownerId: null,
    startDate: null,
    dueDate: null,
    eventDate: null,
    version,
    ...overrides,
  };
}

function edge(
  fromItemId: string,
  toItemId: string,
  relationship: DependencyEdge["relationship"] = "requires",
): DependencyEdge {
  return { fromItemId, toItemId, relationship };
}

function source(
  items: AnalysisContextItem[],
  dependencies: DependencyEdge[],
): ProjectAnalysisContextSource {
  return {
    listActiveItems: vi.fn(async () => items),
    listDependencies: vi.fn(async () => dependencies),
  };
}

describe("impact graph project revision", () => {
  it("hashes the SQL-parity impact-graph-v1 canonical text", () => {
    const canonical = [
      "impact-graph-v1",
      "items",
      "A:2",
      "B:4",
      "edges",
      "B:A",
    ].join("\n");
    const expected = createHash("sha256")
      .update(canonical, "utf8")
      .digest("hex");

    expect(
      computeImpactGraphRevision(
        [item("B", 4), item("A", 2)],
        [edge("B", "A", "informs")],
      ),
    ).toBe(expected);
  });

  it("is stable across item and dependency ordering", () => {
    const items = [item("A", 2), item("B", 4), item("C", 1)];
    const dependencies = [edge("B", "A"), edge("C", "B")];

    const forward = computeImpactGraphRevision(items, dependencies);
    const reversed = computeImpactGraphRevision(
      [...items].reverse(),
      [...dependencies].reverse(),
    );

    expect(forward).toMatch(/^[a-f0-9]{64}$/);
    expect(reversed).toBe(forward);
  });

  it("changes when an active item version changes", () => {
    const dependencies = [edge("B", "A")];

    expect(
      computeImpactGraphRevision([item("A", 1), item("B", 1)], dependencies),
    ).not.toBe(
      computeImpactGraphRevision([item("A", 2), item("B", 1)], dependencies),
    );
  });

  it("changes when an endpoint pair changes", () => {
    const items = [item("A", 1), item("B", 1), item("C", 1)];

    expect(computeImpactGraphRevision(items, [edge("B", "A")])).not.toBe(
      computeImpactGraphRevision(items, [edge("B", "A"), edge("C", "A")]),
    );
  });

  it("ignores relationship labels and duplicate endpoint pairs", () => {
    const items = [item("A", 1), item("B", 1)];
    const baseline = computeImpactGraphRevision(items, [edge("B", "A")]);

    expect(
      computeImpactGraphRevision(items, [
        edge("B", "A", "informs"),
        edge("B", "A", "depends_on"),
        edge("B", "A", "informs"),
      ]),
    ).toBe(baseline);
  });
});

describe("loadProjectAnalysisContext", () => {
  it("returns stable matching context and traversal-compatible graph input", async () => {
    const items = [
      item("C", 3, { itemType: "risk", priority: "high" }),
      item("A", 1, { itemType: "event", eventDate: "2026-09-12" }),
      item("B", 2),
    ];
    const dependencies = [
      edge("C", "B", "informs"),
      edge("B", "A", "requires"),
      edge("B", "A", "requires"),
      edge("outside", "A", "requires"),
    ];

    const result = await loadProjectAnalysisContext(
      {} as ServerSupabaseClient,
      scope,
      source(items, dependencies),
    );

    expect(result.items.map(({ id }) => id)).toEqual(["A", "B", "C"]);
    expect(result.graph.items).toEqual([
      { id: "A", active: true },
      { id: "B", active: true },
      { id: "C", active: true },
    ]);
    expect(result.graph.dependencies).toEqual([
      edge("B", "A", "requires"),
      edge("C", "B", "informs"),
    ]);
    expect(result.revision).toBe(
      computeImpactGraphRevision(result.items, result.graph.dependencies),
    );
  });

  it("fails closed above the active item bound", async () => {
    const tooManyItems = Array.from(
      { length: maxAnalysisContextItems + 1 },
      (_, index) => item(`item-${index}`, 1),
    );

    await expect(
      loadProjectAnalysisContext(
        {} as ServerSupabaseClient,
        scope,
        source(tooManyItems, []),
      ),
    ).rejects.toBeInstanceOf(ProjectAnalysisContextError);
  });

  it("fails closed above the dependency bound before normalization", async () => {
    const duplicateEdges = Array.from(
      { length: maxAnalysisContextDependencies + 1 },
      () => edge("B", "A"),
    );

    await expect(
      loadProjectAnalysisContext(
        {} as ServerSupabaseClient,
        scope,
        source([item("A", 1), item("B", 1)], duplicateEdges),
      ),
    ).rejects.toBeInstanceOf(ProjectAnalysisContextError);
  });

  it("scopes explicit Supabase reads to the authorized project", async () => {
    const itemRows = [
      {
        id: "A",
        item_key: "EVT-01",
        item_type: "event",
        title: "Summit",
        description: "Regional summit",
        status: "in_progress",
        priority: "high",
        owner_id: null,
        start_date: null,
        due_date: null,
        event_date: "2026-09-12",
        version: 4,
      },
    ];
    const itemBuilder = {
      select: vi.fn(),
      eq: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    itemBuilder.select.mockReturnValue(itemBuilder);
    itemBuilder.eq.mockReturnValue(itemBuilder);
    itemBuilder.in.mockReturnValue(itemBuilder);
    itemBuilder.order.mockReturnValue(itemBuilder);
    itemBuilder.limit.mockResolvedValue({ data: itemRows, error: null });

    const dependencyBuilder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
    };
    dependencyBuilder.select.mockReturnValue(dependencyBuilder);
    dependencyBuilder.eq.mockReturnValue(dependencyBuilder);
    dependencyBuilder.order.mockReturnValue(dependencyBuilder);
    dependencyBuilder.range.mockResolvedValue({ data: [], error: null });

    const client = {
      from: vi.fn((table: string) =>
        table === "project_items" ? itemBuilder : dependencyBuilder,
      ),
    } as unknown as ServerSupabaseClient;

    const result = await loadProjectAnalysisContext(client, scope);

    expect(itemBuilder.select).toHaveBeenCalledWith(
      "id,item_key,item_type,title,description,status,priority,owner_id,start_date,due_date,event_date,version",
    );
    expect(itemBuilder.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(itemBuilder.eq).toHaveBeenCalledWith("project_id", projectId);
    expect(itemBuilder.in).toHaveBeenCalledWith("status", [
      "not_started",
      "in_progress",
      "blocked",
      "at_risk",
    ]);
    expect(dependencyBuilder.select).toHaveBeenCalledWith(
      "from_item_id,to_item_id,relationship",
    );
    expect(dependencyBuilder.eq).toHaveBeenCalledWith(
      "workspace_id",
      workspaceId,
    );
    expect(dependencyBuilder.eq).toHaveBeenCalledWith("project_id", projectId);
    expect(result.items[0]).toMatchObject({
      id: "A",
      itemKey: "EVT-01",
      eventDate: "2026-09-12",
      version: 4,
    });
  });
});

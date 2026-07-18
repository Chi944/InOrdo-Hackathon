import { describe, expect, it, vi } from "vitest";

import {
  ImpactGraphLoadError,
  loadProjectImpactGraph,
  type ProjectGraphSource,
} from "@/features/impact/loader";
import type { AuthorizedProjectScope } from "@/lib/auth/guards";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

const workspaceId = "166645ec-1ab3-48dc-98c7-3b6f99b70301";
const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
const userId = "6519012e-13a6-4e3e-9ae5-d09bd3054401";
const itemA = "3e14b4a4-421d-4d6d-8a7e-01d5a22e3002";
const itemB = "b993a2d1-8060-4c96-a7d0-e79f4cd43303";

const scope: AuthorizedProjectScope = {
  workspaceId,
  projectId,
  membership: { workspaceId, userId, role: "viewer" },
};

describe("project impact graph loader", () => {
  it("loads one authorized project's active graph and invokes pure traversal", async () => {
    const source: ProjectGraphSource = {
      listActiveItemIds: vi.fn(async () => [itemA, itemB]),
      listDependencies: vi.fn(async () => [
        {
          fromItemId: itemB,
          toItemId: itemA,
          relationship: "requires" as const,
        },
      ]),
    };

    await expect(
      loadProjectImpactGraph(
        {} as ServerSupabaseClient,
        scope,
        { changedItemId: itemA, maxDepth: 5 },
        source,
      ),
    ).resolves.toEqual({
      changedItemId: itemA,
      impacts: [{ itemId: itemB, depth: 1, path: [itemA, itemB] }],
    });
    expect(source.listActiveItemIds).toHaveBeenCalledWith(scope);
    expect(source.listDependencies).toHaveBeenCalledWith(scope);
  });

  it("returns a valid empty result when a project has no active items", async () => {
    const source: ProjectGraphSource = {
      listActiveItemIds: vi.fn(async () => []),
      listDependencies: vi.fn(async () => []),
    };

    await expect(
      loadProjectImpactGraph(
        {} as ServerSupabaseClient,
        scope,
        { changedItemId: itemA },
        source,
      ),
    ).resolves.toEqual({ changedItemId: itemA, impacts: [] });
  });

  it("fails safely instead of returning a truncated oversized graph", async () => {
    const source: ProjectGraphSource = {
      listActiveItemIds: vi.fn(async () =>
        Array.from({ length: 501 }, (_, index) => `item-${index}`),
      ),
      listDependencies: vi.fn(async () => []),
    };

    await expect(
      loadProjectImpactGraph(
        {} as ServerSupabaseClient,
        scope,
        { changedItemId: itemA },
        source,
      ),
    ).rejects.toBeInstanceOf(ImpactGraphLoadError);
  });

  it("fails safely when a source returns too many dependency edges", async () => {
    const source: ProjectGraphSource = {
      listActiveItemIds: vi.fn(async () => [itemA, itemB]),
      listDependencies: vi.fn(async () =>
        Array.from({ length: 2_001 }, () => ({
          fromItemId: itemB,
          toItemId: itemA,
          relationship: "requires" as const,
        })),
      ),
    };

    await expect(
      loadProjectImpactGraph(
        {} as ServerSupabaseClient,
        scope,
        { changedItemId: itemA },
        source,
      ),
    ).rejects.toBeInstanceOf(ImpactGraphLoadError);
  });
});

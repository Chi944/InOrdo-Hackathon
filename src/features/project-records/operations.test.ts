import { describe, expect, it, vi } from "vitest";

import {
  createProjectRecordOperations,
  type ProjectRecordAuthorizer,
  type ProjectRecordStore,
} from "@/features/project-records/operations";
import type { AuthorizedProjectScope } from "@/lib/auth/guards";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

const workspaceId = "166645ec-1ab3-48dc-98c7-3b6f99b70301";
const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
const userId = "6519012e-13a6-4e3e-9ae5-d09bd3054401";
const itemId = "3e14b4a4-421d-4d6d-8a7e-01d5a22e3002";
const upstreamId = "b993a2d1-8060-4c96-a7d0-e79f4cd43303";
const dependencyId = "4db0760c-d441-4b39-845d-f011b3e14404";

const scope: AuthorizedProjectScope = {
  workspaceId,
  projectId,
  membership: { workspaceId, userId, role: "member" },
};

const itemRow: Tables<"project_items"> = {
  id: itemId,
  workspace_id: workspaceId,
  project_id: projectId,
  item_key: "OPS-12",
  item_type: "task",
  title: "Confirm venue",
  description: null,
  status: "not_started",
  priority: "medium",
  owner_id: null,
  start_date: null,
  due_date: null,
  event_date: null,
  metadata: {},
  version: 2,
  is_demo_retired: false,
  created_by: userId,
  created_at: "2026-07-18T00:00:00.000Z",
  updated_at: "2026-07-18T00:00:00.000Z",
};

const dependencyRow: Tables<"item_dependencies"> = {
  id: dependencyId,
  workspace_id: workspaceId,
  project_id: projectId,
  from_item_id: itemId,
  to_item_id: upstreamId,
  relationship: "requires",
  rationale: null,
  created_by: userId,
  created_at: "2026-07-18T00:00:00.000Z",
};

function makeStore(overrides: Partial<ProjectRecordStore> = {}) {
  const store: ProjectRecordStore = {
    createItem: vi.fn(async () => itemRow),
    getItem: vi.fn(async () => itemRow),
    updateItem: vi.fn(async () => ({ ...itemRow, version: 3 })),
    listItems: vi.fn(async () => ({
      items: [itemRow],
      total: 1,
      nextCursor: null,
    })),
    hasWorkspaceMember: vi.fn(async () => true),
    getProjectItemIds: vi.fn(async () => [itemId, upstreamId]),
    createDependency: vi.fn(async () => dependencyRow),
    removeDependency: vi.fn(async () => dependencyRow),
    listDependencies: vi.fn(async () => [dependencyRow]),
    ...overrides,
  };

  return store;
}

function makeAuthorizer() {
  return vi.fn<ProjectRecordAuthorizer>(async () => ({ userId, scope }));
}

function operations(
  store: ProjectRecordStore,
  authorize: ProjectRecordAuthorizer = makeAuthorizer(),
) {
  return createProjectRecordOperations({
    client: {} as ServerSupabaseClient,
    store,
    authorize,
  });
}

describe("project record operations", () => {
  it("authorizes list filters with read access before querying", async () => {
    const store = makeStore();
    const authorize = makeAuthorizer();

    const result = await operations(store, authorize).listItems(projectId, {
      status: "at_risk",
      limit: 10,
    });

    expect(authorize).toHaveBeenCalledWith(
      expect.anything(),
      projectId,
      ["owner", "admin", "member", "viewer"],
    );
    expect(store.listItems).toHaveBeenCalledWith(scope, {
      status: "at_risk",
      limit: 10,
    });
    expect(result.items).toEqual([itemRow]);
  });

  it("fails closed before persistence when authorization rejects", async () => {
    const store = makeStore();
    const authorize = vi.fn<ProjectRecordAuthorizer>(async () => {
      throw new Error("forbidden");
    });

    await expect(
      operations(store, authorize).createItem({
        projectId,
        itemKey: "OPS-13",
        itemType: "task",
        title: "Prepare invitations",
      }),
    ).rejects.toThrow("forbidden");
    expect(store.createItem).not.toHaveBeenCalled();
  });

  it("rejects assigning an owner outside the authorized workspace", async () => {
    const store = makeStore({ hasWorkspaceMember: vi.fn(async () => false) });

    await expect(
      operations(store).createItem({
        projectId,
        itemKey: "OPS-13",
        itemType: "task",
        title: "Prepare invitations",
        ownerId: upstreamId,
      }),
    ).rejects.toMatchObject({
      code: "invalid_reference",
      message: "The selected owner is not a member of this workspace.",
    });
    expect(store.createItem).not.toHaveBeenCalled();
  });

  it("returns a safe conflict when a conditional update loses a race", async () => {
    const store = makeStore({ updateItem: vi.fn(async () => null) });

    await expect(
      operations(store).updateItem({
        projectId,
        itemId,
        expectedVersion: 2,
        status: "in_progress",
      }),
    ).rejects.toMatchObject({
      code: "conflict",
      message: "This item changed since you loaded it. Refresh and try again.",
    });
    expect(store.updateItem).toHaveBeenCalledWith(
      scope,
      itemId,
      2,
      { status: "in_progress" },
    );
  });

  it("rejects a dependency when either endpoint is outside the project", async () => {
    const store = makeStore({
      getProjectItemIds: vi.fn(async () => [itemId]),
    });

    await expect(
      operations(store).createDependency({
        projectId,
        fromItemId: itemId,
        toItemId: upstreamId,
        relationship: "requires",
      }),
    ).rejects.toMatchObject({
      code: "invalid_reference",
      message: "Both dependency items must belong to this project.",
    });
    expect(store.createDependency).not.toHaveBeenCalled();
  });

  it("creates a dependency only after contributor authorization", async () => {
    const store = makeStore();
    const authorize = makeAuthorizer();

    await expect(
      operations(store, authorize).createDependency({
        projectId,
        fromItemId: itemId,
        toItemId: upstreamId,
        relationship: "requires",
      }),
    ).resolves.toEqual(dependencyRow);
    expect(authorize).toHaveBeenCalledWith(
      expect.anything(),
      projectId,
      ["owner", "admin", "member"],
    );
    expect(store.createDependency).toHaveBeenCalledWith(
      scope,
      userId,
      expect.objectContaining({ fromItemId: itemId, toItemId: upstreamId }),
    );
  });

  it("reports an unknown scoped dependency as not found on removal", async () => {
    const store = makeStore({ removeDependency: vi.fn(async () => null) });

    await expect(
      operations(store).removeDependency({ projectId, dependencyId }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

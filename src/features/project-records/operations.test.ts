import { describe, expect, it, vi } from "vitest";

import {
  createProjectRecordOperations,
  type ProjectRecordAuthorizer,
  type ProjectRecordStore,
} from "@/features/project-records/operations";
import { ProjectRecordError } from "@/features/project-records/errors";
import type { AuthorizedProjectScope } from "@/lib/auth/guards";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

const workspaceId = "166645ec-1ab3-48dc-98c7-3b6f99b70301";
const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
const userId = "6519012e-13a6-4e3e-9ae5-d09bd3054401";
const itemId = "3e14b4a4-421d-4d6d-8a7e-01d5a22e3002";
const upstreamId = "b993a2d1-8060-4c96-a7d0-e79f4cd43303";
const dependencyId = "4db0760c-d441-4b39-845d-f011b3e14404";
const mutationGuard = {
  expectedWorkflowGeneration: 7,
  idempotencyKey: "records_20260719_001",
};

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
    createItem: vi.fn(async () => ({
      status: "succeeded" as const,
      workflowGeneration: 7,
      record: itemRow,
    })),
    updateItem: vi.fn(async () => ({
      status: "succeeded" as const,
      workflowGeneration: 7,
      record: { ...itemRow, version: 3 },
    })),
    listItems: vi.fn(async () => ({
      items: [itemRow],
      total: 1,
      nextCursor: null,
    })),
    createDependency: vi.fn(async () => ({
      status: "succeeded" as const,
      workflowGeneration: 7,
      record: dependencyRow,
    })),
    removeDependency: vi.fn(async () => ({
      status: "succeeded" as const,
      workflowGeneration: 7,
      dependencyId,
    })),
    listDependencies: vi.fn(async () => [dependencyRow]),
    ...overrides,
  };

  return store;
}

function makeAuthorizer() {
  return vi.fn<ProjectRecordAuthorizer>(async () => ({ scope }));
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
  it.each([
    [
      "create item",
      (subject: ReturnType<typeof createProjectRecordOperations>) =>
        subject.createItem({
          ...mutationGuard,
          projectId,
          itemKey: "OPS-13",
          itemType: "task",
          title: "Prepare invitations",
        }),
    ],
    [
      "update item",
      (subject: ReturnType<typeof createProjectRecordOperations>) =>
        subject.updateItem({
          ...mutationGuard,
          projectId,
          itemId,
          expectedVersion: 2,
          title: "Updated title",
        }),
    ],
    [
      "create dependency",
      (subject: ReturnType<typeof createProjectRecordOperations>) =>
        subject.createDependency({
          ...mutationGuard,
          projectId,
          fromItemId: itemId,
          toItemId: upstreamId,
          relationship: "requires",
        }),
    ],
    [
      "remove dependency",
      (subject: ReturnType<typeof createProjectRecordOperations>) =>
        subject.removeDependency({
          ...mutationGuard,
          projectId,
          dependencyId,
        }),
    ],
  ])("denies a viewer %s before initializing or calling persistence", async (_label, invoke) => {
    const store = makeStore();
    const getStore = vi.fn(() => store);
    const authorize = vi.fn<ProjectRecordAuthorizer>(async () => {
      throw new Error("viewer mutation denied");
    });
    const subject = createProjectRecordOperations({
      client: {} as ServerSupabaseClient,
      getStore,
      authorize,
    });

    await expect(invoke(subject)).rejects.toThrow("viewer mutation denied");
    expect(authorize).toHaveBeenCalledWith(
      expect.anything(),
      projectId,
      ["owner", "admin", "member"],
    );
    expect(getStore).not.toHaveBeenCalled();
    expect(store.createItem).not.toHaveBeenCalled();
    expect(store.updateItem).not.toHaveBeenCalled();
    expect(store.createDependency).not.toHaveBeenCalled();
    expect(store.removeDependency).not.toHaveBeenCalled();
  });

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
        ...mutationGuard,
        projectId,
        itemKey: "OPS-13",
        itemType: "task",
        title: "Prepare invitations",
      }),
    ).rejects.toThrow("forbidden");
    expect(store.createItem).not.toHaveBeenCalled();
  });

  it("lets the authoritative RPC resolve an exact create replay before mutable references", async () => {
    const duplicateResult = {
      status: "duplicate" as const,
      workflowGeneration: 7,
      record: itemRow,
    };
    const store = makeStore({
      createItem: vi.fn(async () => duplicateResult),
    });

    await expect(
      operations(store).createItem({
        ...mutationGuard,
        projectId,
        itemKey: "OPS-13",
        itemType: "task",
        title: "Prepare invitations",
        ownerId: upstreamId,
      }),
    ).resolves.toEqual(duplicateResult);
    expect(store.createItem).toHaveBeenCalledOnce();
  });

  it("passes mutation guards to the store and preserves duplicate replay results", async () => {
    const duplicateResult = {
      status: "duplicate" as const,
      workflowGeneration: 7,
      record: { ...itemRow, version: 3 },
    };
    const store = makeStore({ updateItem: vi.fn(async () => duplicateResult) });

    await expect(
      operations(store).updateItem({
        ...mutationGuard,
        projectId,
        itemId,
        expectedVersion: 2,
        status: "in_progress",
      }),
    ).resolves.toEqual(duplicateResult);
    expect(store.updateItem).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({
        projectId,
        itemId,
        expectedVersion: 2,
        expectedWorkflowGeneration: 7,
        idempotencyKey: "records_20260719_001",
        status: "in_progress",
      }),
    );
  });

  it("lets the authoritative mutation RPC report a stale item conflict", async () => {
    const store = makeStore({
      updateItem: vi.fn(async () => {
        throw new ProjectRecordError(
          "conflict",
          "This item changed since you loaded it. Refresh and try again.",
        );
      }),
    });

    await expect(
      operations(store).updateItem({
        ...mutationGuard,
        projectId,
        itemId,
        expectedVersion: 3,
        status: "in_progress",
      }),
    ).rejects.toMatchObject({
      code: "conflict",
      message: "This item changed since you loaded it. Refresh and try again.",
    });
    expect(store.updateItem).toHaveBeenCalledOnce();
  });

  it("creates a dependency only after contributor authorization", async () => {
    const store = makeStore();
    const authorize = makeAuthorizer();

    await expect(
      operations(store, authorize).createDependency({
        ...mutationGuard,
        projectId,
        fromItemId: itemId,
        toItemId: upstreamId,
        relationship: "requires",
      }),
    ).resolves.toMatchObject({
      status: "succeeded",
      workflowGeneration: 7,
      record: dependencyRow,
    });
    expect(authorize).toHaveBeenCalledWith(
      expect.anything(),
      projectId,
      ["owner", "admin", "member"],
    );
    expect(store.createDependency).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({
        fromItemId: itemId,
        toItemId: upstreamId,
        expectedWorkflowGeneration: 7,
        idempotencyKey: "records_20260719_001",
      }),
    );
  });

  it("passes the complete guarded removal input to the mutation store", async () => {
    const store = makeStore();

    await expect(
      operations(store).removeDependency({
        ...mutationGuard,
        projectId,
        dependencyId,
      }),
    ).resolves.toMatchObject({ status: "succeeded", dependencyId });
    expect(store.removeDependency).toHaveBeenCalledWith(scope, {
      ...mutationGuard,
      projectId,
      dependencyId,
    });
  });
});

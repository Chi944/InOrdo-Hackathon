import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectRecordError } from "@/features/project-records/errors";

const operationMocks = vi.hoisted(() => ({
  createItem: vi.fn(),
  updateItem: vi.fn(),
  createDependency: vi.fn(),
  removeDependency: vi.fn(),
}));

vi.mock("@/features/project-records/operations", () => ({
  createProjectRecordOperations: vi.fn(() => operationMocks),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({})),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createDependencyAction,
  createProjectItemAction,
  removeDependencyAction,
  updateProjectItemAction,
} from "@/app/app/project-record-actions";
import { initialRecordActionState } from "@/app/app/project-record-action-state";

const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
const itemId = "3e14b4a4-421d-4d6d-8a7e-01d5a22e3002";
const upstreamId = "b993a2d1-8060-4c96-a7d0-e79f4cd43303";

describe("project record Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const operation of Object.values(operationMocks)) {
      operation.mockResolvedValue({ id: itemId });
    }
  });

  it("exports only async runtime functions from the Server Action module", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/app/project-record-actions.ts"),
      "utf8",
    );
    expect(source).toMatch(/^"use server";/);
    expect(source).not.toMatch(/^export\s+(?:const|let|var|class)\s+/m);
  });

  it("creates an item and refreshes the reliable server view", async () => {
    const form = new FormData();
    form.set("projectId", projectId);
    form.set("itemKey", "OPS-13");
    form.set("itemType", "task");
    form.set("title", "Prepare invitations");
    form.set("status", "not_started");
    form.set("priority", "high");

    await expect(
      createProjectItemAction(initialRecordActionState, form),
    ).resolves.toMatchObject({ status: "success" });
    expect(operationMocks.createItem).toHaveBeenCalledWith({
      projectId,
      itemKey: "OPS-13",
      itemType: "task",
      title: "Prepare invitations",
      description: undefined,
      status: "not_started",
      priority: "high",
      ownerId: undefined,
      startDate: undefined,
      dueDate: undefined,
      eventDate: undefined,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/app");
  });

  it("submits an item edit with its optimistic concurrency version", async () => {
    const form = new FormData();
    form.set("projectId", projectId);
    form.set("itemId", itemId);
    form.set("expectedVersion", "7");
    form.set("status", "at_risk");

    await updateProjectItemAction(initialRecordActionState, form);

    expect(operationMocks.updateItem).toHaveBeenCalledWith({
      projectId,
      itemId,
      expectedVersion: 7,
      status: "at_risk",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/app");
  });

  it("creates and removes dependencies through scoped operations", async () => {
    const createForm = new FormData();
    createForm.set("projectId", projectId);
    createForm.set("fromItemId", itemId);
    createForm.set("toItemId", upstreamId);
    createForm.set("relationship", "requires");
    await createDependencyAction(initialRecordActionState, createForm);

    const removeForm = new FormData();
    removeForm.set("projectId", projectId);
    removeForm.set("dependencyId", upstreamId);
    await removeDependencyAction(initialRecordActionState, removeForm);

    expect(operationMocks.createDependency).toHaveBeenCalledWith({
      projectId,
      fromItemId: itemId,
      toItemId: upstreamId,
      relationship: "requires",
      rationale: undefined,
    });
    expect(operationMocks.removeDependency).toHaveBeenCalledWith({
      projectId,
      dependencyId: upstreamId,
    });
  });

  it("returns a user-safe operation error without refreshing", async () => {
    operationMocks.updateItem.mockRejectedValueOnce(
      new ProjectRecordError(
        "conflict",
        "This item changed since you loaded it. Refresh and try again.",
      ),
    );
    const form = new FormData();
    form.set("projectId", projectId);
    form.set("itemId", itemId);
    form.set("expectedVersion", "3");
    form.set("status", "blocked");

    await expect(
      updateProjectItemAction(initialRecordActionState, form),
    ).resolves.toEqual({
      status: "error",
      message: "This item changed since you loaded it. Refresh and try again.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

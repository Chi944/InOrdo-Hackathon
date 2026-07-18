import { describe, expect, it } from "vitest";

import {
  createDependencySchema,
  createProjectItemSchema,
  deleteDependencySchema,
  listProjectItemsFilterSchema,
  updateProjectItemSchema,
} from "@/features/project-records/schemas";

const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
const itemId = "3e14b4a4-421d-4d6d-8a7e-01d5a22e3002";
const otherItemId = "b993a2d1-8060-4c96-a7d0-e79f4cd43303";

describe("createProjectItemSchema", () => {
  it("accepts a bounded task payload with approved enum values", () => {
    expect(
      createProjectItemSchema.parse({
        projectId,
        itemKey: "OPS-12",
        itemType: "task",
        title: "Confirm the venue contract",
        description: "Follow up with procurement.",
        status: "in_progress",
        priority: "high",
        ownerId: itemId,
        startDate: "2026-08-01",
        dueDate: "2026-08-10",
      }),
    ).toMatchObject({ projectId, itemKey: "OPS-12", itemType: "task" });
  });

  it("rejects unapproved fields, enum values, and invalid identifiers", () => {
    const result = createProjectItemSchema.safeParse({
      projectId: "not-a-uuid",
      itemKey: "ops-1",
      itemType: "note",
      title: "",
      internalOnly: true,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an inverted start and due date", () => {
    const result = createProjectItemSchema.safeParse({
      projectId,
      itemKey: "OPS-12",
      itemType: "task",
      title: "Confirm the venue contract",
      startDate: "2026-08-11",
      dueDate: "2026-08-10",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Start date must be on or before due date.",
    );
  });

  it("allows event dates only for event items", () => {
    expect(
      createProjectItemSchema.safeParse({
        projectId,
        itemKey: "EVT-12",
        itemType: "task",
        title: "Not an event",
        eventDate: "2026-08-10",
      }).success,
    ).toBe(false);

    expect(
      createProjectItemSchema.safeParse({
        projectId,
        itemKey: "EVT-12",
        itemType: "event",
        title: "Launch review",
        eventDate: "2026-08-10",
      }).success,
    ).toBe(true);
  });
});

describe("updateProjectItemSchema", () => {
  it("requires a positive optimistic-concurrency version and a non-empty patch", () => {
    expect(
      updateProjectItemSchema.safeParse({ projectId, itemId, expectedVersion: 0 }).success,
    ).toBe(false);
    expect(
      updateProjectItemSchema.safeParse({ projectId, itemId, expectedVersion: 3 }).success,
    ).toBe(false);
  });

  it("permits nullable record fields to be cleared", () => {
    expect(
      updateProjectItemSchema.parse({
        projectId,
        itemId,
        expectedVersion: 3,
        description: null,
        ownerId: null,
        dueDate: null,
        eventDate: null,
      }),
    ).toMatchObject({ expectedVersion: 3, description: null });
  });
});

describe("dependency schemas", () => {
  it("rejects self-referential dependencies", () => {
    const result = createDependencySchema.safeParse({
      projectId,
      fromItemId: itemId,
      toItemId: itemId,
      relationship: "requires",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "A dependency cannot reference the same item.",
    );
  });

  it("rejects unapproved dependency relationship values", () => {
    expect(
      createDependencySchema.safeParse({
        projectId,
        fromItemId: itemId,
        toItemId: otherItemId,
        relationship: "blocks",
      }).success,
    ).toBe(false);
  });

  it("accepts known dependency relationships and validates deletion identity", () => {
    expect(
      createDependencySchema.parse({
        projectId,
        fromItemId: itemId,
        toItemId: otherItemId,
        relationship: "requires",
        rationale: "The agenda must be approved first.",
      }),
    ).toMatchObject({ relationship: "requires" });
    expect(deleteDependencySchema.safeParse({ projectId, dependencyId: itemId }).success).toBe(true);
    expect(
      deleteDependencySchema.safeParse({ projectId, dependencyId: itemId, extra: true }).success,
    ).toBe(false);
  });
});

describe("listProjectItemsFilterSchema", () => {
  it("applies bounded pagination defaults and accepts exact filter values", () => {
    expect(listProjectItemsFilterSchema.parse({})).toEqual({ limit: 25 });
    expect(
      listProjectItemsFilterSchema.parse({
        status: "at_risk",
        itemType: "risk",
        priority: "critical",
        ownerId: itemId,
        search: "contract",
        cursor: "OPS-12",
        limit: 100,
      }),
    ).toMatchObject({ limit: 100, cursor: "OPS-12" });
  });

  it("rejects oversize page requests and unknown filters", () => {
    expect(listProjectItemsFilterSchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(listProjectItemsFilterSchema.safeParse({ search: "x".repeat(201) }).success).toBe(false);
    expect(listProjectItemsFilterSchema.safeParse({ includeArchived: true }).success).toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";

import { listOperationHistory } from "@/features/operations/history";
import type { AuthorizedProjectScope } from "@/lib/auth/guards";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

const workspaceId = "166645ec-1ab3-48dc-98c7-3b6f99b70301";
const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
const actorId = "6519012e-13a6-4e3e-9ae5-d09bd3054401";
const scope: AuthorizedProjectScope = {
  workspaceId,
  projectId,
  membership: { workspaceId, userId: actorId, role: "member" },
};

function fixture() {
  const operation = {
    id: "d1669e0f-604c-4ec2-8ff1-717b2a4d5101",
    operation_type: "apply_proposal",
    state: "succeeded",
    proposal_id: "5bf63e7d-c8db-4c2d-a3cc-20107cb91503",
    reverses_operation_id: null,
    initiated_by: actorId,
    error_code: null,
    reversible: true,
    workflow_generation: 4,
    created_at: "2026-07-18T10:00:00.000Z",
    completed_at: "2026-07-18T10:00:01.000Z",
    initiator: { id: actorId, display_name: "Deston" },
    items: [
      {
        id: "78915e0f-604c-4ec2-8ff1-717b2a4d5101",
        proposal_action_id: "4c320952-a5e8-40d3-824b-d528c61de101",
        item_id: "21d4e760-f552-43d4-bf6a-000000000002",
        ordinal: 1,
        state: "succeeded",
        before_state: { field_name: "due_date", value: "2026-08-10" },
        after_state: { field_name: "due_date", value: "2026-08-17" },
        reversible: true,
        error_code: null,
        created_at: "2026-07-18T10:00:01.000Z",
        action: {
          id: "4c320952-a5e8-40d3-824b-d528c61de101",
          ordinal: 1,
          action_type: "update_item",
          rationale: "Preserve the approved schedule change.",
        },
      },
    ],
  };

  const projectBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };
  projectBuilder.select.mockReturnValue(projectBuilder);
  projectBuilder.eq.mockReturnValue(projectBuilder);
  projectBuilder.single.mockResolvedValue({
    data: { workflow_generation: 4 },
    error: null,
  });

  const operationsBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  operationsBuilder.select.mockReturnValue(operationsBuilder);
  operationsBuilder.eq.mockReturnValue(operationsBuilder);
  operationsBuilder.order.mockReturnValue(operationsBuilder);
  operationsBuilder.limit.mockResolvedValue({ data: [operation], error: null });

  const client = {
    from: vi.fn((table: string) =>
      table === "projects" ? projectBuilder : operationsBuilder,
    ),
  } as unknown as ServerSupabaseClient;

  return { client, operation, operationsBuilder, projectBuilder };
}

describe("operation audit history", () => {
  it("lists actor, proposal action, ordered before/after state in the current generation", async () => {
    const test = fixture();
    await expect(
      listOperationHistory(test.client, scope, {
        limit: 25,
        includeArchived: false,
      }),
    ).resolves.toEqual([test.operation]);

    expect(test.operationsBuilder.eq).toHaveBeenCalledWith(
      "workspace_id",
      workspaceId,
    );
    expect(test.operationsBuilder.eq).toHaveBeenCalledWith(
      "project_id",
      projectId,
    );
    expect(test.operationsBuilder.eq).toHaveBeenCalledWith(
      "workflow_generation",
      4,
    );
    expect(test.operationsBuilder.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(test.operationsBuilder.order).toHaveBeenCalledWith("ordinal", {
      ascending: true,
      referencedTable: "items",
    });
    expect(test.operationsBuilder.limit).toHaveBeenCalledWith(25);
  });

  it("includes prior generations only when explicitly requested", async () => {
    const test = fixture();
    await listOperationHistory(test.client, scope, {
      limit: 100,
      includeArchived: true,
    });

    expect(test.projectBuilder.single).not.toHaveBeenCalled();
    expect(test.operationsBuilder.eq).not.toHaveBeenCalledWith(
      "workflow_generation",
      expect.anything(),
    );
    expect(test.operationsBuilder.limit).toHaveBeenCalledWith(100);
  });

  it("fails closed when the current project generation cannot be loaded", async () => {
    const test = fixture();
    test.projectBuilder.single.mockResolvedValueOnce({
      data: null,
      error: { message: "database details" },
    });

    await expect(
      listOperationHistory(test.client, scope, {
        limit: 25,
        includeArchived: false,
      }),
    ).rejects.toMatchObject({ code: "persistence" });
    expect(test.operationsBuilder.limit).not.toHaveBeenCalled();
  });
});

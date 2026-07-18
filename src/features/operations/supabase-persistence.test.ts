import { describe, expect, it, vi } from "vitest";

import {
  createPrivilegedSupabaseOperationsRpcExecutor,
  createSupabaseOperationsExecutor,
} from "@/features/operations/supabase-persistence";

const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
const actorId = "6519012e-13a6-4e3e-9ae5-d09bd3054401";
const proposalId = "5bf63e7d-c8db-4c2d-a3cc-20107cb91503";
const actionId = "4c320952-a5e8-40d3-824b-d528c61de101";
const operationId = "d1669e0f-604c-4ec2-8ff1-717b2a4d5101";
const conflictingItemId = "1e6086b4-94f7-4bee-92ae-75219e9ca201";

const applyInput = {
  actorId,
  projectId,
  proposalId,
  selectedActionIds: [actionId],
  humanInputs: [],
  idempotencyKey: "apply_20260718_001",
};

function rpcResult(result: {
  data: unknown;
  error: { code?: string; message?: string } | null;
}) {
  return {
    execute: vi.fn(async () => result),
  };
}

describe("privileged operations RPC executor", () => {
  it("allows only the three reviewed operation functions", async () => {
    const rpc = vi.fn<
      (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: null; error: null }>
    >();
    rpc.mockResolvedValue({ data: null, error: null });
    const executor = createPrivilegedSupabaseOperationsRpcExecutor({
      rpc,
    } as never);

    await executor.execute("apply_project_proposal", {});
    await executor.execute("undo_project_operation", {});
    await executor.execute("reset_demo_project", {});

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "apply_project_proposal",
      "undo_project_operation",
      "reset_demo_project",
    ]);
  });

  it("rejects an unreviewed function name before invoking Supabase", async () => {
    const rpc = vi.fn<
      (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: null; error: null }>
    >();
    rpc.mockResolvedValue({ data: null, error: null });
    const executor = createPrivilegedSupabaseOperationsRpcExecutor({
      rpc,
    } as never);
    const executeUnchecked = executor.execute as (
      functionName: string,
      args: Record<string, unknown>,
    ) => Promise<unknown>;

    await expect(executeUnchecked("execute_arbitrary_sql", {})).rejects.toMatchObject(
      {
        code: "persistence",
      },
    );
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("Supabase operations executor", () => {
  it("forwards an apply request through the narrow RPC and parses its strict result", async () => {
    const rpc = rpcResult({
      data: {
        status: "succeeded",
        operation_id: operationId,
        applied_action_ids: [actionId],
      },
      error: null,
    });
    const executor = createSupabaseOperationsExecutor(rpc);

    await expect(executor.applyProposal(applyInput)).resolves.toEqual({
      status: "succeeded",
      operationId,
      appliedActionIds: [actionId],
    });
    expect(rpc.execute).toHaveBeenCalledWith("apply_project_proposal", {
      p_actor_id: actorId,
      p_project_id: projectId,
      p_proposal_id: proposalId,
      p_selected_action_ids: [actionId],
      p_human_inputs: [],
      p_idempotency_key: "apply_20260718_001",
    });
  });

  it("rejects malformed or unexpectedly expanded RPC results", async () => {
    const malformed = rpcResult({
      data: {
        status: "succeeded",
        operation_id: operationId,
        applied_action_ids: [actionId],
        internal_debug: "must not cross the boundary",
      },
      error: null,
    });

    await expect(
      createSupabaseOperationsExecutor(malformed).applyProposal(applyInput),
    ).rejects.toMatchObject({ code: "persistence" });
  });

  it("maps transaction conflicts to a safe domain error without database details", async () => {
    const sensitiveDatabaseMessage =
      "operation_conflict at private.apply row containing internal_note";
    const rpc = rpcResult({
      data: null,
      error: { code: "40001", message: sensitiveDatabaseMessage },
    });
    let failure: unknown;

    try {
      await createSupabaseOperationsExecutor(rpc).applyProposal(applyInput);
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({ code: "conflict" });
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toContain(sensitiveDatabaseMessage);
    expect(JSON.stringify(failure)).not.toContain("internal_note");
  });

  it("maps committed safe failure results while preserving their audit log", async () => {
    const failed = rpcResult({
      data: {
        status: "failed",
        operation_id: operationId,
        error_code: "stale_target",
      },
      error: null,
    });

    await expect(
      createSupabaseOperationsExecutor(failed).applyProposal(applyInput),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("returns only bounded, allowlisted undo conflict details", async () => {
    const failed = rpcResult({
      data: {
        status: "failed",
        operation_id: operationId,
        error_code: "undo_conflict",
        conflicts: [
          {
            item_id: conflictingItemId,
            expected_version: 4,
            actual_version: 5,
            reason: "version_mismatch",
          },
        ],
      },
      error: null,
    });
    let failure: unknown;

    try {
      await createSupabaseOperationsExecutor(failed).undoOperation({
        actorId,
        projectId,
        operationId,
        idempotencyKey: "undo_20260718_conflict",
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      code: "conflict",
      details: {
        conflicts: [
          {
            itemId: conflictingItemId,
            expectedVersion: 4,
            actualVersion: 5,
            reason: "version_mismatch",
          },
        ],
      },
    });
    expect(JSON.stringify(failure)).not.toContain("before_state");
    expect(JSON.stringify(failure)).not.toContain("after_state");
  });

  it("maps authorization and unknown database failures without leaking internals", async () => {
    const forbidden = rpcResult({
      data: null,
      error: { code: "42501", message: "workspace_policy secret detail" },
    });
    await expect(
      createSupabaseOperationsExecutor(forbidden).applyProposal(applyInput),
    ).rejects.toMatchObject({ code: "forbidden" });

    const unknown = rpcResult({
      data: null,
      error: { code: "XX000", message: "private schema detail" },
    });
    let failure: unknown;
    try {
      await createSupabaseOperationsExecutor(unknown).applyProposal(applyInput);
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ code: "persistence" });
    expect((failure as Error).message).not.toContain("private schema detail");
  });
});

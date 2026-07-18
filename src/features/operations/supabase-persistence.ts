import "server-only";

import { z } from "zod";

import { OperationError } from "@/features/operations/errors";
import type { PrivilegedSupabaseClient } from "@/lib/supabase/privileged";

export const operationsRpcNames = [
  "apply_project_proposal",
  "undo_project_operation",
  "reset_demo_project",
] as const;

type OperationsRpcName = (typeof operationsRpcNames)[number];

type RpcError = { code?: string; message?: string };
type RpcResult = { data: unknown; error: RpcError | null };

export interface OperationsRpcExecutor {
  execute(
    functionName: OperationsRpcName,
    args: Record<string, unknown>,
  ): Promise<RpcResult>;
}

type NarrowRpcClient = {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): PromiseLike<RpcResult>;
};

function isOperationsRpcName(value: string): value is OperationsRpcName {
  return (operationsRpcNames as readonly string[]).includes(value);
}

export function createPrivilegedSupabaseOperationsRpcExecutor(
  client: PrivilegedSupabaseClient,
): OperationsRpcExecutor {
  const rpcClient = client as unknown as NarrowRpcClient;
  return {
    async execute(functionName, args) {
      if (!isOperationsRpcName(functionName)) {
        throw new OperationError("persistence");
      }
      const result = await rpcClient.rpc(functionName, args);
      return {
        data: result.data,
        error: result.error
          ? { code: result.error.code, message: result.error.message }
          : null,
      };
    },
  };
}

const operationStatusSchema = z.enum(["succeeded", "duplicate"]);
const conflictDetailSchema = z.strictObject({
  item_id: z.uuid(),
  expected_version: z.number().int().nonnegative(),
  actual_version: z.number().int().nonnegative().nullable(),
  reason: z.enum(["item_missing", "version_mismatch", "state_mismatch"]),
});
const failedResultSchema = z
  .strictObject({
    status: z.literal("failed"),
    operation_id: z.uuid(),
    error_code: z.enum([
      "invalid_action",
      "invalid_payload",
      "human_input_required",
      "stale_target",
      "undo_conflict",
      "not_reversible",
      "rate_limited",
      "internal_error",
    ]),
    conflicts: z.array(conflictDetailSchema).min(1).max(50).optional(),
  })
  .superRefine((value, context) => {
    if (value.conflicts && value.error_code !== "undo_conflict") {
      context.addIssue({
        code: "custom",
        path: ["conflicts"],
        message: "Conflict details are valid only for undo conflicts.",
      });
    }
  });
const applyResultSchema = z.union([z.strictObject({
  status: operationStatusSchema,
  operation_id: z.uuid(),
  applied_action_ids: z.array(z.uuid()).min(1).max(50),
}), failedResultSchema]);
const undoResultSchema = z.union([z.strictObject({
  status: operationStatusSchema,
  operation_id: z.uuid(),
  reverses_operation_id: z.uuid(),
}), failedResultSchema]);
const resetResultSchema = z.union([z.strictObject({
  status: operationStatusSchema,
  operation_id: z.uuid(),
  project_id: z.uuid(),
}), failedResultSchema]);

export type HumanOperationInput = {
  actionId: string;
  confirmed: true;
  response: string;
};

export type ApplyProposalOperation = {
  actorId: string;
  projectId: string;
  proposalId: string;
  selectedActionIds: string[];
  humanInputs: HumanOperationInput[];
  idempotencyKey: string;
};

export type UndoProjectOperation = {
  actorId: string;
  projectId: string;
  operationId: string;
  idempotencyKey: string;
};

export type ResetDemoOperation = {
  actorId: string;
  projectId: string;
  projectSlug: string;
  idempotencyKey: string;
};

export interface ProjectOperationsExecutor {
  applyProposal(input: ApplyProposalOperation): Promise<{
    status: "succeeded" | "duplicate";
    operationId: string;
    appliedActionIds: string[];
  }>;
  undoOperation(input: UndoProjectOperation): Promise<{
    status: "succeeded" | "duplicate";
    operationId: string;
    reversesOperationId: string;
  }>;
  resetDemo(input: ResetDemoOperation): Promise<{
    status: "succeeded" | "duplicate";
    operationId: string;
    projectId: string;
  }>;
}

function persistenceError(error?: RpcError | null) {
  if (error?.code === "40001" || error?.code === "23505") {
    return new OperationError("conflict");
  }
  if (error?.code === "42501") {
    return new OperationError("forbidden");
  }
  return new OperationError("persistence");
}

function failedResultError(
  errorCode: z.infer<typeof failedResultSchema>["error_code"],
  conflicts?: z.infer<typeof conflictDetailSchema>[],
) {
  switch (errorCode) {
    case "stale_target":
    case "undo_conflict":
      return new OperationError(
        "conflict",
        conflicts
          ? {
              conflicts: conflicts.map((conflict) => ({
                itemId: conflict.item_id,
                expectedVersion: conflict.expected_version,
                actualVersion: conflict.actual_version,
                reason: conflict.reason,
              })),
            }
          : undefined,
      );
    case "invalid_action":
    case "invalid_payload":
    case "human_input_required":
    case "not_reversible":
      return new OperationError("validation");
    case "rate_limited":
      return new OperationError("rate_limited");
    case "internal_error":
      return new OperationError("persistence");
  }
}

export function createSupabaseOperationsExecutor(
  rpc: OperationsRpcExecutor,
): ProjectOperationsExecutor {
  return {
    async applyProposal(input) {
      const { data, error } = await rpc.execute("apply_project_proposal", {
        p_actor_id: input.actorId,
        p_project_id: input.projectId,
        p_proposal_id: input.proposalId,
        p_selected_action_ids: input.selectedActionIds,
        p_human_inputs: input.humanInputs.map((humanInput) => ({
          action_id: humanInput.actionId,
          confirmed: humanInput.confirmed,
          response: humanInput.response,
        })),
        p_idempotency_key: input.idempotencyKey,
      });
      if (error) throw persistenceError(error);
      const parsed = applyResultSchema.safeParse(data);
      if (!parsed.success) throw persistenceError();
      if (parsed.data.status === "failed") {
        throw failedResultError(parsed.data.error_code, parsed.data.conflicts);
      }
      return {
        status: parsed.data.status,
        operationId: parsed.data.operation_id,
        appliedActionIds: parsed.data.applied_action_ids,
      };
    },

    async undoOperation(input) {
      const { data, error } = await rpc.execute("undo_project_operation", {
        p_actor_id: input.actorId,
        p_project_id: input.projectId,
        p_operation_id: input.operationId,
        p_idempotency_key: input.idempotencyKey,
      });
      if (error) throw persistenceError(error);
      const parsed = undoResultSchema.safeParse(data);
      if (!parsed.success) throw persistenceError();
      if (parsed.data.status === "failed") {
        throw failedResultError(parsed.data.error_code, parsed.data.conflicts);
      }
      return {
        status: parsed.data.status,
        operationId: parsed.data.operation_id,
        reversesOperationId: parsed.data.reverses_operation_id,
      };
    },

    async resetDemo(input) {
      const { data, error } = await rpc.execute("reset_demo_project", {
        p_actor_id: input.actorId,
        p_project_id: input.projectId,
        p_project_slug: input.projectSlug,
        p_idempotency_key: input.idempotencyKey,
      });
      if (error) throw persistenceError(error);
      const parsed = resetResultSchema.safeParse(data);
      if (!parsed.success) throw persistenceError();
      if (parsed.data.status === "failed") {
        throw failedResultError(parsed.data.error_code, parsed.data.conflicts);
      }
      return {
        status: parsed.data.status,
        operationId: parsed.data.operation_id,
        projectId: parsed.data.project_id,
      };
    },
  };
}

import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import {
  AnalysisError,
  type AnalysisErrorCode,
} from "@/features/analysis/errors";
import { normalizeSourceTextForHash } from "@/features/analysis/request-schemas";
import type {
  AnalysisPersistence,
  CompleteAnalysisInput,
} from "@/features/analysis/service";
import type { PrivilegedSupabaseClient } from "@/lib/supabase/privileged";

type RpcError = {
  code?: string;
  message?: string;
};

type RpcResult = {
  data: unknown;
  error: RpcError | null;
};

export interface AnalysisRpcExecutor {
  execute(
    functionName:
      | "begin_project_analysis"
      | "complete_project_analysis"
      | "fail_project_analysis",
    args: Record<string, unknown>,
  ): Promise<RpcResult>;
}

type NarrowRpcClient = {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): PromiseLike<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
};

/**
 * Narrows the server-only privileged capability to Prompt 7's three allowlisted
 * RPCs. User authorization happens first with the request-scoped client; these
 * wrappers recheck the verified actor in SQL. The generated client RPC overload
 * is intentionally narrowed because its argument union follows the linked
 * schema snapshot.
 */
export function createPrivilegedSupabaseAnalysisRpcExecutor(
  client: PrivilegedSupabaseClient,
): AnalysisRpcExecutor {
  const rpcClient = client as unknown as NarrowRpcClient;
  return {
    async execute(functionName, args) {
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

const nullableUuidSchema = z.uuid().nullable();
const beginResultSchema = z.strictObject({
  status: z.enum(["claimed", "duplicate", "rate_limited"]),
  analysis_request_id: nullableUuidSchema,
  source_document_id: nullableUuidSchema,
  state: z.enum(["processing", "succeeded", "failed"]).nullable(),
  change_event_id: nullableUuidSchema,
  impact_run_id: nullableUuidSchema,
  proposal_id: nullableUuidSchema,
  retry_after_seconds: z.number().int().min(1).max(600).nullable(),
});
const completeResultSchema = z.strictObject({
  status: z.enum(["succeeded", "duplicate_succeeded"]),
  analysis_request_id: z.uuid(),
  source_document_id: z.uuid(),
  change_event_id: z.uuid(),
  impact_run_id: z.uuid(),
  proposal_id: z.uuid(),
  state: z.literal("succeeded"),
});

function persistenceError(error?: RpcError | null): AnalysisError {
  if (
    error?.code === "40001" ||
    error?.message === "analysis_project_changed"
  ) {
    return new AnalysisError("project_changed");
  }
  return new AnalysisError("persistence");
}

function normalizedSourceHash(rawText: string) {
  return createHash("sha256")
    .update(normalizeSourceTextForHash(rawText), "utf8")
    .digest("hex");
}

function databaseFailureCode(errorCode: AnalysisErrorCode) {
  switch (errorCode) {
    case "model_timeout":
      return "model_timeout";
    case "model_unavailable":
      return "model_unavailable";
    case "model_refusal":
    case "model_invalid":
      return "model_invalid_output";
    case "project_changed":
      return "stale_project_revision";
    case "validation":
      return "validation_failed";
    case "unsupported_media_type":
    case "payload_too_large":
    case "in_progress":
    case "duplicate":
    case "rate_limited":
    case "persistence":
      return "internal_error";
  }
}

function usagePayload(
  usage: CompleteAnalysisInput["extractionMetadata"]["usage"],
) {
  if (!usage) return null;
  return {
    input_tokens: usage.inputTokens,
    cached_input_tokens: usage.cachedInputTokens,
    cache_write_input_tokens: usage.cacheWriteInputTokens,
    output_tokens: usage.outputTokens,
    reasoning_output_tokens: usage.reasoningOutputTokens,
    total_tokens: usage.totalTokens,
  };
}

function metadataPayload(
  metadata: CompleteAnalysisInput["extractionMetadata"],
) {
  return {
    request_id: metadata.requestId,
    usage: usagePayload(metadata.usage),
  };
}

function serializeAction(
  action: CompleteAnalysisInput["proposal"]["actions"][number],
) {
  switch (action.type) {
    case "update_item_field":
      return {
        target_item_id: action.targetItemId,
        expected_item_version: action.expectedItemVersion,
        payload: {
          prompt_action_type: action.type,
          field_name: action.field,
          proposed_value: action.proposedValue,
          linked_impact_item_id: action.linkedImpactItemId,
          confidence: action.confidence,
          requires_human_input: action.requiresHumanInput,
        },
        rationale: action.reason,
      };
    case "create_task":
      return {
        target_item_id: null,
        expected_item_version: null,
        payload: {
          prompt_action_type: action.type,
          item_type: "task" as const,
          title: action.data.title,
          description: action.data.description,
          priority: action.data.priority,
          owner_id: action.data.owner_id,
          start_date: action.data.start_date,
          due_date: action.data.due_date,
          linked_impact_item_id: action.linkedImpactItemId,
          confidence: action.confidence,
          requires_human_input: action.requiresHumanInput,
        },
        rationale: action.reason,
      };
    case "create_risk":
      return {
        target_item_id: null,
        expected_item_version: null,
        payload: {
          prompt_action_type: action.type,
          item_type: "risk" as const,
          title: action.data.title,
          description: action.data.description,
          priority: action.data.priority,
          owner_id: action.data.owner_id,
          start_date: null,
          due_date: action.data.due_date,
          linked_impact_item_id: action.linkedImpactItemId,
          confidence: action.confidence,
          requires_human_input: action.requiresHumanInput,
        },
        rationale: action.reason,
      };
    case "request_confirmation":
      return {
        target_item_id: action.targetItemId,
        expected_item_version: null,
        payload: {
          prompt_action_type: action.type,
          question: action.question,
          linked_impact_item_id: action.linkedImpactItemId,
          confidence: action.confidence,
          requires_human_input: true,
        },
        rationale: action.reason,
      };
  }
}

function completionPayload(input: CompleteAnalysisInput) {
  return {
    model_name: input.modelName,
    extraction_metadata: metadataPayload(input.extractionMetadata),
    proposal_metadata: metadataPayload(input.proposalMetadata),
    validation_outcome: {
      status: "needs_review" as const,
      ambiguities: input.change.ambiguities,
      unresolved_references: input.change.unresolvedReferences,
      warnings: input.change.warnings,
      review_reasons: input.change.reviewReasons,
    },
    change: {
      target_item_id: input.change.targetItemId,
      field_name: input.change.field,
      previous_value: input.change.previousValue,
      proposed_value: input.change.proposedValue,
      evidence_text: input.change.evidence.text,
      evidence_start_offset: input.change.evidence.startOffset,
      evidence_end_offset: input.change.evidence.endOffset,
      confidence: input.change.confidence,
      expected_item_version: input.change.expectedItemVersion,
    },
    impact: {
      max_depth: input.maxDepth,
      items: input.proposal.impacts.map((impact) => ({
        item_id: impact.itemId,
        depth: impact.depth,
        path_item_ids: impact.path,
        severity: impact.severity,
        explanation: impact.explanation,
      })),
    },
    proposal: {
      title: input.proposal.title,
      rationale: input.proposal.rationale,
      actions: input.proposal.actions.map(serializeAction),
    },
  };
}

export function createSupabaseAnalysisPersistence(
  rpc: AnalysisRpcExecutor,
): AnalysisPersistence {
  return {
    async begin(input) {
      const { data, error } = await rpc.execute("begin_project_analysis", {
        p_actor_id: input.actorId,
        p_project_id: input.projectId,
        p_expected_project_revision: input.projectRevision,
        p_title: input.source.title,
        p_source_kind: input.source.type,
        p_source_author: input.source.author,
        p_raw_text: input.source.text,
        p_normalized_content_sha256: normalizedSourceHash(input.source.text),
        p_occurred_at: input.source.timestamp,
        p_source_url: null,
        p_model_name: input.modelName,
      });
      if (error) throw persistenceError(error);

      const parsed = beginResultSchema.safeParse(data);
      if (!parsed.success) throw persistenceError();
      if (parsed.data.status === "rate_limited") {
        throw new AnalysisError(
          "rate_limited",
          undefined,
          undefined,
          parsed.data.retry_after_seconds ?? undefined,
        );
      }
      if (!parsed.data.analysis_request_id || !parsed.data.source_document_id) {
        throw persistenceError();
      }
      if (parsed.data.status === "claimed") {
        return {
          kind: "claimed",
          requestId: parsed.data.analysis_request_id,
          sourceDocumentId: parsed.data.source_document_id,
        };
      }
      if (!parsed.data.state) throw persistenceError();
      return {
        kind: "duplicate",
        state: parsed.data.state,
        requestId: parsed.data.analysis_request_id,
        sourceDocumentId: parsed.data.source_document_id,
        changeEventId: parsed.data.change_event_id,
        impactRunId: parsed.data.impact_run_id,
        proposalId: parsed.data.proposal_id,
      };
    },

    async complete(input) {
      const { data, error } = await rpc.execute("complete_project_analysis", {
        p_actor_id: input.actorId,
        p_analysis_request_id: input.requestId,
        p_expected_project_revision: input.projectRevision,
        p_result: completionPayload(input),
      });
      if (error) throw persistenceError(error);
      const parsed = completeResultSchema.safeParse(data);
      if (!parsed.success) throw persistenceError();
      return {
        changeEventId: parsed.data.change_event_id,
        impactRunId: parsed.data.impact_run_id,
        proposalId: parsed.data.proposal_id,
      };
    },

    async fail(input) {
      const { error } = await rpc.execute("fail_project_analysis", {
        p_actor_id: input.actorId,
        p_analysis_request_id: input.requestId,
        p_failure_stage: input.failureStage,
        p_failure_code: databaseFailureCode(input.failureCode),
        p_failure_provider_request_id: input.providerRequestId,
      });
      if (error) throw persistenceError(error);
    },
  };
}

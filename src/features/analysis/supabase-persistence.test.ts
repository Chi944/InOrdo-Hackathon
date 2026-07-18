import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { AnalysisError } from "@/features/analysis/errors";
import {
  createSupabaseAnalysisPersistence,
  type AnalysisRpcExecutor,
} from "@/features/analysis/supabase-persistence";
import { normalizeSourceTextForHash } from "@/features/analysis/request-schemas";

const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
const requestId = "0dd9e279-fee5-4bb6-9e25-3b1a5165a510";
const sourceDocumentId = "e5a80ad3-7d7a-4758-841e-bdd773987e11";
const changedItemId = "3e14b4a4-421d-4d6d-8a7e-01d5a22e3002";
const impactedItemId = "b993a2d1-8060-4c96-a7d0-e79f4cd43303";
const ownerId = "6519012e-13a6-4e3e-9ae5-d09bd3054401";
const sourceText = "  Caf\u0065\u0301 update\r\nThe due date moved.  ";

function executor(result: {
  data: unknown;
  error: { code?: string; message?: string } | null;
}) {
  const execute = vi.fn<AnalysisRpcExecutor["execute"]>(async () => result);
  return {
    execute,
  } satisfies AnalysisRpcExecutor;
}

const usage = {
  inputTokens: 100,
  cachedInputTokens: 10,
  cacheWriteInputTokens: 0,
  outputTokens: 30,
  reasoningOutputTokens: 5,
  totalTokens: 130,
};

describe("Supabase analysis persistence", () => {
  it("claims normalized evidence through the narrow begin RPC", async () => {
    const rpc = executor({
      data: {
        status: "claimed",
        analysis_request_id: requestId,
        source_document_id: sourceDocumentId,
        state: "processing",
        change_event_id: null,
        impact_run_id: null,
        proposal_id: null,
        retry_after_seconds: null,
      },
      error: null,
    });
    const persistence = createSupabaseAnalysisPersistence(rpc);

    await expect(
      persistence.begin({
        actorId: ownerId,
        projectId,
        projectRevision: "a".repeat(64),
        modelName: "gpt-5.6-luna",
        source: {
          title: "Programme update",
          type: "pasted_update",
          author: "Programme team",
          timestamp: null,
          text: sourceText,
        },
      }),
    ).resolves.toEqual({ kind: "claimed", requestId, sourceDocumentId });

    const expectedHash = createHash("sha256")
      .update(normalizeSourceTextForHash(sourceText), "utf8")
      .digest("hex");
    expect(rpc.execute).toHaveBeenCalledWith("begin_project_analysis", {
      p_actor_id: ownerId,
      p_project_id: projectId,
      p_expected_project_revision: "a".repeat(64),
      p_title: "Programme update",
      p_source_kind: "pasted_update",
      p_source_author: "Programme team",
      p_raw_text: sourceText,
      p_normalized_content_sha256: expectedHash,
      p_occurred_at: null,
      p_source_url: null,
      p_model_name: "gpt-5.6-luna",
    });
  });

  it("maps duplicate and rate-limit results without creating a model opportunity", async () => {
    const duplicateRpc = executor({
      data: {
        status: "duplicate",
        analysis_request_id: requestId,
        source_document_id: sourceDocumentId,
        state: "succeeded",
        change_event_id: "2aece803-d4d7-45c3-aab8-5e0e75231501",
        impact_run_id: "57a7c6b7-a3bd-4c2e-8153-219010df1502",
        proposal_id: "5bf63e7d-c8db-4c2d-a3cc-20107cb91503",
        retry_after_seconds: null,
      },
      error: null,
    });
    await expect(
      createSupabaseAnalysisPersistence(duplicateRpc).begin({
        actorId: ownerId,
        projectId,
        projectRevision: "a".repeat(64),
        modelName: "gpt-5.6-luna",
        source: {
          title: "Update",
          type: "pasted_update",
          author: "Team",
          timestamp: null,
          text: "Changed date",
        },
      }),
    ).resolves.toMatchObject({
      kind: "duplicate",
      state: "succeeded",
      requestId,
    });

    const rateRpc = executor({
      data: {
        status: "rate_limited",
        analysis_request_id: null,
        source_document_id: null,
        state: null,
        change_event_id: null,
        impact_run_id: null,
        proposal_id: null,
        retry_after_seconds: 60,
      },
      error: null,
    });
    await expect(
      createSupabaseAnalysisPersistence(rateRpc).begin({
        actorId: ownerId,
        projectId,
        projectRevision: "a".repeat(64),
        modelName: "gpt-5.6-luna",
        source: {
          title: "Update",
          type: "manual_note",
          author: "Team",
          timestamp: null,
          text: "Another changed date",
        },
      }),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("serializes only validated inert completion data", async () => {
    const rpc = executor({
      data: {
        status: "succeeded",
        analysis_request_id: requestId,
        source_document_id: sourceDocumentId,
        change_event_id: "2aece803-d4d7-45c3-aab8-5e0e75231501",
        impact_run_id: "57a7c6b7-a3bd-4c2e-8153-219010df1502",
        proposal_id: "5bf63e7d-c8db-4c2d-a3cc-20107cb91503",
        state: "succeeded",
      },
      error: null,
    });
    const persistence = createSupabaseAnalysisPersistence(rpc);

    await persistence.complete({
      actorId: ownerId,
      requestId,
      projectRevision: "a".repeat(64),
      maxDepth: 5,
      modelName: "gpt-5.6-luna",
      change: {
        targetItemId: changedItemId,
        field: "due_date",
        previousValue: "2026-08-10",
        proposedValue: "2026-08-17",
        evidence: {
          text: "due date moved",
          startOffset: 4,
          endOffset: 18,
        },
        confidence: 0.94,
        expectedItemVersion: 4,
        requiresConfirmation: true,
        reviewReasons: ["human_approval_required"],
        ambiguities: [],
        unresolvedReferences: [],
        warnings: [],
      },
      proposal: {
        title: "Recover the schedule",
        rationale: "Review the downstream event schedule.",
        impacts: [
          {
            itemId: impactedItemId,
            depth: 1,
            path: [changedItemId, impactedItemId],
            severity: "high",
            explanation: "The event depends on the delayed item.",
          },
        ],
        actions: [
          {
            type: "update_item_field",
            targetItemId: impactedItemId,
            expectedItemVersion: 2,
            field: "start_date",
            proposedValue: "2026-09-11",
            reason: "Protect the preparation sequence.",
            linkedImpactItemId: impactedItemId,
            confidence: 0.91,
            requiresHumanInput: false,
          },
          {
            type: "create_task",
            data: {
              title: "Confirm the revised pack date",
              description: null,
              priority: "high",
              owner_id: ownerId,
              start_date: null,
              due_date: "2026-08-12",
            },
            reason: "Get an explicit confirmation.",
            linkedImpactItemId: impactedItemId,
            confidence: 0.82,
            requiresHumanInput: false,
          },
          {
            type: "request_confirmation",
            targetItemId: impactedItemId,
            question: "Should the event preparation move?",
            reason: "A replacement date is missing.",
            linkedImpactItemId: impactedItemId,
            confidence: 0.7,
            requiresHumanInput: true,
          },
        ],
      },
      extractionMetadata: {
        requestId: "req_test_extract",
        responseId: "resp_test_extract",
        model: "gpt-5.6-luna",
        usage,
      },
      proposalMetadata: {
        requestId: "req_test_propose",
        responseId: "resp_test_propose",
        model: "gpt-5.6-luna",
        usage: null,
      },
    });

    expect(rpc.execute).toHaveBeenCalledTimes(1);
    const [, args] = rpc.execute.mock.calls[0]!;
    expect(args).toMatchObject({
      p_actor_id: ownerId,
      p_analysis_request_id: requestId,
      p_expected_project_revision: "a".repeat(64),
      p_result: {
        model_name: "gpt-5.6-luna",
        validation_outcome: {
          status: "needs_review",
          review_reasons: ["human_approval_required"],
        },
        change: {
          target_item_id: changedItemId,
          field_name: "due_date",
          expected_item_version: 4,
        },
        impact: {
          max_depth: 5,
          items: [
            {
              item_id: impactedItemId,
              depth: 1,
              path_item_ids: [changedItemId, impactedItemId],
              severity: "high",
            },
          ],
        },
        proposal: {
          actions: [
            {
              target_item_id: impactedItemId,
              expected_item_version: 2,
              payload: { prompt_action_type: "update_item_field" },
            },
            {
              target_item_id: null,
              expected_item_version: null,
              payload: { prompt_action_type: "create_task", item_type: "task" },
            },
            {
              target_item_id: impactedItemId,
              expected_item_version: null,
              payload: { prompt_action_type: "request_confirmation" },
            },
          ],
        },
      },
    });
    expect(JSON.stringify(args)).not.toContain(sourceText);
    expect(JSON.stringify(args)).not.toContain("execute_sql");
  });

  it("maps stale revisions and all other database errors without leaking internals", async () => {
    const stale = executor({
      data: null,
      error: { code: "P0001", message: "analysis_project_changed" },
    });
    await expect(
      createSupabaseAnalysisPersistence(stale).begin({
        actorId: ownerId,
        projectId,
        projectRevision: "a".repeat(64),
        modelName: "gpt-5.6-luna",
        source: {
          title: "Update",
          type: "manual_note",
          author: "Team",
          timestamp: null,
          text: "Changed date",
        },
      }),
    ).rejects.toMatchObject({ code: "project_changed" });

    const privateMessage = "password=private database detail";
    const failed = executor({
      data: null,
      error: { code: "XX000", message: privateMessage },
    });
    try {
      await createSupabaseAnalysisPersistence(failed).fail({
        actorId: ownerId,
        requestId,
        failureCode: "model_invalid",
        failureStage: "extraction",
        providerRequestId: null,
      });
      throw new Error("Expected persistence failure");
    } catch (error) {
      expect(error).toBeInstanceOf(AnalysisError);
      expect((error as Error).message).not.toContain(privateMessage);
    }
  });
});

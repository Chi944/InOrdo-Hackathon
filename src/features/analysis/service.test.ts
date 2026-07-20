import { describe, expect, it, vi } from "vitest";

import type { ProjectAnalysisContext } from "@/features/analysis/context";
import { AnalysisError } from "@/features/analysis/errors";
import type { AnalysisProviderPolicy } from "@/features/analysis/provider-policy";
import {
  AnalysisModelError,
  type OpenAIAnalysisAdapter,
} from "@/features/analysis/openai-adapter";
import {
  type AnalysisPersistence,
  createProjectAnalysisService,
} from "@/features/analysis/service";
import type { AuthorizedProjectScope } from "@/lib/auth/guards";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

const workspaceId = "166645ec-1ab3-48dc-98c7-3b6f99b70301";
const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
const userId = "6519012e-13a6-4e3e-9ae5-d09bd3054401";
const changedItemId = "3e14b4a4-421d-4d6d-8a7e-01d5a22e3002";
const impactedItemId = "b993a2d1-8060-4c96-a7d0-e79f4cd43303";
const requestId = "0dd9e279-fee5-4bb6-9e25-3b1a5165a510";
const sourceDocumentId = "e5a80ad3-7d7a-4758-841e-bdd773987e11";
const extractionEvidence = "briefing pack due date moved to 2026-08-17";
const recordingPolicy: AnalysisProviderPolicy = {
  mode: "recording",
  recordingReady: true,
  gatewayReady: false,
  recordingModelName: "gpt-5.6-luna",
  gatewayModelName: "openai/gpt-oss-20b",
};

const scope: AuthorizedProjectScope = {
  workspaceId,
  projectId,
  membership: { workspaceId, userId, role: "member" },
};

const context: ProjectAnalysisContext = {
  revision: "a".repeat(64),
  items: [
    {
      id: changedItemId,
      itemKey: "PACK-01",
      itemType: "task",
      title: "Prepare briefing pack",
      description: null,
      status: "in_progress",
      priority: "high",
      ownerId: userId,
      startDate: "2026-08-01",
      dueDate: "2026-08-10",
      eventDate: null,
      version: 4,
    },
    {
      id: impactedItemId,
      itemKey: "EVENT-01",
      itemType: "event",
      title: "Regional summit",
      description: null,
      status: "not_started",
      priority: "critical",
      ownerId: null,
      startDate: "2026-09-12",
      dueDate: "2026-09-12",
      eventDate: "2026-09-12",
      version: 2,
    },
  ],
  graph: {
    items: [
      { id: changedItemId, active: true },
      { id: impactedItemId, active: true },
    ],
    dependencies: [
      {
        fromItemId: impactedItemId,
        toItemId: changedItemId,
        relationship: "requires",
      },
    ],
  },
};

const request = {
  source: {
    title: "Programme update",
    type: "pasted_update",
    author: "Programme team",
    timestamp: "2026-07-18T09:30:00+08:00",
    text: "The briefing pack due date moved to 2026-08-17.",
  },
  maxDepth: 5,
};

const extractionMetadata = {
  requestId: "req_test_extraction",
  responseId: "resp_test_extraction",
  model: "gpt-5.6-luna",
  usage: {
    inputTokens: 100,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: 50,
    reasoningOutputTokens: 10,
    totalTokens: 150,
  },
};

const proposalMetadata = {
  ...extractionMetadata,
  requestId: "req_test_proposal",
  responseId: "resp_test_proposal",
  usage: { ...extractionMetadata.usage, inputTokens: 80, totalTokens: 130 },
};

function dependencies() {
  const authorize = vi.fn(async () => ({ user: { id: userId, email: null }, scope }));
  const loadContext = vi.fn(async () => context);
  const begin = vi.fn<AnalysisPersistence["begin"]>(async () => ({
    kind: "claimed",
    requestId,
    sourceDocumentId,
    providerRoute: "openai_recording",
    modelName: "gpt-5.6-luna",
  }));
  const complete = vi.fn<AnalysisPersistence["complete"]>(async () => ({
    changeEventId: "2aece803-d4d7-45c3-aab8-5e0e75231501",
    impactRunId: "57a7c6b7-a3bd-4c2e-8153-219010df1502",
    proposalId: "5bf63e7d-c8db-4c2d-a3cc-20107cb91503",
  }));
  const fail = vi.fn<AnalysisPersistence["fail"]>(async () => undefined);
  const persistence = {
    begin,
    complete,
    fail,
  } satisfies AnalysisPersistence;
  const extractChange = vi.fn<OpenAIAnalysisAdapter["extractChange"]>(async () => ({
    data: {
      change: {
        targetItemId: changedItemId,
        field: "due_date",
        previousValue: "2026-08-10",
        proposedValue: "2026-08-17",
        evidence: {
          text: extractionEvidence,
          startOffset: request.source.text.indexOf(extractionEvidence),
          endOffset:
            request.source.text.indexOf(extractionEvidence) +
            extractionEvidence.length,
        },
        confidence: 0.94,
      },
      ambiguities: [],
      unresolvedReferences: [],
      warnings: [],
    },
    metadata: extractionMetadata,
  }));
  const draftProposal = vi.fn<OpenAIAnalysisAdapter["draftProposal"]>(async () => ({
    data: {
      title: "Recover the briefing schedule",
      rationale: "Keep summit preparation aligned.",
      impactAnnotations: [
        {
          itemId: impactedItemId,
          severity: "high",
          explanation: "The event preparation depends on the pack.",
        },
      ],
      actions: [
        {
          type: "request_confirmation",
          targetItemId: impactedItemId,
          question: "Should the event preparation dates move?",
          reason: "The source does not set a replacement date.",
          linkedImpactItemId: impactedItemId,
          confidence: 0.7,
          requiresHumanInput: true,
        },
      ],
    },
    metadata: proposalMetadata,
  }));
  const model = {
    extractChange,
    draftProposal,
  } satisfies OpenAIAnalysisAdapter;

  return { authorize, loadContext, persistence, model };
}

describe("project analysis service", () => {
  it("persists evidence before exactly two bounded model stages and stores inert derived data", async () => {
    const deps = dependencies();
    const service = createProjectAnalysisService({
      client: {} as ServerSupabaseClient,
      ...deps,
      providerPolicy: recordingPolicy,
    });

    await expect(service.analyze(projectId, request)).resolves.toMatchObject({
      kind: "completed",
      requestId,
      sourceDocumentId,
      model: "gpt-5.6-luna",
    });
    expect(deps.persistence.begin).toHaveBeenCalledTimes(1);
    expect(deps.persistence.begin).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: userId,
        providerPolicy: recordingPolicy,
      }),
    );
    expect(deps.model.extractChange).toHaveBeenCalledTimes(1);
    expect(deps.model.draftProposal).toHaveBeenCalledTimes(1);
    expect(deps.persistence.complete).toHaveBeenCalledTimes(1);
    expect(deps.persistence.begin.mock.invocationCallOrder[0]).toBeLessThan(
      deps.model.extractChange.mock.invocationCallOrder[0]!,
    );
    expect(deps.model.extractChange.mock.invocationCallOrder[0]).toBeLessThan(
      deps.model.draftProposal.mock.invocationCallOrder[0]!,
    );
    expect(deps.persistence.complete.mock.invocationCallOrder[0]).toBeGreaterThan(
      deps.model.draftProposal.mock.invocationCallOrder[0]!,
    );

    const completion = deps.persistence.complete.mock.calls[0]?.[0];
    expect(completion).toMatchObject({
      actorId: userId,
      requestId,
      projectRevision: context.revision,
      maxDepth: 5,
      change: {
        targetItemId: changedItemId,
        previousValue: "2026-08-10",
        requiresConfirmation: true,
      },
      proposal: {
        impacts: [
          {
            itemId: impactedItemId,
            depth: 1,
            path: [changedItemId, impactedItemId],
          },
        ],
      },
    });
    expect(completion).not.toHaveProperty("source");
  });

  it("does not call the model for a duplicate completed request", async () => {
    const deps = dependencies();
    deps.persistence.begin.mockResolvedValueOnce({
      kind: "duplicate",
      state: "succeeded",
      requestId,
      sourceDocumentId,
      changeEventId: "2aece803-d4d7-45c3-aab8-5e0e75231501",
      impactRunId: "57a7c6b7-a3bd-4c2e-8153-219010df1502",
      proposalId: "5bf63e7d-c8db-4c2d-a3cc-20107cb91503",
      retryAfterSeconds: null,
    });
    const service = createProjectAnalysisService({
      client: {} as ServerSupabaseClient,
      ...deps,
    });

    await expect(service.analyze(projectId, request)).resolves.toMatchObject({
      kind: "duplicate",
      state: "succeeded",
      requestId,
    });
    expect(deps.model.extractChange).not.toHaveBeenCalled();
    expect(deps.model.draftProposal).not.toHaveBeenCalled();
    expect(deps.persistence.complete).not.toHaveBeenCalled();
  });

  it.each([
    { state: "processing" as const, retryAfterSeconds: 120 },
    { state: "failed" as const, retryAfterSeconds: null },
  ])("does not call the model for a duplicate $state request", async (duplicate) => {
    const deps = dependencies();
    deps.persistence.begin.mockResolvedValueOnce({
      kind: "duplicate",
      requestId,
      sourceDocumentId,
      changeEventId: null,
      impactRunId: null,
      proposalId: null,
      ...duplicate,
    });
    const service = createProjectAnalysisService({
      client: {} as ServerSupabaseClient,
      ...deps,
    });

    await expect(service.analyze(projectId, request)).resolves.toMatchObject({
      kind: "duplicate",
      state: duplicate.state,
      requestId,
    });
    expect(deps.model.extractChange).not.toHaveBeenCalled();
    expect(deps.model.draftProposal).not.toHaveBeenCalled();
    expect(deps.persistence.complete).not.toHaveBeenCalled();
    expect(deps.persistence.fail).not.toHaveBeenCalled();
  });

  it("fails closed before proposal drafting when extraction evidence is invalid", async () => {
    const deps = dependencies();
    deps.model.extractChange.mockResolvedValueOnce({
      data: {
        change: {
          targetItemId: changedItemId,
          field: "due_date",
          previousValue: "2026-08-10",
          proposedValue: "2026-08-17",
          evidence: {
            text: "fabricated evidence",
            startOffset: null,
            endOffset: null,
          },
          confidence: 0.94,
        },
        ambiguities: [],
        unresolvedReferences: [],
        warnings: [],
      },
      metadata: extractionMetadata,
    });
    const service = createProjectAnalysisService({
      client: {} as ServerSupabaseClient,
      ...deps,
    });

    await expect(service.analyze(projectId, request)).rejects.toMatchObject({
      code: "model_invalid",
    });
    expect(deps.model.draftProposal).not.toHaveBeenCalled();
    expect(deps.persistence.complete).not.toHaveBeenCalled();
    expect(deps.persistence.fail).toHaveBeenCalledWith(
      expect.objectContaining({ requestId, failureCode: "model_invalid" }),
    );
  });

  it("maps timeout safely, records only safe failure metadata, and never completes", async () => {
    const deps = dependencies();
    deps.model.extractChange.mockRejectedValueOnce(
      new AnalysisModelError("timeout", "provider timeout", {
        requestId: "req_timeout_test",
      }),
    );
    const service = createProjectAnalysisService({
      client: {} as ServerSupabaseClient,
      ...deps,
    });

    await expect(service.analyze(projectId, request)).rejects.toMatchObject({
      code: "model_timeout",
    });
    expect(deps.persistence.fail).toHaveBeenCalledWith({
      actorId: userId,
      requestId,
      failureCode: "model_timeout",
      failureStage: "extraction",
      providerRequestId: "req_timeout_test",
    });
    expect(JSON.stringify(deps.persistence.fail.mock.calls)).not.toContain(
      request.source.text,
    );
    expect(deps.persistence.complete).not.toHaveBeenCalled();
  });

  it("does not include raw evidence in the second model call", async () => {
    const deps = dependencies();
    const service = createProjectAnalysisService({
      client: {} as ServerSupabaseClient,
      ...deps,
    });

    await service.analyze(projectId, request);

    const proposalCall = deps.model.draftProposal.mock.calls[0]?.[0];
    expect(JSON.stringify(proposalCall)).not.toContain(request.source.text);
    expect(JSON.stringify(proposalCall)).toContain(impactedItemId);
  });

  it("does not swallow authorization failures before evidence intake", async () => {
    const deps = dependencies();
    deps.authorize.mockRejectedValueOnce(new Error("authorization stopped"));
    const service = createProjectAnalysisService({
      client: {} as ServerSupabaseClient,
      ...deps,
    });

    await expect(service.analyze(projectId, request)).rejects.toThrow(
      "authorization stopped",
    );
    expect(deps.persistence.begin).not.toHaveBeenCalled();
    expect(deps.model.extractChange).not.toHaveBeenCalled();
  });

  it("checks model configuration before creating an idempotency claim", async () => {
    const deps = dependencies();
    const resolveModelName = vi.fn(() => {
      throw new Error("test-only missing model configuration");
    });
    const service = createProjectAnalysisService({
      client: {} as ServerSupabaseClient,
      ...deps,
      resolveModelName,
    });

    await expect(service.analyze(projectId, request)).rejects.toMatchObject({
      code: "model_unavailable",
    });
    expect(resolveModelName).toHaveBeenCalledOnce();
    expect(deps.persistence.begin).not.toHaveBeenCalled();
    expect(deps.persistence.complete).not.toHaveBeenCalled();
    expect(deps.persistence.fail).not.toHaveBeenCalled();
    expect(deps.model.extractChange).not.toHaveBeenCalled();
    expect(deps.model.draftProposal).not.toHaveBeenCalled();
  });

  it("propagates a stale-project conflict from atomic completion and marks the claim failed", async () => {
    const deps = dependencies();
    deps.persistence.complete.mockRejectedValueOnce(
      new AnalysisError("project_changed"),
    );
    const service = createProjectAnalysisService({
      client: {} as ServerSupabaseClient,
      ...deps,
    });

    await expect(service.analyze(projectId, request)).rejects.toMatchObject({
      code: "project_changed",
    });
    expect(deps.persistence.fail).toHaveBeenCalledWith(
      expect.objectContaining({ requestId, failureCode: "project_changed" }),
    );
  });
});

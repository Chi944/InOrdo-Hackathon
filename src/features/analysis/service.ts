import "server-only";

import type {
  ProjectAnalysisContext,
} from "@/features/analysis/context";
import {
  loadProjectAnalysisContext,
} from "@/features/analysis/context";
import {
  AnalysisError,
  type AnalysisErrorCode,
} from "@/features/analysis/errors";
import {
  buildBoundedModelItemContext,
  type ModelContextItem,
  ModelContextBoundsError,
} from "@/features/analysis/model-context";
import type {
  AnalysisModelMetadata,
  OpenAIAnalysisAdapter,
} from "@/features/analysis/openai-adapter";
import { AnalysisModelError } from "@/features/analysis/openai-adapter";
import {
  type ValidatedChange,
  type ValidatedRecoveryProposal,
  validateChangeExtraction,
  validateRecoveryProposal,
} from "@/features/analysis/post-validation";
import {
  buildExtractionPrompt,
  buildProposalPrompt,
  type PromptJson,
} from "@/features/analysis/prompts";
import {
  analyzeProjectRequestSchema,
  type AnalysisSource,
} from "@/features/analysis/request-schemas";
import { traverseImpactGraph } from "@/features/impact/traverse";
import {
  requireCurrentUserProjectAccess,
  workspaceContributorRoles,
  type CurrentUserProjectAccess,
} from "@/lib/auth/guards";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

export type BeginAnalysisResult =
  | {
      kind: "claimed";
      requestId: string;
      sourceDocumentId: string;
    }
  | {
      kind: "duplicate";
      state: "processing" | "succeeded" | "failed";
      requestId: string;
      sourceDocumentId: string;
      changeEventId: string | null;
      impactRunId: string | null;
      proposalId: string | null;
    };

export type CompleteAnalysisInput = {
  actorId: string;
  requestId: string;
  projectRevision: string;
  maxDepth: number;
  modelName: string;
  change: ValidatedChange;
  proposal: ValidatedRecoveryProposal;
  extractionMetadata: AnalysisModelMetadata;
  proposalMetadata: AnalysisModelMetadata;
};

export type CompleteAnalysisResult = {
  changeEventId: string;
  impactRunId: string;
  proposalId: string;
};

export type FailAnalysisInput = {
  actorId: string;
  requestId: string;
  failureCode: AnalysisErrorCode;
  failureStage: "extraction" | "proposal" | "persistence";
  providerRequestId: string | null;
};

export interface AnalysisPersistence {
  begin(input: {
    actorId: string;
    projectId: string;
    projectRevision: string;
    source: AnalysisSource;
    modelName: string;
  }): Promise<BeginAnalysisResult>;
  complete(input: CompleteAnalysisInput): Promise<CompleteAnalysisResult>;
  fail(input: FailAnalysisInput): Promise<void>;
}

type AnalysisAuthorizer = (
  client: ServerSupabaseClient,
  projectId: string,
) => Promise<CurrentUserProjectAccess>;

export type ProjectAnalysisServiceResult =
  | ({
      kind: "completed";
      requestId: string;
      sourceDocumentId: string;
      model: string;
      extraction: AnalysisModelMetadata;
      proposal: AnalysisModelMetadata;
    } & CompleteAnalysisResult)
  | Extract<BeginAnalysisResult, { kind: "duplicate" }>;

type CreateProjectAnalysisServiceOptions = {
  client: ServerSupabaseClient;
  persistence: AnalysisPersistence;
  model: OpenAIAnalysisAdapter;
  modelName?: string;
  resolveModelName?: () => string | Promise<string>;
  authorize?: AnalysisAuthorizer;
  loadContext?: (
    client: ServerSupabaseClient,
    scope: CurrentUserProjectAccess["scope"],
  ) => Promise<ProjectAnalysisContext>;
};

const defaultAuthorizer: AnalysisAuthorizer = (client, projectId) =>
  requireCurrentUserProjectAccess(client, projectId, workspaceContributorRoles);

function contextForExtraction(
  context: ProjectAnalysisContext,
  modelItems: readonly ModelContextItem[],
): PromptJson {
  return {
    projectRevision: context.revision,
    items: modelItems.map((item) => ({
      id: item.id,
      key: item.itemKey,
      type: item.itemType,
      title: item.title,
      description: item.description,
      descriptionTruncated: item.descriptionTruncated,
      status: item.status,
      priority: item.priority,
      ownerId: item.ownerId,
      startDate: item.startDate,
      dueDate: item.dueDate,
      eventDate: item.eventDate,
      version: item.version,
    })),
  };
}

function modelErrorToAnalysisError(error: AnalysisModelError): AnalysisError {
  switch (error.code) {
    case "timeout":
      return new AnalysisError("model_timeout", undefined, error);
    case "refusal":
      return new AnalysisError("model_refusal", undefined, error);
    case "incomplete":
    case "malformed_output":
    case "invalid_request":
      return new AnalysisError("model_invalid", undefined, error);
    case "transient_provider":
    case "provider_failure":
      return new AnalysisError("model_unavailable", undefined, error);
  }
}

function failureProviderRequestId(error: unknown): string | null {
  if (error instanceof AnalysisModelError) {
    return error.requestId;
  }
  if (error instanceof AnalysisError && error.cause instanceof AnalysisModelError) {
    return error.cause.requestId;
  }
  return null;
}

function safeAnalysisError(error: unknown): AnalysisError {
  if (error instanceof AnalysisError) return error;
  if (error instanceof AnalysisModelError) return modelErrorToAnalysisError(error);
  return new AnalysisError("persistence", undefined, error);
}

function proposalAffectedItems(
  modelItems: readonly ModelContextItem[],
  itemIds: ReadonlySet<string>,
): PromptJson {
  return modelItems
    .filter(({ id }) => itemIds.has(id))
    .map((item) => ({
      id: item.id,
      key: item.itemKey,
      type: item.itemType,
      title: item.title,
      description: item.description,
      descriptionTruncated: item.descriptionTruncated,
      status: item.status,
      priority: item.priority,
      ownerId: item.ownerId,
      startDate: item.startDate,
      dueDate: item.dueDate,
      eventDate: item.eventDate,
      version: item.version,
    }));
}

export function createProjectAnalysisService({
  client,
  persistence,
  model,
  modelName = "gpt-5.6-luna",
  resolveModelName = () => modelName,
  authorize = defaultAuthorizer,
  loadContext = loadProjectAnalysisContext,
}: CreateProjectAnalysisServiceOptions) {
  return {
    async analyze(
      projectId: string,
      input: unknown,
    ): Promise<ProjectAnalysisServiceResult> {
      const parsed = analyzeProjectRequestSchema.safeParse(input);
      if (!parsed.success) {
        throw new AnalysisError(
          "validation",
          parsed.error.issues[0]?.message,
        );
      }

      const { user, scope } = await authorize(client, projectId);
      const context = await loadContext(client, scope);
      let modelItems: ModelContextItem[];
      try {
        modelItems = buildBoundedModelItemContext(context.items);
      } catch (error) {
        if (error instanceof ModelContextBoundsError) {
          throw new AnalysisError("validation", error.message, error);
        }
        throw error;
      }
      let activeModelName: string;
      try {
        activeModelName = await resolveModelName();
      } catch (error) {
        throw new AnalysisError("model_unavailable", undefined, error);
      }
      const beginning = await persistence.begin({
        actorId: user.id,
        projectId,
        projectRevision: context.revision,
        source: parsed.data.source,
        modelName: activeModelName,
      });
      if (beginning.kind === "duplicate") return beginning;

      let latestProviderRequestId: string | null = null;
      let failureStage: FailAnalysisInput["failureStage"] = "extraction";

      try {
        const extraction = await model.extractChange({
          ...buildExtractionPrompt({
            source: {
              title: parsed.data.source.title,
              type: parsed.data.source.type,
              author: parsed.data.source.author,
              timestamp: parsed.data.source.timestamp,
              text: parsed.data.source.text,
            },
            projectContext: contextForExtraction(context, modelItems),
          }),
          metadata: {
            analysis_request_id: beginning.requestId,
            project_id: projectId,
            analysis_stage_version: "extraction-v1",
          },
        });
        latestProviderRequestId = extraction.metadata.requestId;
        const change = validateChangeExtraction(
          extraction.data,
          parsed.data.source.text,
          context,
        );
        const traversal = traverseImpactGraph({
          changedItemId: change.targetItemId,
          items: context.graph.items,
          dependencies: context.graph.dependencies,
          maxDepth: parsed.data.maxDepth,
        });
        const proposalItemIds = new Set([
          change.targetItemId,
          ...traversal.impacts.map(({ itemId }) => itemId),
        ]);
        failureStage = "proposal";
        const proposalDraft = await model.draftProposal({
          ...buildProposalPrompt({
            change: {
              targetItemId: change.targetItemId,
              field: change.field,
              previousValue: change.previousValue,
              proposedValue: change.proposedValue,
              confidence: change.confidence,
              requiresConfirmation: change.requiresConfirmation,
              reviewReasons: change.reviewReasons,
            },
            deterministicImpacts: traversal.impacts.map((impact) => ({
              itemId: impact.itemId,
              depth: impact.depth,
              path: impact.path,
            })),
            affectedItems: proposalAffectedItems(modelItems, proposalItemIds),
          }),
          metadata: {
            analysis_request_id: beginning.requestId,
            project_id: projectId,
            analysis_stage_version: "proposal-v1",
          },
        });
        latestProviderRequestId = proposalDraft.metadata.requestId;
        const proposal = validateRecoveryProposal(
          proposalDraft.data,
          change,
          traversal,
          context,
        );
        failureStage = "persistence";
        const completed = await persistence.complete({
          actorId: user.id,
          requestId: beginning.requestId,
          projectRevision: context.revision,
          maxDepth: parsed.data.maxDepth,
          modelName: activeModelName,
          change,
          proposal,
          extractionMetadata: extraction.metadata,
          proposalMetadata: proposalDraft.metadata,
        });

        return {
          kind: "completed",
          requestId: beginning.requestId,
          sourceDocumentId: beginning.sourceDocumentId,
          model: proposalDraft.metadata.model,
          extraction: extraction.metadata,
          proposal: proposalDraft.metadata,
          ...completed,
        };
      } catch (error) {
        const safeError = safeAnalysisError(error);
        const providerRequestId =
          failureProviderRequestId(error) ?? latestProviderRequestId;
        try {
          await persistence.fail({
            actorId: user.id,
            requestId: beginning.requestId,
            failureCode: safeError.code,
            failureStage,
            providerRequestId,
          });
        } catch {
          // Preserve the original safe failure. The processing claim remains a
          // visible signal for operator reconciliation if failure recording fails.
        }
        throw safeError;
      }
    },
  };
}

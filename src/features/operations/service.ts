import "server-only";

import { OperationError } from "@/features/operations/errors";
import {
  applyProposalRequestSchema,
  operationHistoryQuerySchema,
  resetDemoRequestSchema,
  undoOperationRequestSchema,
  type ApplyProposalRequest,
  type OperationHistoryQuery,
  type ResetDemoRequest,
  type UndoOperationRequest,
} from "@/features/operations/request-schemas";
import type { ProjectOperationsExecutor } from "@/features/operations/supabase-persistence";
import type {
  AuthorizedProjectScope,
  CurrentUserProjectAccess,
} from "@/lib/auth/guards";

type ResetConfiguration = {
  projectSlug: string;
};

export interface ProjectOperationsServiceDependencies<HistoryEntry = unknown> {
  authorize(projectId: string): Promise<CurrentUserProjectAccess>;
  authorizeRead?(projectId: string): Promise<CurrentUserProjectAccess>;
  getExecutor(): ProjectOperationsExecutor;
  getResetConfiguration(): ResetConfiguration;
  listHistory(
    scope: AuthorizedProjectScope,
    query: OperationHistoryQuery,
  ): Promise<HistoryEntry[]>;
}

function parseOrThrow<T>(parser: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, value: unknown): T {
  const parsed = parser.safeParse(value);
  if (!parsed.success) throw new OperationError("validation");
  return parsed.data;
}

export function createProjectOperationsService<HistoryEntry = unknown>(
  dependencies: ProjectOperationsServiceDependencies<HistoryEntry>,
) {
  return {
    async applyProposal(
      projectId: string,
      proposalId: string,
      request: ApplyProposalRequest,
    ) {
      const input = parseOrThrow(applyProposalRequestSchema, request);
      const access = await dependencies.authorize(projectId);
      return dependencies.getExecutor().applyProposal({
        actorId: access.user.id,
        projectId: access.scope.projectId,
        proposalId,
        ...input,
      });
    },

    async undoOperation(
      projectId: string,
      operationId: string,
      request: UndoOperationRequest,
    ) {
      const input = parseOrThrow(undoOperationRequestSchema, request);
      const access = await dependencies.authorize(projectId);
      return dependencies.getExecutor().undoOperation({
        actorId: access.user.id,
        projectId: access.scope.projectId,
        operationId,
        idempotencyKey: input.idempotencyKey,
      });
    },

    async resetDemo(
      projectId: string,
      request: ResetDemoRequest,
    ) {
      const input = parseOrThrow(resetDemoRequestSchema, request);
      const access = await dependencies.authorize(projectId);
      let configuration: ResetConfiguration;
      try {
        configuration = dependencies.getResetConfiguration();
      } catch {
        throw new OperationError("reset_unavailable");
      }
      return dependencies.getExecutor().resetDemo({
        actorId: access.user.id,
        projectId: access.scope.projectId,
        projectSlug: configuration.projectSlug,
        idempotencyKey: input.idempotencyKey,
      });
    },

    async listHistory(projectId: string, request: OperationHistoryQuery) {
      const query = parseOrThrow(operationHistoryQuerySchema, request);
      const access = await (
        dependencies.authorizeRead ?? dependencies.authorize
      )(projectId);
      return dependencies.listHistory(access.scope, query);
    },
  };
}

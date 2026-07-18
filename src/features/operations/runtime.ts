import "server-only";

import { listOperationHistory } from "@/features/operations/history";
import type { ResetDemoRequest } from "@/features/operations/request-schemas";
import { createProjectOperationsService } from "@/features/operations/service";
import {
  createPrivilegedSupabaseOperationsRpcExecutor,
  createSupabaseOperationsExecutor,
  type ProjectOperationsExecutor,
} from "@/features/operations/supabase-persistence";
import {
  requireCurrentUserProjectAccess,
  workspaceAdministratorRoles,
  workspaceReadRoles,
} from "@/lib/auth/guards";
import { getDemoResetEnv } from "@/lib/env/server";
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

export function createProjectOperationsRuntime(client: ServerSupabaseClient) {
  let initializedExecutor: ProjectOperationsExecutor | null = null;
  const getExecutor = () => {
    initializedExecutor ??= createSupabaseOperationsExecutor(
      createPrivilegedSupabaseOperationsRpcExecutor(
        createPrivilegedSupabaseClient(),
      ),
    );
    return initializedExecutor;
  };

  const service = createProjectOperationsService({
    authorize: (projectId) =>
      requireCurrentUserProjectAccess(
        client,
        projectId,
        workspaceAdministratorRoles,
      ),
    authorizeRead: (projectId) =>
      requireCurrentUserProjectAccess(client, projectId, workspaceReadRoles),
    getExecutor,
    getResetConfiguration: () => {
      const environment = getDemoResetEnv();
      return {
        projectSlug: environment.DEMO_PROJECT_SLUG,
      };
    },
    listHistory: (scope, query) => listOperationHistory(client, scope, query),
  });

  return {
    applyProposal: service.applyProposal,
    undoOperation: service.undoOperation,
    listHistory: service.listHistory,
    resetDemo(projectId: string, request: ResetDemoRequest) {
      return service.resetDemo(projectId, request);
    },
  };
}

import { handleUndoOperationPost } from "@/features/operations/route-handler";
import { createProjectOperationsRuntime } from "@/features/operations/runtime";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type UndoRouteContext = {
  params: Promise<{ projectId: string; operationId: string }>;
};

export async function POST(request: Request, context: UndoRouteContext) {
  const responseHeaders = new Headers();
  const client = await createServerSupabaseClient({ responseHeaders });
  const service = createProjectOperationsRuntime(client);
  const { projectId, operationId } = await context.params;

  return handleUndoOperationPost({
    request,
    projectId,
    operationId,
    responseHeaders,
    execute: (authorizedProjectId, authorizedOperationId, input) =>
      service.undoOperation(
        authorizedProjectId,
        authorizedOperationId,
        input,
      ),
  });
}

import { handleOperationHistoryGet } from "@/features/operations/route-handler";
import { createProjectOperationsRuntime } from "@/features/operations/runtime";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type HistoryRouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(request: Request, context: HistoryRouteContext) {
  const responseHeaders = new Headers();
  const client = await createServerSupabaseClient({ responseHeaders });
  const service = createProjectOperationsRuntime(client);
  const { projectId } = await context.params;

  return handleOperationHistoryGet({
    request,
    projectId,
    responseHeaders,
    execute: (authorizedProjectId, query) =>
      service.listHistory(authorizedProjectId, query),
  });
}

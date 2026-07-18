import { handleResetDemoPost } from "@/features/operations/route-handler";
import { createProjectOperationsRuntime } from "@/features/operations/runtime";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ResetRouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: ResetRouteContext) {
  const responseHeaders = new Headers();
  const client = await createServerSupabaseClient({ responseHeaders });
  const service = createProjectOperationsRuntime(client);
  const { projectId } = await context.params;

  return handleResetDemoPost({
    request,
    projectId,
    responseHeaders,
    execute: (authorizedProjectId, input) =>
      service.resetDemo(authorizedProjectId, input),
  });
}

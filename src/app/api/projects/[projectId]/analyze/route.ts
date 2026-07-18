import {
  handleAnalyzeProjectPost,
} from "@/features/analysis/route-handler";
import { createProjectAnalysisRuntime } from "@/features/analysis/runtime";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type AnalyzeRouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: AnalyzeRouteContext) {
  const responseHeaders = new Headers();
  const client = await createServerSupabaseClient({ responseHeaders });
  const service = createProjectAnalysisRuntime(client);
  const { projectId } = await context.params;

  return handleAnalyzeProjectPost({
    request,
    projectId,
    responseHeaders,
    execute: (authorizedProjectId, input) =>
      service.analyze(authorizedProjectId, input),
  });
}

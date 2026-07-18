import { handleApplyProposalPost } from "@/features/operations/route-handler";
import { createProjectOperationsRuntime } from "@/features/operations/runtime";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ApplyRouteContext = {
  params: Promise<{ projectId: string; proposalId: string }>;
};

export async function POST(request: Request, context: ApplyRouteContext) {
  const responseHeaders = new Headers();
  const client = await createServerSupabaseClient({ responseHeaders });
  const service = createProjectOperationsRuntime(client);
  const { projectId, proposalId } = await context.params;

  return handleApplyProposalPost({
    request,
    projectId,
    proposalId,
    responseHeaders,
    execute: (authorizedProjectId, authorizedProposalId, input) =>
      service.applyProposal(
        authorizedProjectId,
        authorizedProposalId,
        input,
      ),
  });
}

import "server-only";

import { OperationError } from "@/features/operations/errors";
import type { OperationHistoryQuery } from "@/features/operations/request-schemas";
import type { AuthorizedProjectScope } from "@/lib/auth/guards";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

const operationHistorySelector = `
  id,
  operation_type,
  state,
  proposal_id,
  reverses_operation_id,
  initiated_by,
  error_code,
  reversible,
  workflow_generation,
  created_at,
  completed_at,
  initiator:profiles!operation_logs_initiated_by_fkey(id,display_name),
  items:operation_items(
    id,
    proposal_action_id,
    item_id,
    ordinal,
    state,
    before_state,
    after_state,
    reversible,
    error_code,
    created_at,
    action:proposal_actions(id,ordinal,action_type,rationale)
  )
` as const;

async function currentProjectGeneration(
  client: ServerSupabaseClient,
  scope: AuthorizedProjectScope,
) {
  const { data, error } = await client
    .from("projects")
    .select("workflow_generation")
    .eq("workspace_id", scope.workspaceId)
    .eq("id", scope.projectId)
    .single();

  if (error || !data) throw new OperationError("persistence");
  return data.workflow_generation;
}

export async function listOperationHistory(
  client: ServerSupabaseClient,
  scope: AuthorizedProjectScope,
  query: OperationHistoryQuery,
) {
  const generation = query.includeArchived
    ? null
    : await currentProjectGeneration(client, scope);
  let request = client
    .from("operation_logs")
    .select(operationHistorySelector)
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId);

  if (generation !== null) {
    request = request.eq("workflow_generation", generation);
  }

  const { data, error } = await request
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .order("ordinal", {
      ascending: true,
      referencedTable: "items",
    })
    .limit(query.limit);

  if (error) throw new OperationError("persistence");
  return data ?? [];
}

import "server-only";

import type { AuthorizedProjectScope } from "@/lib/auth/guards";
import { AuthorizationError } from "@/lib/auth/errors";
import { getDemoProjectSlug } from "@/lib/env/server";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

export const projectSelector =
  "id,workspace_id,name,slug,description,status,is_demo,created_at,updated_at,workspace:workspaces!projects_workspace_id_fkey(id,name,slug)" as const;

export const projectItemSelector =
  "id,workspace_id,project_id,item_key,item_type,title,description,status,priority,owner_id,start_date,due_date,event_date,version,updated_at,owner:profiles!project_items_owner_id_fkey(id,display_name,avatar_url)" as const;

const prerequisiteSelector =
  "id,from_item_id,to_item_id,relationship,rationale,created_at,upstream:project_items!item_dependencies_to_fk(id,item_key,item_type,title,status,priority,due_date,event_date,version)" as const;

const dependentSelector =
  "id,from_item_id,to_item_id,relationship,rationale,created_at,dependent:project_items!item_dependencies_from_fk(id,item_key,item_type,title,status,priority,due_date,event_date,version)" as const;

const sourceUpdateSelector =
  "id,title,source_kind,source_url,occurred_at,captured_by,content_sha256,created_at,capturer:profiles!source_documents_captured_by_fkey(id,display_name)" as const;

const impactRunSelector =
  "id,change_event_id,state,max_depth,started_by,started_at,completed_at,starter:profiles!impact_runs_started_by_fkey(id,display_name)" as const;

const proposalSelector =
  "id,change_event_id,impact_run_id,state,title,rationale,model_name,created_by,created_at,updated_at,creator:profiles!action_proposals_created_by_fkey(id,display_name)" as const;

const proposalActionSelector =
  "id,proposal_id,ordinal,action_type,state,target_item_id,expected_item_version,rationale,reviewed_by,reviewed_at,created_at,updated_at" as const;

const operationSelector =
  "id,operation_type,state,proposal_id,reverses_operation_id,initiated_by,created_at,completed_at,initiator:profiles!operation_logs_initiated_by_fkey(id,display_name)" as const;

export class RepositoryError extends Error {
  constructor(message = "Project data could not be loaded.") {
    super(message);
    this.name = "RepositoryError";
  }
}

function clampInteger(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

function pagination(limit: number, offset: number, maximum: number) {
  const boundedLimit = clampInteger(limit, 1, maximum);
  const boundedOffset = clampInteger(offset, 0, 10_000);
  return {
    limit: boundedLimit,
    offset: boundedOffset,
    end: boundedOffset + boundedLimit - 1,
  };
}

async function getCurrentWorkflowGeneration(
  client: ServerSupabaseClient,
  scope: AuthorizedProjectScope,
) {
  const { data, error } = await client
    .from("projects")
    .select("workflow_generation")
    .eq("workspace_id", scope.workspaceId)
    .eq("id", scope.projectId)
    .single();

  if (error || !data) throw new RepositoryError();
  return data.workflow_generation;
}

export async function getDemoWorkspaceProject(
  client: ServerSupabaseClient,
  slug = getDemoProjectSlug(),
) {
  const { data, error } = await client
    .from("projects")
    .select(projectSelector)
    .eq("slug", slug)
    .eq("is_demo", true)
    .order("workspace_id")
    .order("id")
    .limit(2);

  if (error) {
    throw new RepositoryError();
  }

  if (!data || data.length === 0) {
    throw new AuthorizationError("not_found");
  }

  if (data.length > 1) {
    throw new RepositoryError("Demo project configuration is ambiguous.");
  }

  return data[0];
}

export async function getProjectOverview(
  client: ServerSupabaseClient,
  scope: AuthorizedProjectScope,
) {
  const generation = await getCurrentWorkflowGeneration(client, scope);
  const projectRequest = client
    .from("projects")
    .select(projectSelector)
    .eq("workspace_id", scope.workspaceId)
    .eq("id", scope.projectId)
    .maybeSingle();

  const itemCountRequest = client
    .from("project_items")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("is_demo_retired", false);

  const sourceCountRequest = client
    .from("source_documents")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("workflow_generation", generation);

  const proposalCountRequest = client
    .from("action_proposals")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("workflow_generation", generation);

  const operationCountRequest = client
    .from("operation_logs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("workflow_generation", generation);

  const [project, items, sources, proposals, operations] = await Promise.all([
    projectRequest,
    itemCountRequest,
    sourceCountRequest,
    proposalCountRequest,
    operationCountRequest,
  ]);

  if (
    project.error ||
    items.error ||
    sources.error ||
    proposals.error ||
    operations.error
  ) {
    throw new RepositoryError();
  }

  if (!project.data) {
    throw new AuthorizationError("not_found");
  }

  return {
    project: project.data,
    counts: {
      items: items.count ?? 0,
      sources: sources.count ?? 0,
      proposals: proposals.count ?? 0,
      operations: operations.count ?? 0,
    },
  };
}

export async function listProjectItems(
  client: ServerSupabaseClient,
  scope: AuthorizedProjectScope,
  options: { limit?: number; offset?: number } = {},
) {
  const page = pagination(options.limit ?? 100, options.offset ?? 0, 100);
  const { data, error, count } = await client
    .from("project_items")
    .select(projectItemSelector, { count: "exact" })
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("is_demo_retired", false)
    .order("item_key")
    .order("id")
    .range(page.offset, page.end);

  if (error) {
    throw new RepositoryError();
  }

  return { data: data ?? [], total: count ?? 0, limit: page.limit };
}

export async function getItemAndDependencies(
  client: ServerSupabaseClient,
  scope: AuthorizedProjectScope,
  itemId: string,
) {
  const itemRequest = client
    .from("project_items")
    .select(projectItemSelector)
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("id", itemId)
    .eq("is_demo_retired", false)
    .maybeSingle();

  const prerequisiteRequest = client
    .from("item_dependencies")
    .select(prerequisiteSelector)
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("from_item_id", itemId)
    .order("created_at")
    .order("id")
    .limit(100);

  const dependentRequest = client
    .from("item_dependencies")
    .select(dependentSelector)
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("to_item_id", itemId)
    .order("created_at")
    .order("id")
    .limit(100);

  const [item, prerequisites, dependents] = await Promise.all([
    itemRequest,
    prerequisiteRequest,
    dependentRequest,
  ]);

  if (item.error || prerequisites.error || dependents.error) {
    throw new RepositoryError();
  }

  if (!item.data) {
    throw new AuthorizationError("not_found");
  }

  return {
    item: item.data,
    prerequisites: prerequisites.data ?? [],
    dependents: dependents.data ?? [],
  };
}

export async function listSourceUpdates(
  client: ServerSupabaseClient,
  scope: AuthorizedProjectScope,
  requestedLimit = 25,
) {
  const limit = clampInteger(requestedLimit, 1, 25);
  const generation = await getCurrentWorkflowGeneration(client, scope);
  const { data, error } = await client
    .from("source_documents")
    .select(sourceUpdateSelector)
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("workflow_generation", generation)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (error) {
    throw new RepositoryError();
  }

  return { data: data ?? [], limit };
}

export async function listImpactRunsAndProposals(
  client: ServerSupabaseClient,
  scope: AuthorizedProjectScope,
  requestedLimit = 25,
) {
  const limit = clampInteger(requestedLimit, 1, 25);
  const generation = await getCurrentWorkflowGeneration(client, scope);
  const impactRequest = client
    .from("impact_runs")
    .select(impactRunSelector)
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("workflow_generation", generation)
    .order("started_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  const proposalRequest = client
    .from("action_proposals")
    .select(proposalSelector)
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("workflow_generation", generation)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  const [impacts, proposals] = await Promise.all([
    impactRequest,
    proposalRequest,
  ]);

  if (impacts.error || proposals.error) {
    throw new RepositoryError();
  }

  const proposalIds = (proposals.data ?? []).map((proposal) => proposal.id);

  if (proposalIds.length > 0) {
    const actionResult = await client
      .from("proposal_actions")
      .select(proposalActionSelector)
      .eq("workspace_id", scope.workspaceId)
      .eq("project_id", scope.projectId)
      .eq("workflow_generation", generation)
      .in("proposal_id", proposalIds)
      .order("proposal_id")
      .order("ordinal")
      .limit(100);

    if (actionResult.error) {
      throw new RepositoryError();
    }
    return {
      impacts: impacts.data ?? [],
      proposals: proposals.data ?? [],
      actions: actionResult.data ?? [],
      limit,
    };
  }

  return {
    impacts: impacts.data ?? [],
    proposals: proposals.data ?? [],
    actions: [],
    limit,
  };
}

export async function listOperations(
  client: ServerSupabaseClient,
  scope: AuthorizedProjectScope,
  requestedLimit = 50,
) {
  const limit = clampInteger(requestedLimit, 1, 50);
  const generation = await getCurrentWorkflowGeneration(client, scope);
  const { data, error } = await client
    .from("operation_logs")
    .select(operationSelector)
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("workflow_generation", generation)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (error) {
    throw new RepositoryError();
  }

  return { data: data ?? [], limit };
}

import "server-only";

import type {
  AnalysisReview,
  ImpactReviewItem,
  ImpactWorkflowData,
  OperationAuditItem,
  OperationSummary,
  RecoveryAction,
  ReviewItem,
  SourceEvidence,
} from "@/app/app/impact-workflow-types";
import { listOperationHistory } from "@/features/operations/history";
import type { AuthorizedProjectScope } from "@/lib/auth/guards";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ProjectItemRow = Database["public"]["Tables"]["project_items"]["Row"];
type ReviewItemRow = Pick<
  ProjectItemRow,
  | "id"
  | "item_key"
  | "item_type"
  | "title"
  | "description"
  | "status"
  | "priority"
  | "owner_id"
  | "start_date"
  | "due_date"
  | "event_date"
  | "version"
> & {
  owner: { id: string; display_name: string } | null;
};

const reviewItemSelector =
  "id,item_key,item_type,title,description,status,priority,owner_id,start_date,due_date,event_date,version,owner:profiles!project_items_owner_id_fkey(id,display_name)" as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function jsonValueLabel(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (isRecord(value)) {
    const fieldName = stringValue(value.field_name);
    if (fieldName && "value" in value) {
      return `${humanize(fieldName)}: ${jsonValueLabel(value.value)}`;
    }
    const itemKey = stringValue(value.item_key);
    const title = stringValue(value.title);
    if (itemKey || title) return [itemKey, title].filter(Boolean).join(" — ");
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "Recorded value";
  }
}

function toReviewItem(row: ReviewItemRow): ReviewItem {
  const owner = isRecord(row.owner) ? row.owner : null;
  return {
    id: row.id,
    itemKey: row.item_key,
    title: row.title,
    itemType: row.item_type,
    status: row.status,
    ownerName: owner ? stringValue(owner.display_name) : null,
    dueDate: row.due_date,
    eventDate: row.event_date,
    version: row.version,
  };
}

function unavailableItem(itemId: string): ReviewItem {
  return {
    id: itemId,
    itemKey: "Unavailable",
    title: "Item details unavailable",
    itemType: "artifact",
    status: "blocked",
    ownerName: null,
    dueDate: null,
    eventDate: null,
    version: 0,
  };
}

function itemFieldValue(item: ReviewItemRow | undefined, field: string | null) {
  if (!item || !field) return "Current value unavailable";
  const allowed: Record<string, keyof ReviewItemRow> = {
    title: "title",
    description: "description",
    status: "status",
    priority: "priority",
    owner_id: "owner_id",
    start_date: "start_date",
    due_date: "due_date",
    event_date: "event_date",
  };
  const key = allowed[field];
  return key ? jsonValueLabel(item[key]) : "Current value unavailable";
}

function actionView(
  row: Database["public"]["Tables"]["proposal_actions"]["Row"],
  itemRows: ReadonlyMap<string, ReviewItemRow>,
  itemViews: ReadonlyMap<string, ReviewItem>,
): RecoveryAction {
  const payload = isRecord(row.payload) ? row.payload : {};
  const promptType = stringValue(payload.prompt_action_type);
  const fieldName = stringValue(payload.field_name);
  const linkedImpactItemId = stringValue(payload.linked_impact_item_id);
  const linkedItem = linkedImpactItemId
    ? itemViews.get(linkedImpactItemId)
    : undefined;
  const target = row.target_item_id
    ? itemViews.get(row.target_item_id)
    : undefined;
  const confidence = numberValue(payload.confidence);
  const explicitHumanInput =
    typeof payload.requires_human_input === "boolean"
      ? payload.requires_human_input
      : null;
  const requiresHumanInput =
    explicitHumanInput !== false ||
    promptType === "request_confirmation";

  if (promptType === "update_item_field") {
    return {
      id: row.id,
      ordinal: row.ordinal,
      state: row.state,
      actionType: row.action_type,
      title: `Update ${target?.itemKey ?? "item"} ${humanize(fieldName ?? "field")}`,
      currentValue: itemFieldValue(
        row.target_item_id ? itemRows.get(row.target_item_id) : undefined,
        fieldName,
      ),
      proposedValue: jsonValueLabel(payload.proposed_value),
      reason: row.rationale,
      linkedImpactItemId,
      linkedImpactLabel: linkedItem
        ? `${linkedItem.itemKey} — ${linkedItem.title}`
        : "Linked impact unavailable",
      confidence,
      requiresHumanInput,
      humanInputPrompt: requiresHumanInput
        ? `Confirm the proposed ${humanize(fieldName ?? "field")} value and add any reviewer context.`
        : null,
    };
  }

  if (promptType === "create_task" || promptType === "create_risk") {
    const itemType = promptType === "create_task" ? "Task" : "Risk";
    const title = stringValue(payload.title) ?? `Untitled ${itemType.toLowerCase()}`;
    return {
      id: row.id,
      ordinal: row.ordinal,
      state: row.state,
      actionType: row.action_type,
      title: `Create ${itemType.toLowerCase()}: ${title}`,
      currentValue: "No existing item",
      proposedValue: `${itemType} — ${title}`,
      reason: row.rationale,
      linkedImpactItemId,
      linkedImpactLabel: linkedItem
        ? `${linkedItem.itemKey} — ${linkedItem.title}`
        : "Linked impact unavailable",
      confidence,
      requiresHumanInput,
      humanInputPrompt: requiresHumanInput
        ? `Confirm that this ${itemType.toLowerCase()} should be created and add any constraints.`
        : null,
    };
  }

  const question = stringValue(payload.question) ?? "Reviewer confirmation required";
  return {
    id: row.id,
    ordinal: row.ordinal,
    state: row.state,
    actionType: row.action_type,
    title: "Request human confirmation",
    currentValue: "Unresolved",
    proposedValue: question,
    reason: row.rationale,
    linkedImpactItemId,
    linkedImpactLabel: linkedItem
      ? `${linkedItem.itemKey} — ${linkedItem.title}`
      : "Linked impact unavailable",
    confidence,
    requiresHumanInput: true,
    humanInputPrompt: question,
  };
}

async function currentGeneration(
  client: ServerSupabaseClient,
  scope: AuthorizedProjectScope,
) {
  const { data, error } = await client
    .from("projects")
    .select("workflow_generation")
    .eq("workspace_id", scope.workspaceId)
    .eq("id", scope.projectId)
    .single();
  if (error || !data) throw new Error("analysis_review_load_failed");
  return data.workflow_generation;
}

async function loadAnalysisReview(
  client: ServerSupabaseClient,
  scope: AuthorizedProjectScope,
  analysisRequestId?: string,
): Promise<AnalysisReview | null> {
  const generation = await currentGeneration(client, scope);
  const requestQuery = client
    .from("analysis_requests")
    .select(
      "id,state,model_name,source_document_id,change_event_id,impact_run_id,proposal_id,failure_code,failure_stage,created_at,finished_at",
    )
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("workflow_generation", generation);
  const scopedRequestQuery = analysisRequestId
    ? requestQuery.eq("id", analysisRequestId)
    : requestQuery;
  const { data: requests, error: requestError } = await scopedRequestQuery
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);

  if (requestError) throw new Error("analysis_review_load_failed");
  const request = requests?.[0];
  if (!request) return null;

  const { data: sourceRow, error: sourceError } = await client
    .from("source_documents")
    .select(
      "id,title,source_kind,source_author,occurred_at,raw_text,created_at,captured_by,capturer:profiles!source_documents_captured_by_fkey(id,display_name)",
    )
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("id", request.source_document_id)
    .maybeSingle();

  if (sourceError) throw new Error("analysis_review_load_failed");
  const capturer = sourceRow && isRecord(sourceRow.capturer)
    ? sourceRow.capturer
    : null;
  const source: SourceEvidence | null = sourceRow
    ? {
        id: sourceRow.id,
        title: sourceRow.title,
        sourceKind: sourceRow.source_kind,
        sourceAuthor: sourceRow.source_author,
        occurredAt: sourceRow.occurred_at,
        rawText: sourceRow.raw_text,
        createdAt: sourceRow.created_at,
        capturedBy: capturer ? stringValue(capturer.display_name) : null,
      }
    : null;

  const base: AnalysisReview = {
    requestId: request.id,
    state: request.state,
    modelName: request.model_name,
    createdAt: request.created_at,
    finishedAt: request.finished_at,
    failureCode: request.failure_code,
    failureStage: request.failure_stage,
    source,
    change: null,
    impacts: [],
    impactState: null,
    impactError: null,
    proposal: null,
    loadWarning: null,
  };

  if (
    request.state !== "succeeded" ||
    !request.change_event_id ||
    !request.impact_run_id ||
    !request.proposal_id
  ) {
    return base;
  }

  const [changeResult, impactRunResult, impactItemsResult, proposalResult, actionsResult] =
    await Promise.all([
      client
        .from("change_events")
        .select(
          "id,state,subject_item_id,field_name,previous_value,proposed_value,evidence_text,confidence,model_name,review_context",
        )
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .eq("id", request.change_event_id)
        .maybeSingle(),
      client
        .from("impact_runs")
        .select("id,state,error_message")
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .eq("id", request.impact_run_id)
        .maybeSingle(),
      client
        .from("impact_items")
        .select(
          "id,item_id,depth,path_item_ids,severity,explanation,created_at",
        )
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .eq("impact_run_id", request.impact_run_id)
        .order("depth")
        .order("item_id"),
      client
        .from("action_proposals")
        .select("id,state,title,rationale,model_name,created_at")
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .eq("id", request.proposal_id)
        .maybeSingle(),
      client
        .from("proposal_actions")
        .select(
          "id,proposal_id,ordinal,action_type,state,target_item_id,expected_item_version,payload,rationale,reviewed_by,reviewed_at,created_at,updated_at,workspace_id,project_id,workflow_generation",
        )
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .eq("proposal_id", request.proposal_id)
        .order("ordinal"),
    ]);

  if (
    changeResult.error ||
    impactRunResult.error ||
    impactItemsResult.error ||
    proposalResult.error ||
    actionsResult.error
  ) {
    throw new Error("analysis_review_load_failed");
  }

  const changeRow = changeResult.data;
  const impactRows = impactItemsResult.data ?? [];
  const proposalRow = proposalResult.data;
  const actionRows = actionsResult.data ?? [];
  const itemIds = new Set<string>();
  if (changeRow) itemIds.add(changeRow.subject_item_id);
  for (const impact of impactRows) {
    itemIds.add(impact.item_id);
    for (const itemId of impact.path_item_ids) itemIds.add(itemId);
  }
  for (const action of actionRows) {
    if (action.target_item_id) itemIds.add(action.target_item_id);
    const payload = isRecord(action.payload) ? action.payload : null;
    const linkedId = payload ? stringValue(payload.linked_impact_item_id) : null;
    if (linkedId) itemIds.add(linkedId);
  }

  let itemRows: ReviewItemRow[] = [];
  if (itemIds.size > 0) {
    const itemResult = await client
      .from("project_items")
      .select(reviewItemSelector)
      .eq("workspace_id", scope.workspaceId)
      .eq("project_id", scope.projectId)
      .in("id", [...itemIds]);
    if (itemResult.error) throw new Error("analysis_review_load_failed");
    itemRows = itemResult.data ?? [];
  }

  const rawItemsById = new Map(itemRows.map((item) => [item.id, item]));
  const itemsById = new Map(
    itemRows.map((item) => [item.id, toReviewItem(item)]),
  );
  const reviewContext = changeRow && isRecord(changeRow.review_context)
    ? changeRow.review_context
    : {};
  const impacts: ImpactReviewItem[] = impactRows.map((impact) => ({
    id: impact.id,
    depth: impact.depth,
    item: itemsById.get(impact.item_id) ?? unavailableItem(impact.item_id),
    path: impact.path_item_ids.map(
      (itemId) => itemsById.get(itemId) ?? unavailableItem(itemId),
    ),
    severity: impact.severity,
    explanation: impact.explanation,
  }));

  return {
    ...base,
    change: changeRow
      ? {
          id: changeRow.id,
          state: changeRow.state,
          item:
            itemsById.get(changeRow.subject_item_id) ??
            unavailableItem(changeRow.subject_item_id),
          fieldName: changeRow.field_name,
          previousValue: changeRow.previous_value,
          proposedValue: changeRow.proposed_value,
          evidenceText: changeRow.evidence_text,
          confidence: changeRow.confidence,
          modelName: changeRow.model_name,
          reviewReasons: strings(reviewContext.review_reasons),
          ambiguities: strings(reviewContext.ambiguities),
          unresolvedReferences: strings(reviewContext.unresolved_references),
          warnings: strings(reviewContext.warnings),
        }
      : null,
    impacts,
    impactState: impactRunResult.data?.state ?? null,
    impactError: impactRunResult.data?.error_message ?? null,
    proposal: proposalRow
      ? {
          id: proposalRow.id,
          state: proposalRow.state,
          title: proposalRow.title,
          rationale: proposalRow.rationale,
          modelName: proposalRow.model_name,
          createdAt: proposalRow.created_at,
          actions: actionRows.map((action) =>
            actionView(action, rawItemsById, itemsById),
          ),
        }
      : null,
    loadWarning:
      !changeRow || !impactRunResult.data || !proposalRow
        ? "The completed analysis references review records that are not currently available."
        : null,
  };
}

function operationItemView(
  row: Record<string, unknown>,
  itemLabels: ReadonlyMap<string, string>,
): OperationAuditItem {
  const itemId = stringValue(row.item_id);
  const action = isRecord(row.action) ? row.action : null;
  return {
    id: stringValue(row.id) ?? "unavailable-operation-item",
    ordinal: numberValue(row.ordinal) ?? 0,
    state:
      row.state === "succeeded" ||
      row.state === "failed" ||
      row.state === "skipped"
        ? row.state
        : "failed",
    itemId,
    itemLabel:
      (itemId ? itemLabels.get(itemId) : null) ??
      jsonValueLabel(row.after_state) ??
      "Recorded project change",
    actionType: action ? stringValue(action.action_type) : null,
    reason: action ? stringValue(action.rationale) : null,
    beforeValue: jsonValueLabel(row.before_state),
    afterValue: jsonValueLabel(row.after_state),
    reversible: booleanValue(row.reversible),
    errorCode: stringValue(row.error_code),
  };
}

async function loadOperations(
  client: ServerSupabaseClient,
  scope: AuthorizedProjectScope,
): Promise<OperationSummary[]> {
  const rows = await listOperationHistory(client, scope, {
    limit: 25,
    includeArchived: false,
  });
  const itemIds = new Set<string>();
  for (const operation of rows) {
    for (const item of operation.items ?? []) {
      if (item.item_id) itemIds.add(item.item_id);
    }
  }
  const labels = new Map<string, string>();
  if (itemIds.size > 0) {
    const { data, error } = await client
      .from("project_items")
      .select("id,item_key,title")
      .eq("workspace_id", scope.workspaceId)
      .eq("project_id", scope.projectId)
      .in("id", [...itemIds]);
    if (error) throw new Error("operation_history_load_failed");
    for (const item of data ?? []) {
      labels.set(item.id, `${item.item_key} — ${item.title}`);
    }
  }
  const reversedIds = new Set(
    rows.flatMap((operation) =>
      operation.operation_type === "undo" &&
      operation.state === "succeeded" &&
      operation.reverses_operation_id
        ? [operation.reverses_operation_id]
        : [],
    ),
  );

  return rows.map((operation) => {
    const initiator = isRecord(operation.initiator)
      ? operation.initiator
      : null;
    return {
      id: operation.id,
      operationType: operation.operation_type,
      state: operation.state,
      proposalId: operation.proposal_id,
      reversesOperationId: operation.reverses_operation_id,
      initiatorName: initiator ? stringValue(initiator.display_name) : null,
      createdAt: operation.created_at,
      completedAt: operation.completed_at,
      reversible: operation.reversible,
      undoEligible:
        operation.operation_type === "apply_proposal" &&
        operation.state === "succeeded" &&
        operation.reversible &&
        !reversedIds.has(operation.id),
      errorCode: operation.error_code,
      items: (operation.items ?? []).map((item) =>
        operationItemView(item as unknown as Record<string, unknown>, labels),
      ),
    };
  });
}

export async function getImpactWorkflowData(
  client: ServerSupabaseClient,
  scope: AuthorizedProjectScope,
  options: { analysisRequestId?: string } = {},
): Promise<ImpactWorkflowData> {
  const [analysisResult, operationsResult] = await Promise.allSettled([
    loadAnalysisReview(client, scope, options.analysisRequestId),
    loadOperations(client, scope),
  ]);
  return {
    analysis:
      analysisResult.status === "fulfilled" ? analysisResult.value : null,
    analysisLoadFailed: analysisResult.status === "rejected",
    operations:
      operationsResult.status === "fulfilled" ? operationsResult.value : [],
    operationsLoadFailed: operationsResult.status === "rejected",
  };
}

import type { Json } from "@/types/database";

export type ItemStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "at_risk"
  | "completed"
  | "cancelled";

export type ItemType =
  | "task"
  | "milestone"
  | "decision"
  | "event"
  | "risk"
  | "artifact";

export type ReviewItem = {
  id: string;
  itemKey: string;
  title: string;
  itemType: ItemType;
  status: ItemStatus;
  ownerName: string | null;
  dueDate: string | null;
  eventDate: string | null;
  version: number;
};

export type SourceEvidence = {
  id: string;
  title: string;
  sourceKind: string;
  sourceAuthor: string | null;
  occurredAt: string | null;
  rawText: string;
  createdAt: string;
  capturedBy: string | null;
};

export type ChangeReview = {
  id: string;
  state: "needs_confirmation" | "confirmed" | "rejected" | "superseded";
  item: ReviewItem;
  fieldName: string;
  previousValue: Json | null;
  proposedValue: Json;
  evidenceText: string | null;
  confidence: number | null;
  modelName: string | null;
  reviewReasons: string[];
  ambiguities: string[];
  unresolvedReferences: string[];
  warnings: string[];
};

export type ImpactReviewItem = {
  id: string;
  depth: number;
  item: ReviewItem;
  path: ReviewItem[];
  severity: "low" | "medium" | "high" | "critical";
  explanation: string;
};

export type RecoveryAction = {
  id: string;
  ordinal: number;
  state: "pending" | "approved" | "rejected" | "applied" | "stale";
  actionType:
    | "update_item"
    | "create_item"
    | "add_dependency"
    | "remove_dependency"
    | "request_confirmation";
  title: string;
  currentValue: string;
  proposedValue: string;
  reason: string;
  linkedImpactItemId: string | null;
  linkedImpactLabel: string;
  confidence: number | null;
  requiresHumanInput: boolean;
  humanInputPrompt: string | null;
};

export type RecoveryProposal = {
  id: string;
  state:
    | "draft"
    | "ready"
    | "partially_approved"
    | "approved"
    | "applied"
    | "rejected"
    | "superseded";
  title: string;
  rationale: string;
  modelName: string | null;
  createdAt: string;
  actions: RecoveryAction[];
};

export type AnalysisReview = {
  requestId: string;
  state: "processing" | "succeeded" | "failed";
  modelName: string;
  createdAt: string;
  finishedAt: string | null;
  failureCode: string | null;
  failureStage: string | null;
  source: SourceEvidence | null;
  change: ChangeReview | null;
  impacts: ImpactReviewItem[];
  impactState: "pending" | "completed" | "failed" | null;
  impactError: string | null;
  proposal: RecoveryProposal | null;
  loadWarning: string | null;
};

export type OperationAuditItem = {
  id: string;
  ordinal: number;
  state: "succeeded" | "failed" | "skipped";
  itemId: string | null;
  itemLabel: string;
  actionType: string | null;
  reason: string | null;
  beforeValue: string;
  afterValue: string;
  reversible: boolean;
  errorCode: string | null;
};

export type OperationSummary = {
  id: string;
  operationType: "apply_proposal" | "undo" | "demo_reset";
  state: "succeeded" | "failed";
  proposalId: string | null;
  reversesOperationId: string | null;
  initiatorName: string | null;
  createdAt: string;
  completedAt: string;
  reversible: boolean;
  undoEligible: boolean;
  errorCode: string | null;
  items: OperationAuditItem[];
};

export type ImpactWorkflowData = {
  analysis: AnalysisReview | null;
  analysisLoadFailed: boolean;
  operations: OperationSummary[];
  operationsLoadFailed: boolean;
};

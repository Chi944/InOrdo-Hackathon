import "server-only";

import { z } from "zod";

import type {
  AnalysisContextItem,
  ProjectAnalysisContext,
} from "@/features/analysis/context";
import { AnalysisError } from "@/features/analysis/errors";
import type {
  ChangeExtraction,
  RecoveryProposal,
  RecoveryProposalAction,
} from "@/features/analysis/model-schemas";
import type { ImpactTraversalOutput } from "@/features/impact/types";

const confidenceConfirmationThreshold = 0.8;
const projectItemStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "blocked",
  "at_risk",
  "completed",
  "cancelled",
]);
const itemPrioritySchema = z.enum(["low", "medium", "high", "critical"]);
const nullableUuidSchema = z.uuid().nullable();
const nullableDateSchema = z.iso.date().nullable();
const titleSchema = z.string().trim().min(1).max(240);
const descriptionSchema = z.string().max(10_000).nullable();

export type ModelScalar = string | number | boolean | null;
export type ChangeReviewReason =
  | "human_approval_required"
  | "low_confidence"
  | "previous_value_mismatch"
  | "model_uncertainty";

export type ValidatedChange = {
  targetItemId: string;
  field: NonNullable<ChangeExtraction["change"]>["field"];
  previousValue: ModelScalar;
  proposedValue: ModelScalar;
  evidence: NonNullable<ChangeExtraction["change"]>["evidence"];
  confidence: number;
  expectedItemVersion: number;
  requiresConfirmation: true;
  reviewReasons: ChangeReviewReason[];
  ambiguities: string[];
  unresolvedReferences: string[];
  warnings: string[];
};

type ValidatedActionBase = {
  reason: string;
  linkedImpactItemId: string;
  confidence: number;
  requiresHumanInput: boolean;
};

export type ValidatedRecoveryAction =
  | (ValidatedActionBase & {
      type: "update_item_field";
      targetItemId: string;
      expectedItemVersion: number;
      field: ValidatedChange["field"];
      proposedValue: ModelScalar;
    })
  | (ValidatedActionBase & {
      type: "create_task";
      data: Extract<RecoveryProposalAction, { type: "create_task" }>["data"];
    })
  | (ValidatedActionBase & {
      type: "create_risk";
      data: Extract<RecoveryProposalAction, { type: "create_risk" }>["data"];
    })
  | (ValidatedActionBase & {
      type: "request_confirmation";
      targetItemId: string;
      question: string;
    });

export type ValidatedRecoveryProposal = {
  title: string;
  rationale: string;
  impacts: Array<{
    itemId: string;
    depth: number;
    path: string[];
    severity: "low" | "medium" | "high" | "critical";
    explanation: string;
  }>;
  actions: ValidatedRecoveryAction[];
};

function invalidModelOutput(cause?: unknown): AnalysisError {
  return new AnalysisError("model_invalid", undefined, cause);
}

function itemFieldValue(
  item: AnalysisContextItem,
  field: ValidatedChange["field"],
): ModelScalar {
  const values: Record<ValidatedChange["field"], ModelScalar> = {
    title: item.title,
    description: item.description,
    status: item.status,
    priority: item.priority,
    owner_id: item.ownerId,
    start_date: item.startDate,
    due_date: item.dueDate,
    event_date: item.eventDate,
  };
  return values[field];
}

function modelScalarsEqual(left: ModelScalar, right: ModelScalar) {
  return Object.is(left, right);
}

function parseFieldValue(
  item: AnalysisContextItem,
  field: ValidatedChange["field"],
  value: ModelScalar,
  allowedOwnerIds: ReadonlySet<string>,
): ModelScalar {
  let parsed: ModelScalar;

  switch (field) {
    case "title":
      parsed = titleSchema.parse(value);
      break;
    case "description":
      parsed = descriptionSchema.parse(value);
      break;
    case "status":
      parsed = projectItemStatusSchema.parse(value);
      break;
    case "priority":
      parsed = itemPrioritySchema.parse(value);
      break;
    case "owner_id": {
      const ownerId = nullableUuidSchema.parse(value);
      if (ownerId !== null && !allowedOwnerIds.has(ownerId)) {
        throw invalidModelOutput();
      }
      parsed = ownerId;
      break;
    }
    case "start_date":
    case "due_date":
      parsed = nullableDateSchema.parse(value);
      break;
    case "event_date":
      if (item.itemType !== "event") throw invalidModelOutput();
      parsed = nullableDateSchema.parse(value);
      break;
  }

  const resultingStartDate =
    field === "start_date" ? parsed : item.startDate;
  const resultingDueDate = field === "due_date" ? parsed : item.dueDate;
  if (
    typeof resultingStartDate === "string" &&
    typeof resultingDueDate === "string" &&
    resultingStartDate > resultingDueDate
  ) {
    throw invalidModelOutput();
  }

  return parsed;
}

function assertEvidence(
  sourceText: string,
  evidence: NonNullable<ChangeExtraction["change"]>["evidence"],
) {
  const { startOffset, endOffset, text } = evidence;
  if (startOffset === null && endOffset === null) {
    if (!sourceText.includes(text)) throw invalidModelOutput();
    return;
  }
  if (
    startOffset === null ||
    endOffset === null ||
    startOffset >= endOffset ||
    endOffset > sourceText.length ||
    sourceText.slice(startOffset, endOffset) !== text
  ) {
    throw invalidModelOutput();
  }
}

function ownerIds(context: ProjectAnalysisContext) {
  return new Set(
    context.items.flatMap(({ ownerId }) => (ownerId === null ? [] : [ownerId])),
  );
}

export function validateChangeExtraction(
  extraction: ChangeExtraction,
  sourceText: string,
  context: ProjectAnalysisContext,
): ValidatedChange {
  const change = extraction.change;
  if (!change) throw invalidModelOutput();

  const item = context.items.find(({ id }) => id === change.targetItemId);
  if (!item) throw invalidModelOutput();

  try {
    assertEvidence(sourceText, change.evidence);
    const canonicalPreviousValue = itemFieldValue(item, change.field);
    const proposedValue = parseFieldValue(
      item,
      change.field,
      change.proposedValue,
      ownerIds(context),
    );
    if (modelScalarsEqual(canonicalPreviousValue, proposedValue)) {
      throw invalidModelOutput();
    }

    const reviewReasons: ChangeReviewReason[] = ["human_approval_required"];
    if (change.confidence < confidenceConfirmationThreshold) {
      reviewReasons.push("low_confidence");
    }
    if (!modelScalarsEqual(change.previousValue, canonicalPreviousValue)) {
      reviewReasons.push("previous_value_mismatch");
    }
    if (
      extraction.ambiguities.length > 0 ||
      extraction.unresolvedReferences.length > 0 ||
      extraction.warnings.length > 0
    ) {
      reviewReasons.push("model_uncertainty");
    }

    return {
      targetItemId: change.targetItemId,
      field: change.field,
      previousValue: canonicalPreviousValue,
      proposedValue,
      evidence: change.evidence,
      confidence: change.confidence,
      expectedItemVersion: item.version,
      requiresConfirmation: true,
      reviewReasons,
      ambiguities: extraction.ambiguities,
      unresolvedReferences: extraction.unresolvedReferences,
      warnings: extraction.warnings,
    };
  } catch (error) {
    if (error instanceof AnalysisError) throw error;
    throw invalidModelOutput(error);
  }
}

function validateLinkedItem(
  itemId: string,
  allowedItemIds: ReadonlySet<string>,
) {
  if (!allowedItemIds.has(itemId)) throw invalidModelOutput();
}

function validateNewItemDates(
  data: { start_date?: string | null; due_date: string | null },
) {
  if (
    data.start_date &&
    data.due_date &&
    data.start_date > data.due_date
  ) {
    throw invalidModelOutput();
  }
}

function validateAction(
  action: RecoveryProposalAction,
  context: ProjectAnalysisContext,
  allowedItemIds: ReadonlySet<string>,
): ValidatedRecoveryAction {
  validateLinkedItem(action.linkedImpactItemId, allowedItemIds);
  const requiresHumanInput =
    action.requiresHumanInput ||
    action.confidence < confidenceConfirmationThreshold;

  switch (action.type) {
    case "update_item_field": {
      validateLinkedItem(action.targetItemId, allowedItemIds);
      const item = context.items.find(({ id }) => id === action.targetItemId);
      if (!item) throw invalidModelOutput();
      const proposedValue = parseFieldValue(
        item,
        action.field,
        action.proposedValue,
        ownerIds(context),
      );
      if (modelScalarsEqual(itemFieldValue(item, action.field), proposedValue)) {
        throw invalidModelOutput();
      }
      return {
        ...action,
        proposedValue,
        expectedItemVersion: item.version,
        requiresHumanInput,
      };
    }
    case "create_task":
      if (
        action.data.owner_id !== null &&
        !ownerIds(context).has(action.data.owner_id)
      ) {
        throw invalidModelOutput();
      }
      validateNewItemDates(action.data);
      return { ...action, requiresHumanInput };
    case "create_risk":
      if (
        action.data.owner_id !== null &&
        !ownerIds(context).has(action.data.owner_id)
      ) {
        throw invalidModelOutput();
      }
      validateNewItemDates(action.data);
      return { ...action, requiresHumanInput };
    case "request_confirmation":
      validateLinkedItem(action.targetItemId, allowedItemIds);
      return { ...action, requiresHumanInput: true };
  }
}

export function validateRecoveryProposal(
  proposal: RecoveryProposal,
  change: ValidatedChange,
  traversal: ImpactTraversalOutput,
  context: ProjectAnalysisContext,
): ValidatedRecoveryProposal {
  const expectedImpactIds = traversal.impacts.map(({ itemId }) => itemId);
  const annotationIds = proposal.impactAnnotations.map(({ itemId }) => itemId);
  if (
    new Set(annotationIds).size !== annotationIds.length ||
    annotationIds.length !== expectedImpactIds.length ||
    [...annotationIds].sort().join("\n") !==
      [...expectedImpactIds].sort().join("\n")
  ) {
    throw invalidModelOutput();
  }

  const annotations = new Map(
    proposal.impactAnnotations.map((annotation) => [annotation.itemId, annotation]),
  );
  const impacts = traversal.impacts.map((impact) => {
    const annotation = annotations.get(impact.itemId);
    if (!annotation) throw invalidModelOutput();
    return { ...impact, ...annotation };
  });
  const allowedItemIds = new Set([
    change.targetItemId,
    ...expectedImpactIds,
  ]);

  try {
    return {
      title: proposal.title,
      rationale: proposal.rationale,
      impacts,
      actions: proposal.actions.map((action) =>
        validateAction(action, context, allowedItemIds),
      ),
    };
  } catch (error) {
    if (error instanceof AnalysisError) throw error;
    throw invalidModelOutput(error);
  }
}

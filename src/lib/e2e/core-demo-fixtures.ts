import "server-only";

import type {
  AnalysisReview,
  ImpactWorkflowData,
  OperationSummary,
  RecoveryAction,
  ReviewItem,
} from "@/app/app/impact-workflow-types";
import { coreDemoFixtureIds } from "@/lib/e2e/core-demo-contract";
import type { CoreDemoStage } from "@/lib/e2e/core-demo-stage";

const changedItem = {
  id: coreDemoFixtureIds.changedItem,
  itemKey: "EVT-01",
  title: "Regional Climate Action Summit 2026",
  itemType: "event",
  status: "not_started",
  ownerName: "Synthetic events team",
  dueDate: null,
  eventDate: "2026-09-12",
  version: 3,
} satisfies ReviewItem;

const directItem = {
  id: coreDemoFixtureIds.directItem,
  itemKey: "TSK-01",
  title: "Confirm keynote speakers",
  itemType: "task",
  status: "in_progress",
  ownerName: "Synthetic programme team",
  dueDate: "2026-07-31",
  eventDate: null,
  version: 5,
} satisfies ReviewItem;

const indirectItem = {
  id: coreDemoFixtureIds.indirectItem,
  itemKey: "MLS-01",
  title: "Programme lock",
  itemType: "milestone",
  status: "at_risk",
  ownerName: "Synthetic program team",
  dueDate: "2026-08-07",
  eventDate: null,
  version: 2,
} satisfies ReviewItem;

function proposalActions(stage: CoreDemoStage): RecoveryAction[] {
  return [
    {
      id: coreDemoFixtureIds.safeAction,
      ordinal: 1,
      state: stage === "applied" || stage === "undone" ? "applied" : "pending",
      actionType: "update_item",
      title: "Move speaker confirmation due date",
      currentValue: "31 Jul 2026",
      proposedValue: "14 Aug 2026",
      reason: "Preserve the confirmation window before programme lock.",
      linkedImpactItemId: coreDemoFixtureIds.directItem,
      linkedImpactLabel: "TSK-01 — Confirm keynote speakers",
      confidence: 0.91,
      requiresHumanInput: false,
      humanInputPrompt: null,
    },
    {
      id: coreDemoFixtureIds.humanAction,
      ordinal: 2,
      state: "pending",
      actionType: "request_confirmation",
      title: "Confirm keynote availability",
      currentValue: "No response recorded",
      proposedValue: "Record a human-confirmed availability decision",
      reason: "The source update does not establish speaker availability.",
      linkedImpactItemId: coreDemoFixtureIds.directItem,
      linkedImpactLabel: "TSK-01 — Confirm keynote speakers",
      confidence: 0.62,
      requiresHumanInput: true,
      humanInputPrompt: "Enter the confirmed keynote availability and source.",
    },
  ];
}

function analysisFixture(stage: CoreDemoStage): AnalysisReview {
  const wasApplied = stage === "applied" || stage === "undone";

  return {
    requestId: coreDemoFixtureIds.analysis,
    state: "succeeded",
    modelName: "gpt-5.6-luna",
    createdAt: "2026-07-19T02:00:00.000Z",
    finishedAt: "2026-07-19T02:00:04.000Z",
    failureCode: null,
    failureStage: null,
    source: {
      id: coreDemoFixtureIds.source,
      title: "Venue update — summit date",
      sourceKind: "pasted_update",
      sourceAuthor: "Synthetic venue team",
      occurredAt: "2026-07-20T09:00:00.000Z",
      rawText:
        "The campus convention hall is unavailable on 12 September 2026. The venue team has offered 26 September 2026 instead.",
      createdAt: "2026-07-19T02:00:00.000Z",
      capturedBy: "CI fixture reviewer",
    },
    change: {
      id: coreDemoFixtureIds.change,
      state: wasApplied ? "confirmed" : "needs_confirmation",
      item: changedItem,
      fieldName: "event_date",
      previousValue: "2026-09-12",
      proposedValue: "2026-09-26",
      evidenceText:
        "The venue team has offered 26 September 2026 instead.",
      confidence: 0.96,
      modelName: "gpt-5.6-luna",
      reviewReasons: ["human_approval_required"],
      ambiguities: [],
      unresolvedReferences: [],
      warnings: [],
    },
    impacts: [
      {
        id: coreDemoFixtureIds.impactDirect,
        depth: 1,
        item: directItem,
        path: [changedItem, directItem],
        severity: "high",
        explanation:
          "Speaker confirmation depends directly on the summit date and needs a revised due date.",
      },
      {
        id: coreDemoFixtureIds.impactIndirect,
        depth: 2,
        item: indirectItem,
        path: [changedItem, directItem, indirectItem],
        severity: "medium",
        explanation:
          "Programme lock is downstream of speaker confirmation through an explicit two-hop path.",
      },
    ],
    impactState: "completed",
    impactError: null,
    proposal: {
      id: coreDemoFixtureIds.proposal,
      state: wasApplied ? "partially_approved" : "ready",
      title: "Recover the summit schedule",
      rationale:
        "Move the safe internal deadline while leaving unresolved speaker availability for a person to confirm.",
      modelName: "gpt-5.6-luna",
      createdAt: "2026-07-19T02:00:04.000Z",
      actions: proposalActions(stage),
    },
    loadWarning: null,
  };
}

const applyOperation = {
  id: coreDemoFixtureIds.applyOperation,
  operationType: "apply_proposal",
  state: "succeeded",
  proposalId: coreDemoFixtureIds.proposal,
  reversesOperationId: null,
  initiatorName: "CI fixture reviewer",
  createdAt: "2026-07-19T02:01:00.000Z",
  completedAt: "2026-07-19T02:01:01.000Z",
  reversible: true,
  undoEligible: true,
  errorCode: null,
  items: [
    {
      id: coreDemoFixtureIds.applyOperationItem,
      ordinal: 1,
      state: "succeeded",
      itemId: coreDemoFixtureIds.directItem,
      itemLabel: "TSK-01 — Confirm keynote speakers",
      actionType: "update_item",
      reason: null,
      beforeValue: "Due 31 Jul 2026",
      afterValue: "Due 14 Aug 2026",
      reversible: true,
      errorCode: null,
    },
  ],
} satisfies OperationSummary;

const undoOperation = {
  id: coreDemoFixtureIds.undoOperation,
  operationType: "undo",
  state: "succeeded",
  proposalId: coreDemoFixtureIds.proposal,
  reversesOperationId: coreDemoFixtureIds.applyOperation,
  initiatorName: "CI fixture reviewer",
  createdAt: "2026-07-19T02:02:00.000Z",
  completedAt: "2026-07-19T02:02:01.000Z",
  reversible: false,
  undoEligible: false,
  errorCode: null,
  items: [
    {
      id: coreDemoFixtureIds.undoOperationItem,
      ordinal: 1,
      state: "succeeded",
      itemId: coreDemoFixtureIds.directItem,
      itemLabel: "TSK-01 — Confirm keynote speakers",
      actionType: "update_item",
      reason: null,
      beforeValue: "Due 14 Aug 2026",
      afterValue: "Due 31 Jul 2026",
      reversible: false,
      errorCode: null,
    },
  ],
} satisfies OperationSummary;

export function coreDemoWorkflowData(
  stage: CoreDemoStage,
): ImpactWorkflowData {
  if (stage === "baseline") {
    return {
      analysis: null,
      analysisLoadFailed: false,
      operations: [],
      operationsLoadFailed: false,
    };
  }

  const operations =
    stage === "undone"
      ? [undoOperation, { ...applyOperation, undoEligible: false }]
      : stage === "applied"
        ? [applyOperation]
        : [];

  return {
    analysis: analysisFixture(stage),
    analysisLoadFailed: false,
    operations,
    operationsLoadFailed: false,
  };
}

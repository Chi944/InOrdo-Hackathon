import { describe, expect, it } from "vitest";

import {
  validateChangeExtraction,
  validateRecoveryProposal,
} from "@/features/analysis/post-validation";
import type { ProjectAnalysisContext } from "@/features/analysis/context";
import type {
  ChangeExtraction,
  RecoveryProposal,
} from "@/features/analysis/model-schemas";
import { AnalysisError } from "@/features/analysis/errors";
import type { ImpactTraversalOutput } from "@/features/impact/types";

const changedItemId = "3e14b4a4-421d-4d6d-8a7e-01d5a22e3002";
const impactedItemId = "b993a2d1-8060-4c96-a7d0-e79f4cd43303";
const ownerId = "6519012e-13a6-4e3e-9ae5-d09bd3054401";
const unknownItemId = "7e10e7b0-63f4-4cbf-a3b1-cad8a1cd5010";
const sourceText = "Programme update: the briefing pack due date moved to 2026-08-17.";
const evidenceText = "briefing pack due date moved to 2026-08-17";
const evidenceStart = sourceText.indexOf(evidenceText);

const context: ProjectAnalysisContext = {
  revision: "a".repeat(64),
  items: [
    {
      id: changedItemId,
      itemKey: "PACK-01",
      itemType: "task",
      title: "Prepare briefing pack",
      description: null,
      status: "in_progress",
      priority: "high",
      ownerId,
      startDate: "2026-08-01",
      dueDate: "2026-08-10",
      eventDate: null,
      version: 4,
    },
    {
      id: impactedItemId,
      itemKey: "EVENT-01",
      itemType: "event",
      title: "Regional summit",
      description: "Annual event",
      status: "not_started",
      priority: "critical",
      ownerId: null,
      startDate: "2026-09-12",
      dueDate: "2026-09-12",
      eventDate: "2026-09-12",
      version: 2,
    },
  ],
  graph: {
    items: [
      { id: changedItemId, active: true },
      { id: impactedItemId, active: true },
    ],
    dependencies: [
      {
        fromItemId: impactedItemId,
        toItemId: changedItemId,
        relationship: "requires",
      },
    ],
  },
};

function extraction(
  overrides: Partial<NonNullable<ChangeExtraction["change"]>> = {},
): ChangeExtraction {
  return {
    change: {
      targetItemId: changedItemId,
      field: "due_date",
      previousValue: "2026-08-10",
      proposedValue: "2026-08-17",
      evidence: {
        text: evidenceText,
        startOffset: evidenceStart,
        endOffset: evidenceStart + evidenceText.length,
      },
      confidence: 0.96,
      ...overrides,
    },
    ambiguities: [],
    unresolvedReferences: [],
    warnings: [],
  };
}

const impacts: ImpactTraversalOutput = {
  changedItemId,
  impacts: [
    {
      itemId: impactedItemId,
      depth: 1,
      path: [changedItemId, impactedItemId],
    },
  ],
};

function proposal(overrides: Partial<RecoveryProposal> = {}): RecoveryProposal {
  return {
    title: "Recover the briefing schedule",
    rationale: "Keep the event preparation aligned with the revised pack date.",
    impactAnnotations: [
      {
        itemId: impactedItemId,
        severity: "high",
        explanation: "The event briefing depends on the completed pack.",
      },
    ],
    actions: [
      {
        type: "update_item_field",
        targetItemId: impactedItemId,
        field: "start_date",
        proposedValue: "2026-09-11",
        reason: "Move the dependent preparation window.",
        linkedImpactItemId: impactedItemId,
        confidence: 0.9,
        requiresHumanInput: false,
      },
    ],
    ...overrides,
  };
}

describe("validateChangeExtraction", () => {
  it("accepts canonical evidence and keeps the database value as previous value", () => {
    const result = validateChangeExtraction(extraction(), sourceText, context);

    expect(result).toMatchObject({
      targetItemId: changedItemId,
      field: "due_date",
      previousValue: "2026-08-10",
      proposedValue: "2026-08-17",
      expectedItemVersion: 4,
      requiresConfirmation: true,
      reviewReasons: ["human_approval_required"],
    });
  });

  it("rejects unknown target IDs and evidence that is not in the source", () => {
    expect(() =>
      validateChangeExtraction(
        extraction({ targetItemId: unknownItemId }),
        sourceText,
        context,
      ),
    ).toThrow(AnalysisError);
    expect(() =>
      validateChangeExtraction(
        extraction({
          evidence: {
            text: "fabricated evidence",
            startOffset: null,
            endOffset: null,
          },
        }),
        sourceText,
        context,
      ),
    ).toThrow(AnalysisError);
  });

  it("rejects invalid field values and a no-op proposed value", () => {
    expect(() =>
      validateChangeExtraction(
        extraction({ proposedValue: "tomorrow" }),
        sourceText,
        context,
      ),
    ).toThrow(AnalysisError);
    expect(() =>
      validateChangeExtraction(
        extraction({ proposedValue: "2026-08-10" }),
        sourceText,
        context,
      ),
    ).toThrow(AnalysisError);
  });

  it("uses the canonical previous value and raises review flags for mismatch or low confidence", () => {
    const result = validateChangeExtraction(
      extraction({ previousValue: "2026-08-09", confidence: 0.55 }),
      sourceText,
      context,
    );

    expect(result.previousValue).toBe("2026-08-10");
    expect(result.reviewReasons).toEqual([
      "human_approval_required",
      "low_confidence",
      "previous_value_mismatch",
    ]);
  });

  it("rejects one-sided or incorrect evidence offsets", () => {
    expect(() =>
      validateChangeExtraction(
        extraction({
          evidence: {
            text: evidenceText,
            startOffset: evidenceStart,
            endOffset: null,
          },
        }),
        sourceText,
        context,
      ),
    ).toThrow(AnalysisError);
    expect(() =>
      validateChangeExtraction(
        extraction({
          evidence: {
            text: evidenceText,
            startOffset: evidenceStart + 1,
            endOffset: evidenceStart + evidenceText.length + 1,
          },
        }),
        sourceText,
        context,
      ),
    ).toThrow(AnalysisError);
  });
});

describe("validateRecoveryProposal", () => {
  const validatedChange = validateChangeExtraction(extraction(), sourceText, context);

  it("joins exact model annotations to deterministic graph paths", () => {
    const result = validateRecoveryProposal(
      proposal(),
      validatedChange,
      impacts,
      context,
    );

    expect(result.impacts).toEqual([
      {
        itemId: impactedItemId,
        depth: 1,
        path: [changedItemId, impactedItemId],
        severity: "high",
        explanation: "The event briefing depends on the completed pack.",
      },
    ]);
    expect(result.actions[0]).toMatchObject({ expectedItemVersion: 2 });
  });

  it("rejects missing, duplicate, or fabricated impact annotations", () => {
    expect(() =>
      validateRecoveryProposal(
        proposal({ impactAnnotations: [] }),
        validatedChange,
        impacts,
        context,
      ),
    ).toThrow(AnalysisError);
    expect(() =>
      validateRecoveryProposal(
        proposal({
          impactAnnotations: [
            proposal().impactAnnotations[0]!,
            proposal().impactAnnotations[0]!,
          ],
        }),
        validatedChange,
        impacts,
        context,
      ),
    ).toThrow(AnalysisError);
    expect(() =>
      validateRecoveryProposal(
        proposal({
          impactAnnotations: [
            {
              itemId: unknownItemId,
              severity: "low",
              explanation: "Not in the deterministic graph.",
            },
          ],
        }),
        validatedChange,
        impacts,
        context,
      ),
    ).toThrow(AnalysisError);
  });

  it("rejects actions outside the changed-and-affected context", () => {
    const unsafeAction = {
      ...proposal().actions[0]!,
      targetItemId: unknownItemId,
    };

    expect(() =>
      validateRecoveryProposal(
        proposal({ actions: [unsafeAction] }),
        validatedChange,
        impacts,
        context,
      ),
    ).toThrow(AnalysisError);
  });

  it("forces low-confidence actions to require human input", () => {
    const lowConfidenceAction = {
      ...proposal().actions[0]!,
      confidence: 0.4,
      requiresHumanInput: false,
    };
    const result = validateRecoveryProposal(
      proposal({ actions: [lowConfidenceAction] }),
      validatedChange,
      impacts,
      context,
    );

    expect(result.actions[0]).toMatchObject({ requiresHumanInput: true });
  });

  it("supports a no-downstream-impact proposal without inventing graph items", () => {
    const result = validateRecoveryProposal(
      proposal({
        impactAnnotations: [],
        actions: [
          {
            type: "request_confirmation",
            targetItemId: changedItemId,
            question: "Should the changed due date be accepted?",
            reason: "The extracted change still requires human approval.",
            linkedImpactItemId: changedItemId,
            confidence: 0.9,
            requiresHumanInput: true,
          },
        ],
      }),
      validatedChange,
      { changedItemId, impacts: [] },
      context,
    );

    expect(result.impacts).toEqual([]);
    expect(result.actions).toHaveLength(1);
  });
});

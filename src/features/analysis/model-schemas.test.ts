import { describe, expect, it } from "vitest";

import {
  changeExtractionSchema,
  recoveryProposalSchema,
} from "@/features/analysis/model-schemas";

const changedItemId = "3e14b4a4-421d-4d6d-8a7e-01d5a22e3002";
const impactedItemId = "b993a2d1-8060-4c96-a7d0-e79f4cd43303";

const TEST_ONLY_EXTRACTION_FIXTURE = {
  change: {
    targetItemId: changedItemId,
    field: "due_date",
    previousValue: "2026-08-10",
    proposedValue: "2026-08-17",
    evidence: {
      text: "The venue handover is delayed until 17 August.",
      startOffset: 12,
      endOffset: 59,
    },
    confidence: 0.96,
  },
  ambiguities: [],
  unresolvedReferences: [],
  warnings: [],
} as const;

const TEST_ONLY_PROPOSAL_FIXTURE = {
  title: "Recover from the venue handover delay",
  rationale: "Protect the launch date while the revised venue date is confirmed.",
  impactAnnotations: [
    {
      itemId: impactedItemId,
      severity: "high",
      explanation: "The rehearsal depends on venue access.",
    },
  ],
  actions: [
    {
      type: "update_item_field",
      targetItemId: impactedItemId,
      field: "start_date",
      proposedValue: "2026-08-18",
      reason: "Move rehearsal after venue handover.",
      linkedImpactItemId: impactedItemId,
      confidence: 0.91,
      requiresHumanInput: false,
    },
    {
      type: "create_task",
      data: {
        title: "Confirm revised venue access",
        description: "Ask the venue manager to confirm the handover window.",
        priority: "high",
        owner_id: null,
        start_date: null,
        due_date: "2026-08-12",
      },
      reason: "The new date must be verified before rescheduling dependent work.",
      linkedImpactItemId: impactedItemId,
      confidence: 0.89,
      requiresHumanInput: false,
    },
    {
      type: "create_risk",
      data: {
        title: "Venue access slips again",
        description: "The revised handover date is not yet contractually confirmed.",
        priority: "critical",
        owner_id: null,
        due_date: "2026-08-12",
      },
      reason: "Track the unresolved schedule risk explicitly.",
      linkedImpactItemId: impactedItemId,
      confidence: 0.86,
      requiresHumanInput: false,
    },
    {
      type: "request_confirmation",
      targetItemId: impactedItemId,
      question: "Should the rehearsal move to 18 August?",
      reason: "The source does not confirm the team's availability.",
      linkedImpactItemId: impactedItemId,
      confidence: 0.72,
      requiresHumanInput: true,
    },
  ],
} as const;

describe("changeExtractionSchema", () => {
  it("accepts one strict scalar change with nullable evidence offsets", () => {
    expect(changeExtractionSchema.parse(TEST_ONLY_EXTRACTION_FIXTURE)).toEqual(
      TEST_ONLY_EXTRACTION_FIXTURE,
    );

    expect(
      changeExtractionSchema.parse({
        ...TEST_ONLY_EXTRACTION_FIXTURE,
        change: {
          ...TEST_ONLY_EXTRACTION_FIXTURE.change,
          proposedValue: null,
          evidence: {
            ...TEST_ONLY_EXTRACTION_FIXTURE.change.evidence,
            startOffset: null,
            endOffset: null,
          },
        },
      }).change,
    ).toMatchObject({ proposedValue: null });
  });

  it("allows an explicit no-change result without omitting review notes", () => {
    expect(
      changeExtractionSchema.parse({
        change: null,
        ambiguities: ["The referenced milestone is not named."],
        unresolvedReferences: ["the launch review"],
        warnings: [],
      }),
    ).toMatchObject({ change: null });
  });

  it.each([
    ["unknown target", { ...TEST_ONLY_EXTRACTION_FIXTURE.change, targetItemId: "ITEM-1" }],
    ["unapproved field", { ...TEST_ONLY_EXTRACTION_FIXTURE.change, field: "item_type" }],
    ["object value", { ...TEST_ONLY_EXTRACTION_FIXTURE.change, proposedValue: { sql: "drop" } }],
    ["array value", { ...TEST_ONLY_EXTRACTION_FIXTURE.change, proposedValue: ["unsafe"] }],
    ["invalid confidence", { ...TEST_ONLY_EXTRACTION_FIXTURE.change, confidence: 1.01 }],
  ])("rejects %s", (_label, change) => {
    expect(
      changeExtractionSchema.safeParse({
        ...TEST_ONLY_EXTRACTION_FIXTURE,
        change,
      }).success,
    ).toBe(false);
  });

  it("rejects extra keys and unbounded review notes", () => {
    expect(
      changeExtractionSchema.safeParse({
        ...TEST_ONLY_EXTRACTION_FIXTURE,
        executeNow: true,
      }).success,
    ).toBe(false);

    expect(
      changeExtractionSchema.safeParse({
        ...TEST_ONLY_EXTRACTION_FIXTURE,
        warnings: Array.from({ length: 9 }, (_, index) => `warning ${index}`),
      }).success,
    ).toBe(false);
  });
});

describe("recoveryProposalSchema", () => {
  it("accepts only the four allowlisted, discriminated action shapes", () => {
    expect(recoveryProposalSchema.parse(TEST_ONLY_PROPOSAL_FIXTURE)).toEqual(
      TEST_ONLY_PROPOSAL_FIXTURE,
    );
  });

  it("allows no impact annotations when deterministic traversal finds no downstream impacts", () => {
    expect(
      recoveryProposalSchema.safeParse({
        ...TEST_ONLY_PROPOSAL_FIXTURE,
        impactAnnotations: [],
      }).success,
    ).toBe(true);
  });

  it("requires exact impact annotations", () => {
    expect(
      recoveryProposalSchema.safeParse({
        ...TEST_ONLY_PROPOSAL_FIXTURE,
        impactAnnotations: [
          {
            ...TEST_ONLY_PROPOSAL_FIXTURE.impactAnnotations[0],
            dependencyPath: [changedItemId, impactedItemId],
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      recoveryProposalSchema.safeParse({
        ...TEST_ONLY_PROPOSAL_FIXTURE,
        impactAnnotations: [
          {
            ...TEST_ONLY_PROPOSAL_FIXTURE.impactAnnotations[0],
            severity: "urgent",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects arbitrary operations and action payload keys", () => {
    expect(
      recoveryProposalSchema.safeParse({
        ...TEST_ONLY_PROPOSAL_FIXTURE,
        actions: [
          {
            type: "execute_sql",
            sql: "update project_items set status = 'completed'",
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      recoveryProposalSchema.safeParse({
        ...TEST_ONLY_PROPOSAL_FIXTURE,
        actions: [
          {
            ...TEST_ONLY_PROPOSAL_FIXTURE.actions[1],
            data: {
              ...TEST_ONLY_PROPOSAL_FIXTURE.actions[1].data,
              tableName: "project_items",
            },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("caps proposals at eight actions", () => {
    const action = TEST_ONLY_PROPOSAL_FIXTURE.actions[0];

    expect(
      recoveryProposalSchema.safeParse({
        ...TEST_ONLY_PROPOSAL_FIXTURE,
        actions: Array.from({ length: 9 }, () => action),
      }).success,
    ).toBe(false);
  });

  it("requires at least one inert review action", () => {
    expect(
      recoveryProposalSchema.safeParse({
        ...TEST_ONLY_PROPOSAL_FIXTURE,
        actions: [],
      }).success,
    ).toBe(false);
  });

  it("requires confirmation actions to include an explicit human-input flag", () => {
    expect(
      recoveryProposalSchema.safeParse({
        ...TEST_ONLY_PROPOSAL_FIXTURE,
        actions: [
          {
            type: "request_confirmation",
            targetItemId: impactedItemId,
            question: "Should the rehearsal move to 18 August?",
            reason: "The source does not confirm the team's availability.",
            linkedImpactItemId: impactedItemId,
            confidence: 0.72,
          },
        ],
      }).success,
    ).toBe(false);
  });
});

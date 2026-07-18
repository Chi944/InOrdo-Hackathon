import { describe, expect, it } from "vitest";

import {
  applyProposalRequestSchema,
  operationHistoryQuerySchema,
  resetDemoRequestSchema,
  undoOperationRequestSchema,
} from "@/features/operations/request-schemas";

const firstActionId = "4c320952-a5e8-40d3-824b-d528c61de101";
const secondActionId = "4c320952-a5e8-40d3-824b-d528c61de102";

const validApplyRequest = {
  selectedActionIds: [firstActionId, secondActionId],
  humanInputs: [
    {
      actionId: secondActionId,
      confirmed: true,
      response: "Confirmed by the delivery lead.",
    },
  ],
  idempotencyKey: "apply_20260718_001",
};

describe("applyProposalRequestSchema", () => {
  it("accepts a strict selective approval request with explicit human input", () => {
    expect(applyProposalRequestSchema.parse(validApplyRequest)).toEqual(
      validApplyRequest,
    );
  });

  it("rejects unknown request and human-input fields", () => {
    expect(
      applyProposalRequestSchema.safeParse({
        ...validApplyRequest,
        table: "project_items",
      }).success,
    ).toBe(false);
    expect(
      applyProposalRequestSchema.safeParse({
        ...validApplyRequest,
        humanInputs: [
          {
            ...validApplyRequest.humanInputs[0],
            privileged: true,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("requires selected action IDs to be unique", () => {
    expect(
      applyProposalRequestSchema.safeParse({
        ...validApplyRequest,
        selectedActionIds: [firstActionId, firstActionId],
        humanInputs: [],
      }).success,
    ).toBe(false);
  });

  it("requires human-input action IDs to be unique and selected", () => {
    expect(
      applyProposalRequestSchema.safeParse({
        ...validApplyRequest,
        humanInputs: [
          validApplyRequest.humanInputs[0],
          validApplyRequest.humanInputs[0],
        ],
      }).success,
    ).toBe(false);
    expect(
      applyProposalRequestSchema.safeParse({
        ...validApplyRequest,
        selectedActionIds: [firstActionId],
      }).success,
    ).toBe(false);
  });

  it("accepts human input only when confirmation is explicitly true", () => {
    expect(
      applyProposalRequestSchema.safeParse({
        ...validApplyRequest,
        humanInputs: [
          {
            actionId: secondActionId,
            response: "Confirmed by the delivery lead.",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      applyProposalRequestSchema.safeParse({
        ...validApplyRequest,
        humanInputs: [
          {
            actionId: secondActionId,
            confirmed: false,
            response: "Not confirmed.",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("bounds action lists and human responses", () => {
    expect(
      applyProposalRequestSchema.safeParse({
        ...validApplyRequest,
        selectedActionIds: [],
        humanInputs: [],
      }).success,
    ).toBe(false);
    expect(
      applyProposalRequestSchema.safeParse({
        ...validApplyRequest,
        selectedActionIds: Array.from(
          { length: 51 },
          (_, index) =>
            `4c320952-a5e8-40d3-824b-${String(index).padStart(12, "0")}`,
        ),
        humanInputs: [],
      }).success,
    ).toBe(false);
    expect(
      applyProposalRequestSchema.safeParse({
        ...validApplyRequest,
        humanInputs: [
          {
            actionId: secondActionId,
            confirmed: true,
            response: "x".repeat(2_001),
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("operation idempotency schemas", () => {
  it("accepts bounded portable idempotency keys", () => {
    const minimumKey = "a".repeat(8);
    const maximumKey = `apply-${"a".repeat(194)}`;

    expect(
      undoOperationRequestSchema.parse({ idempotencyKey: minimumKey }),
    ).toEqual({ idempotencyKey: minimumKey });
    expect(
      undoOperationRequestSchema.parse({ idempotencyKey: maximumKey }),
    ).toEqual({ idempotencyKey: maximumKey });
  });

  it("rejects short, oversized, whitespace, slash, and non-ASCII keys", () => {
    for (const idempotencyKey of [
      "short",
      "a".repeat(201),
      "has space",
      "has/slash",
      "opération-key",
    ]) {
      expect(
        undoOperationRequestSchema.safeParse({ idempotencyKey }).success,
      ).toBe(false);
    }
  });

  it("rejects unknown fields instead of accepting operation identifiers in bodies", () => {
    expect(
      undoOperationRequestSchema.safeParse({
        idempotencyKey: "undo_20260718_001",
        operationId: "d1669e0f-604c-4ec2-8ff1-717b2a4d5101",
      }).success,
    ).toBe(false);
  });
});

describe("resetDemoRequestSchema", () => {
  it("requires an explicit confirmation and never accepts a reset secret", () => {
    expect(
      resetDemoRequestSchema.parse({
        confirmed: true,
        idempotencyKey: "reset_20260718_001",
      }),
    ).toEqual({
      confirmed: true,
      idempotencyKey: "reset_20260718_001",
    });
    expect(
      resetDemoRequestSchema.safeParse({
        idempotencyKey: "reset_20260718_002",
      }).success,
    ).toBe(false);
    expect(
      resetDemoRequestSchema.safeParse({
        confirmed: false,
        idempotencyKey: "reset_20260718_003",
      }).success,
    ).toBe(false);
    expect(
      resetDemoRequestSchema.safeParse({
        confirmed: true,
        idempotencyKey: "reset_20260718_004",
        secret: "must-not-be-in-a-request-body",
      }).success,
    ).toBe(false);
  });
});

describe("operationHistoryQuerySchema", () => {
  it("supplies bounded defaults for a project-scoped history list", () => {
    expect(operationHistoryQuerySchema.parse({})).toEqual({
      limit: 25,
      includeArchived: false,
    });
    expect(
      operationHistoryQuerySchema.parse({
        limit: 100,
        includeArchived: true,
      }),
    ).toEqual({ limit: 100, includeArchived: true });
  });

  it("rejects out-of-range list limits, coercion, and unknown filters", () => {
    for (const limit of [0, 101, 1.5, "25"]) {
      expect(
        operationHistoryQuerySchema.safeParse({ limit }).success,
      ).toBe(false);
    }
    expect(
      operationHistoryQuerySchema.safeParse({
        limit: 25,
        workspaceId: "166645ec-1ab3-48dc-98c7-3b6f99b70301",
      }).success,
    ).toBe(false);
  });
});

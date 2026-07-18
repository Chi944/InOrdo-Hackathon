import { z } from "zod";

const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(200)
  .regex(/^[A-Za-z0-9._:-]+$/, {
    error: "Use only letters, numbers, periods, underscores, colons, and hyphens.",
  });

const actionIdSchema = z.uuid();

const humanInputSchema = z.strictObject({
  actionId: actionIdSchema,
  confirmed: z.literal(true),
  response: z.string().trim().min(1).max(2_000),
});

export const applyProposalRequestSchema = z
  .strictObject({
    selectedActionIds: z.array(actionIdSchema).min(1).max(50),
    humanInputs: z.array(humanInputSchema).max(50).default([]),
    idempotencyKey: idempotencyKeySchema,
  })
  .superRefine((value, context) => {
    const selected = new Set(value.selectedActionIds);
    if (selected.size !== value.selectedActionIds.length) {
      context.addIssue({
        code: "custom",
        path: ["selectedActionIds"],
        message: "Each selected action must appear once.",
      });
    }

    const humanInputIds = value.humanInputs.map(({ actionId }) => actionId);
    if (new Set(humanInputIds).size !== humanInputIds.length) {
      context.addIssue({
        code: "custom",
        path: ["humanInputs"],
        message: "Each action may have one human response.",
      });
    }

    for (const [index, humanInput] of value.humanInputs.entries()) {
      if (!selected.has(humanInput.actionId)) {
        context.addIssue({
          code: "custom",
          path: ["humanInputs", index, "actionId"],
          message: "Human input must belong to a selected action.",
        });
      }
    }
  });

export const undoOperationRequestSchema = z.strictObject({
  idempotencyKey: idempotencyKeySchema,
});

export const resetDemoRequestSchema = z.strictObject({
  confirmed: z.literal(true),
  idempotencyKey: idempotencyKeySchema,
});

export const operationHistoryQuerySchema = z.strictObject({
  limit: z.number().int().min(1).max(100).default(25),
  includeArchived: z.boolean().default(false),
});

export type ApplyProposalRequest = z.infer<typeof applyProposalRequestSchema>;
export type UndoOperationRequest = z.infer<typeof undoOperationRequestSchema>;
export type ResetDemoRequest = z.infer<typeof resetDemoRequestSchema>;
export type OperationHistoryQuery = z.infer<typeof operationHistoryQuerySchema>;

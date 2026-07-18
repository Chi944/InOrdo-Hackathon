import { z } from "zod";

const MAX_REVIEW_NOTES = 8;
const MAX_PROPOSAL_ACTIONS = 8;
const MAX_IMPACT_ANNOTATIONS = 200;

const itemIdSchema = z.uuid({
  error: "The model must return a supplied project item UUID.",
});

const boundedTextSchema = z.string().trim().min(1).max(1_000);
const optionalRecordTextSchema = z.string().trim().max(10_000).nullable();
const nullableDateSchema = z.iso.date().nullable();
const nullableOwnerIdSchema = itemIdSchema.nullable();
const confidenceSchema = z.number().min(0).max(1);
const prioritySchema = z.enum(["low", "medium", "high", "critical"]);

export const projectItemModelFieldSchema = z.enum([
  "title",
  "description",
  "status",
  "priority",
  "owner_id",
  "start_date",
  "due_date",
  "event_date",
]);

export const jsonScalarSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const extractionChangeSchema = z.strictObject({
  targetItemId: itemIdSchema,
  field: projectItemModelFieldSchema,
  previousValue: jsonScalarSchema,
  proposedValue: jsonScalarSchema,
  evidence: z.strictObject({
    text: z.string().trim().min(1).max(2_000),
    startOffset: z.number().int().min(0).max(100_000).nullable(),
    endOffset: z.number().int().min(0).max(100_000).nullable(),
  }),
  confidence: confidenceSchema,
});

const reviewNotesSchema = z.array(z.string().trim().min(1).max(500)).max(MAX_REVIEW_NOTES);

export const changeExtractionSchema = z.strictObject({
  change: extractionChangeSchema.nullable(),
  ambiguities: reviewNotesSchema,
  unresolvedReferences: reviewNotesSchema,
  warnings: reviewNotesSchema,
});

const actionReasonFields = {
  reason: boundedTextSchema,
  linkedImpactItemId: itemIdSchema,
  confidence: confidenceSchema,
  requiresHumanInput: z.boolean(),
} as const;

const updateItemFieldActionSchema = z.strictObject({
  type: z.literal("update_item_field"),
  targetItemId: itemIdSchema,
  field: projectItemModelFieldSchema,
  proposedValue: jsonScalarSchema,
  ...actionReasonFields,
});

const taskDataSchema = z.strictObject({
  title: z.string().trim().min(1).max(240),
  description: optionalRecordTextSchema,
  priority: prioritySchema,
  owner_id: nullableOwnerIdSchema,
  start_date: nullableDateSchema,
  due_date: nullableDateSchema,
});

const createTaskActionSchema = z.strictObject({
  type: z.literal("create_task"),
  data: taskDataSchema,
  ...actionReasonFields,
});

const riskDataSchema = z.strictObject({
  title: z.string().trim().min(1).max(240),
  description: optionalRecordTextSchema,
  priority: prioritySchema,
  owner_id: nullableOwnerIdSchema,
  due_date: nullableDateSchema,
});

const createRiskActionSchema = z.strictObject({
  type: z.literal("create_risk"),
  data: riskDataSchema,
  ...actionReasonFields,
});

const requestConfirmationActionSchema = z.strictObject({
  type: z.literal("request_confirmation"),
  targetItemId: itemIdSchema,
  question: boundedTextSchema,
  reason: boundedTextSchema,
  linkedImpactItemId: itemIdSchema,
  confidence: confidenceSchema,
  requiresHumanInput: z.boolean(),
});

export const recoveryProposalActionSchema = z.discriminatedUnion("type", [
  updateItemFieldActionSchema,
  createTaskActionSchema,
  createRiskActionSchema,
  requestConfirmationActionSchema,
]);

export const recoveryProposalSchema = z.strictObject({
  title: z.string().trim().min(1).max(240),
  rationale: z.string().trim().min(1).max(2_000),
  impactAnnotations: z
    .array(
      z.strictObject({
        itemId: itemIdSchema,
        severity: z.enum(["low", "medium", "high", "critical"]),
        explanation: boundedTextSchema,
      }),
    )
    .max(MAX_IMPACT_ANNOTATIONS),
  actions: z
    .array(recoveryProposalActionSchema)
    .min(1)
    .max(MAX_PROPOSAL_ACTIONS),
});

export type ChangeExtraction = z.infer<typeof changeExtractionSchema>;
export type RecoveryProposal = z.infer<typeof recoveryProposalSchema>;
export type RecoveryProposalAction = z.infer<
  typeof recoveryProposalActionSchema
>;

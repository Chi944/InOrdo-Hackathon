import { z } from "zod";

const itemTypes = [
  "task",
  "milestone",
  "decision",
  "event",
  "risk",
  "artifact",
] as const;

const itemStatuses = [
  "not_started",
  "in_progress",
  "blocked",
  "at_risk",
  "completed",
  "cancelled",
] as const;

const itemPriorities = ["low", "medium", "high", "critical"] as const;

const dependencyRelationships = [
  "depends_on",
  "requires",
  "informs",
  "scheduled_by",
] as const;

const projectIdSchema = z.uuid({
  error: "Project ID must be a valid UUID.",
});

const itemIdSchema = z.uuid({
  error: "Item ID must be a valid UUID.",
});

const dependencyIdSchema = z.uuid({
  error: "Dependency ID must be a valid UUID.",
});

const itemKeySchema = z
  .string()
  .trim()
  .min(4, "Item key must be at least 4 characters.")
  .max(64, "Item key must be 64 characters or fewer.")
  .regex(
    /^[A-Z][A-Z0-9]*-[0-9]{2,}$/,
    "Item key must use the format PREFIX-12.",
  );

const titleSchema = z
  .string()
  .trim()
  .min(1, "Title is required.")
  .max(240, "Title must be 240 characters or fewer.");

const descriptionSchema = z
  .string()
  .trim()
  .max(10_000, "Description must be 10,000 characters or fewer.");

const rationaleSchema = z
  .string()
  .trim()
  .min(1, "Rationale cannot be empty.")
  .max(2_000, "Rationale must be 2,000 characters or fewer.");

const dateSchema = z.iso.date({
  error: "Date must use the YYYY-MM-DD format.",
});

const projectItemFields = {
  itemKey: itemKeySchema,
  itemType: z.enum(itemTypes, { error: "Item type is not supported." }),
  title: titleSchema,
  description: descriptionSchema.nullable(),
  status: z.enum(itemStatuses, { error: "Status is not supported." }),
  priority: z.enum(itemPriorities, { error: "Priority is not supported." }),
  ownerId: itemIdSchema.nullable(),
  startDate: dateSchema.nullable(),
  dueDate: dateSchema.nullable(),
  eventDate: dateSchema.nullable(),
} as const;

function addProjectItemDateRules(
  value: {
    itemType?: (typeof itemTypes)[number];
    startDate?: string | null;
    dueDate?: string | null;
    eventDate?: string | null;
  },
  context: z.RefinementCtx,
) {
  if (
    value.startDate !== undefined &&
    value.startDate !== null &&
    value.dueDate !== undefined &&
    value.dueDate !== null &&
    value.startDate > value.dueDate
  ) {
    context.addIssue({
      code: "custom",
      path: ["dueDate"],
      message: "Start date must be on or before due date.",
    });
  }

  if (value.itemType !== undefined && value.itemType !== "event" && value.eventDate) {
    context.addIssue({
      code: "custom",
      path: ["eventDate"],
      message: "Event date is only allowed for event items.",
    });
  }
}

export const createProjectItemSchema = z
  .object({
    projectId: projectIdSchema,
    ...projectItemFields,
    description: projectItemFields.description.optional(),
    status: projectItemFields.status.default("not_started"),
    priority: projectItemFields.priority.default("medium"),
    ownerId: projectItemFields.ownerId.optional(),
    startDate: projectItemFields.startDate.optional(),
    dueDate: projectItemFields.dueDate.optional(),
    eventDate: projectItemFields.eventDate.optional(),
  })
  .strict()
  .superRefine(addProjectItemDateRules);

export const updateProjectItemSchema = z
  .object({
    projectId: projectIdSchema,
    itemId: itemIdSchema,
    expectedVersion: z
      .number({ error: "Expected version must be a number." })
      .int("Expected version must be an integer.")
      .positive("Expected version must be a positive integer."),
    itemKey: projectItemFields.itemKey.optional(),
    itemType: projectItemFields.itemType.optional(),
    title: projectItemFields.title.optional(),
    description: projectItemFields.description.optional(),
    status: projectItemFields.status.optional(),
    priority: projectItemFields.priority.optional(),
    ownerId: projectItemFields.ownerId.optional(),
    startDate: projectItemFields.startDate.optional(),
    dueDate: projectItemFields.dueDate.optional(),
    eventDate: projectItemFields.eventDate.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const patchKeys = Object.keys(value).filter(
      (key) => !["projectId", "itemId", "expectedVersion"].includes(key),
    );

    if (patchKeys.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Provide at least one project item field to update.",
      });
    }

    addProjectItemDateRules(value, context);
  });

export const createDependencySchema = z
  .object({
    projectId: projectIdSchema,
    fromItemId: itemIdSchema,
    toItemId: itemIdSchema,
    relationship: z
      .enum(dependencyRelationships, {
        error: "Dependency relationship is not supported.",
      })
      .default("requires"),
    rationale: rationaleSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.fromItemId === value.toItemId) {
      context.addIssue({
        code: "custom",
        path: ["toItemId"],
        message: "A dependency cannot reference the same item.",
      });
    }
  });

export const deleteDependencySchema = z
  .object({
    projectId: projectIdSchema,
    dependencyId: dependencyIdSchema,
  })
  .strict();

export const listProjectItemsFilterSchema = z
  .object({
    status: z.enum(itemStatuses, { error: "Status is not supported." }).optional(),
    itemType: z.enum(itemTypes, { error: "Item type is not supported." }).optional(),
    priority: z
      .enum(itemPriorities, { error: "Priority is not supported." })
      .optional(),
    ownerId: itemIdSchema.optional(),
    search: z
      .string()
      .trim()
      .min(1, "Search cannot be empty.")
      .max(200, "Search must be 200 characters or fewer.")
      .optional(),
    cursor: itemKeySchema.optional(),
    limit: z
      .number({ error: "Limit must be a number." })
      .int("Limit must be an integer.")
      .min(1, "Limit must be at least 1.")
      .max(100, "Limit must be 100 or fewer.")
      .default(25),
  })
  .strict();

export type CreateProjectItemInput = z.infer<typeof createProjectItemSchema>;
export type UpdateProjectItemInput = z.infer<typeof updateProjectItemSchema>;
export type CreateDependencyInput = z.infer<typeof createDependencySchema>;
export type DeleteDependencyInput = z.infer<typeof deleteDependencySchema>;
export type ListProjectItemsFilters = z.infer<typeof listProjectItemsFilterSchema>;

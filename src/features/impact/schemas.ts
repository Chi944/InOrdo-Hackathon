import { z } from "zod";

const itemIdSchema = z
  .string({ error: "Enter a valid item id." })
  .trim()
  .min(1, "Enter a valid item id.")
  .max(128, "Enter a valid item id.");

export const dependencyRelationshipSchema = z.enum(
  ["depends_on", "requires", "informs", "scheduled_by"],
  { error: "Choose a valid dependency relationship." },
);

export const impactGraphItemSchema = z.strictObject({
  id: itemIdSchema,
  active: z.boolean({ error: "Specify whether the item is active." }),
});

export const dependencyEdgeSchema = z.strictObject({
  fromItemId: itemIdSchema,
  toItemId: itemIdSchema,
  relationship: dependencyRelationshipSchema,
});

export const impactTraversalInputSchema = z.strictObject({
  changedItemId: itemIdSchema,
  items: z
    .array(impactGraphItemSchema, { error: "Provide valid graph items." })
    .min(1, "Provide at least one graph item.")
    .max(500, "Too many graph items were provided."),
  dependencies: z
    .array(dependencyEdgeSchema, { error: "Provide valid dependencies." })
    .max(2_000, "Too many dependencies were provided."),
  maxDepth: z
    .number({ error: "Enter a valid maximum depth." })
    .int("Enter a valid maximum depth.")
    .min(0, "Enter a valid maximum depth.")
    .max(20, "Enter a valid maximum depth.")
    .default(5),
});

export const impactedItemSchema = z.strictObject({
  itemId: itemIdSchema,
  depth: z
    .number({ error: "Enter a valid impact depth." })
    .int("Enter a valid impact depth.")
    .min(1, "Enter a valid impact depth.")
    .max(20, "Enter a valid impact depth."),
  path: z
    .array(itemIdSchema, { error: "Provide a valid impact path." })
    .min(2, "Provide a valid impact path.")
    .max(21, "Impact path is too long."),
});

export const impactTraversalOutputSchema = z
  .strictObject({
    changedItemId: itemIdSchema,
    impacts: z
      .array(impactedItemSchema, { error: "Provide valid impacts." })
      .max(499, "Too many impacted items were produced."),
  })
  .superRefine((output, context) => {
    const seenItemIds = new Set<string>();

    output.impacts.forEach((impact, index) => {
      if (
        impact.path[0] !== output.changedItemId ||
        impact.path.at(-1) !== impact.itemId
      ) {
        context.addIssue({
          code: "custom",
          path: ["impacts", index, "path"],
          message: "Impact path endpoints are inconsistent.",
        });
      }
      if (impact.depth !== impact.path.length - 1) {
        context.addIssue({
          code: "custom",
          path: ["impacts", index, "depth"],
          message: "Impact depth does not match its path.",
        });
      }
      if (seenItemIds.has(impact.itemId)) {
        context.addIssue({
          code: "custom",
          path: ["impacts", index, "itemId"],
          message: "Each affected item may appear only once.",
        });
      }
      seenItemIds.add(impact.itemId);
    });
  });

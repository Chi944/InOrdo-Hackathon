import type { z } from "zod";

import type {
  dependencyEdgeSchema,
  dependencyRelationshipSchema,
  impactGraphItemSchema,
  impactedItemSchema,
  impactTraversalInputSchema,
  impactTraversalOutputSchema,
} from "@/features/impact/schemas";

export type DependencyRelationship = z.infer<
  typeof dependencyRelationshipSchema
>;
export type ImpactGraphItem = z.infer<typeof impactGraphItemSchema>;
export type DependencyEdge = z.infer<typeof dependencyEdgeSchema>;
export type ImpactedItem = z.infer<typeof impactedItemSchema>;
export type ImpactTraversalInput = z.input<typeof impactTraversalInputSchema>;
export type ImpactTraversalOutput = z.infer<
  typeof impactTraversalOutputSchema
>;

import { z } from "zod";

export const maximumAnalysisSourceLength = 12_000;
export const maximumAnalysisRequestBytes = 24_000;

const sourceTextSchema = z
  .string({ error: "Provide source text." })
  .min(1, "Provide source text.")
  .max(maximumAnalysisSourceLength, "Source text is too long.")
  .refine((value) => value.trim().length > 0, "Provide source text.");

export const analysisSourceSchema = z.strictObject({
  title: z
    .string({ error: "Provide a source title." })
    .trim()
    .min(1, "Provide a source title.")
    .max(240, "Source title is too long."),
  type: z.enum(["pasted_update", "manual_note"], {
    error: "Choose a supported source type.",
  }),
  author: z
    .string({ error: "Provide the source author." })
    .trim()
    .min(1, "Provide the source author.")
    .max(120, "Source author is too long."),
  timestamp: z
    .iso
    .datetime({ offset: true, error: "Provide a valid source timestamp." })
    .nullable()
    .optional()
    .default(null),
  text: sourceTextSchema,
});

export const analyzeProjectRequestSchema = z.strictObject({
  source: analysisSourceSchema,
  maxDepth: z
    .number({ error: "Provide a valid maximum graph depth." })
    .int("Provide a valid maximum graph depth.")
    .min(1, "Maximum graph depth must be at least one.")
    .max(20, "Maximum graph depth cannot exceed twenty.")
    .optional()
    .default(5),
});

export type AnalysisSource = z.infer<typeof analysisSourceSchema>;
export type AnalyzeProjectRequest = z.infer<
  typeof analyzeProjectRequestSchema
>;

/**
 * Produces only the duplicate-detection representation. The original source is
 * preserved separately as immutable evidence.
 */
export function normalizeSourceTextForHash(value: string): string {
  return value
    .normalize("NFC")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(/^[\t ]+|[\t ]+$/g, "")
        .replace(/[\t ]+/g, " "),
    )
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

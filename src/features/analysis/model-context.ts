import type { AnalysisContextItem } from "@/features/analysis/context";

export const maximumModelItemDescriptionCharacters = 500;
export const maximumModelDescriptionCharacters = 15_000;
export const maximumModelItemContextBytes = 160_000;

export type ModelContextItem = Omit<AnalysisContextItem, "description"> & {
  description: string | null;
  descriptionTruncated: boolean;
};

export class ModelContextBoundsError extends Error {
  constructor() {
    super("The project contains too much text for one bounded analysis.");
    this.name = "ModelContextBoundsError";
  }
}

export function buildBoundedModelItemContext(
  items: readonly AnalysisContextItem[],
): ModelContextItem[] {
  let remainingDescriptionCharacters = maximumModelDescriptionCharacters;
  const projected = items.map((item) => {
    const original = item.description ?? "";
    const descriptionLength = Math.min(
      original.length,
      maximumModelItemDescriptionCharacters,
      remainingDescriptionCharacters,
    );
    const description =
      descriptionLength > 0 ? original.slice(0, descriptionLength) : null;
    remainingDescriptionCharacters -= descriptionLength;

    return {
      ...item,
      description,
      descriptionTruncated: descriptionLength < original.length,
    };
  });

  const encodedBytes = new TextEncoder().encode(
    JSON.stringify(projected),
  ).byteLength;
  if (encodedBytes > maximumModelItemContextBytes) {
    throw new ModelContextBoundsError();
  }

  return projected;
}

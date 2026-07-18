import { describe, expect, it } from "vitest";

import type { AnalysisContextItem } from "@/features/analysis/context";
import {
  buildBoundedModelItemContext,
  maximumModelDescriptionCharacters,
  maximumModelItemContextBytes,
  maximumModelItemDescriptionCharacters,
  ModelContextBoundsError,
} from "@/features/analysis/model-context";

function item(index: number, overrides: Partial<AnalysisContextItem> = {}) {
  return {
    id: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    itemKey: `TSK-${index}`,
    itemType: "task" as const,
    title: `Bounded item ${index}`,
    description: "x".repeat(10_000),
    status: "not_started" as const,
    priority: "medium" as const,
    ownerId: null,
    startDate: null,
    dueDate: null,
    eventDate: null,
    version: 1,
    ...overrides,
  };
}

describe("bounded analysis model context", () => {
  it("caps each description and the aggregate description budget deterministically", () => {
    const projected = buildBoundedModelItemContext(
      Array.from({ length: 200 }, (_, index) => item(index + 1)),
    );
    const descriptionCharacters = projected.reduce(
      (total, entry) => total + (entry.description?.length ?? 0),
      0,
    );

    expect(descriptionCharacters).toBe(maximumModelDescriptionCharacters);
    expect(
      projected.every(
        (entry) =>
          (entry.description?.length ?? 0) <=
          maximumModelItemDescriptionCharacters,
      ),
    ).toBe(true);
    expect(projected.every((entry) => entry.descriptionTruncated)).toBe(true);
    expect(
      new TextEncoder().encode(JSON.stringify(projected)).byteLength,
    ).toBeLessThanOrEqual(maximumModelItemContextBytes);
    expect(buildBoundedModelItemContext([item(1)])).toEqual(
      buildBoundedModelItemContext([item(1)]),
    );
  });

  it("fails closed when bounded canonical metadata alone exceeds the byte budget", () => {
    const oversizedTitles = Array.from({ length: 200 }, (_, index) =>
      item(index + 1, {
        title: "W".repeat(2_000),
        description: null,
      }),
    );

    expect(() => buildBoundedModelItemContext(oversizedTitles)).toThrow(
      ModelContextBoundsError,
    );
  });
});

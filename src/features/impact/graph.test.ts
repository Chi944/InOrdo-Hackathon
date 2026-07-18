import { describe, expect, it } from "vitest";

import {
  impactTraversalInputSchema,
  impactTraversalOutputSchema,
} from "@/features/impact/schemas";
import { traverseImpactGraph } from "@/features/impact/traverse";

const item = (id: string, active = true) => ({ id, active });

const dependency = (fromItemId: string, toItemId: string) => ({
  fromItemId,
  toItemId,
  relationship: "requires" as const,
});

describe("traverseImpactGraph", () => {
  it("follows dependent edges from a changed upstream item", () => {
    const result = traverseImpactGraph({
      changedItemId: "A",
      items: [item("A"), item("B"), item("C")],
      dependencies: [dependency("B", "A"), dependency("C", "B")],
    });

    expect(result).toEqual({
      changedItemId: "A",
      impacts: [
        { itemId: "B", depth: 1, path: ["A", "B"] },
        { itemId: "C", depth: 2, path: ["A", "B", "C"] },
      ],
    });
  });

  it("returns every direct dependent in stable item-id order", () => {
    const result = traverseImpactGraph({
      changedItemId: "A",
      items: [item("C"), item("B"), item("A"), item("D")],
      dependencies: [
        dependency("C", "A"),
        dependency("B", "A"),
        dependency("D", "A"),
      ],
    });

    expect(result.impacts).toEqual([
      { itemId: "B", depth: 1, path: ["A", "B"] },
      { itemId: "C", depth: 1, path: ["A", "C"] },
      { itemId: "D", depth: 1, path: ["A", "D"] },
    ]);
  });

  it("traverses fan-in relationships from each reachable upstream branch", () => {
    const result = traverseImpactGraph({
      changedItemId: "A",
      items: [item("A"), item("B"), item("C"), item("D")],
      dependencies: [
        dependency("B", "A"),
        dependency("C", "A"),
        dependency("D", "B"),
        dependency("D", "C"),
      ],
    });

    expect(result.impacts).toEqual([
      { itemId: "B", depth: 1, path: ["A", "B"] },
      { itemId: "C", depth: 1, path: ["A", "C"] },
      { itemId: "D", depth: 2, path: ["A", "B", "D"] },
    ]);
  });

  it("returns the shortest deterministic path when multiple paths reach an item", () => {
    const result = traverseImpactGraph({
      changedItemId: "A",
      items: [item("A"), item("B"), item("C"), item("D")],
      dependencies: [
        dependency("C", "A"),
        dependency("B", "A"),
        dependency("D", "B"),
        dependency("D", "C"),
        dependency("D", "A"),
      ],
    });

    expect(result.impacts).toContainEqual({
      itemId: "D",
      depth: 1,
      path: ["A", "D"],
    });
  });

  it("defends against cycles without returning the changed item", () => {
    const result = traverseImpactGraph({
      changedItemId: "A",
      items: [item("A"), item("B"), item("C")],
      dependencies: [dependency("B", "A"), dependency("C", "B"), dependency("A", "C")],
    });

    expect(result.impacts).toEqual([
      { itemId: "B", depth: 1, path: ["A", "B"] },
      { itemId: "C", depth: 2, path: ["A", "B", "C"] },
    ]);
  });

  it("ignores self-loop edges", () => {
    const result = traverseImpactGraph({
      changedItemId: "A",
      items: [item("A"), item("B")],
      dependencies: [dependency("A", "A"), dependency("B", "A")],
    });

    expect(result.impacts).toEqual([
      { itemId: "B", depth: 1, path: ["A", "B"] },
    ]);
  });

  it("deduplicates identical edges", () => {
    const result = traverseImpactGraph({
      changedItemId: "A",
      items: [item("A"), item("B")],
      dependencies: [dependency("B", "A"), dependency("B", "A")],
    });

    expect(result.impacts).toEqual([
      { itemId: "B", depth: 1, path: ["A", "B"] },
    ]);
  });

  it("does not include disconnected items", () => {
    const result = traverseImpactGraph({
      changedItemId: "A",
      items: [item("A"), item("B"), item("C"), item("D")],
      dependencies: [dependency("B", "A"), dependency("D", "C")],
    });

    expect(result.impacts.map((impact) => impact.itemId)).toEqual(["B"]);
  });

  it("limits traversal to the configured max depth", () => {
    const result = traverseImpactGraph({
      changedItemId: "A",
      items: [item("A"), item("B"), item("C"), item("D")],
      dependencies: [dependency("B", "A"), dependency("C", "B"), dependency("D", "C")],
      maxDepth: 2,
    });

    expect(result.impacts).toEqual([
      { itemId: "B", depth: 1, path: ["A", "B"] },
      { itemId: "C", depth: 2, path: ["A", "B", "C"] },
    ]);
  });

  it("uses a default max depth of five", () => {
    const result = traverseImpactGraph({
      changedItemId: "A",
      items: ["A", "B", "C", "D", "E", "F", "G"].map((id) => item(id)),
      dependencies: [
        dependency("B", "A"),
        dependency("C", "B"),
        dependency("D", "C"),
        dependency("E", "D"),
        dependency("F", "E"),
        dependency("G", "F"),
      ],
    });

    expect(result.impacts.map((impact) => impact.itemId)).toEqual([
      "B",
      "C",
      "D",
      "E",
      "F",
    ]);
  });

  it("excludes inactive items and does not traverse through them", () => {
    const result = traverseImpactGraph({
      changedItemId: "A",
      items: [item("A"), item("B", false), item("C")],
      dependencies: [dependency("B", "A"), dependency("C", "B")],
    });

    expect(result.impacts).toEqual([]);
  });
});

describe("impact graph schemas", () => {
  it("accepts only bounded, explicitly allowed graph input fields", () => {
    const parsed = impactTraversalInputSchema.parse({
      changedItemId: "A",
      items: [item("A"), item("B")],
      dependencies: [dependency("B", "A")],
    });

    expect(parsed.maxDepth).toBe(5);
    expect(
      impactTraversalInputSchema.safeParse({
        ...parsed,
        internalDetail: "do not accept",
      }).success,
    ).toBe(false);
    expect(
      impactTraversalInputSchema.safeParse({
        ...parsed,
        maxDepth: 21,
      }).success,
    ).toBe(false);
    expect(
      impactTraversalInputSchema.safeParse({
        ...parsed,
        dependencies: [
          { fromItemId: "B", toItemId: "A", relationship: "unknown" },
        ],
      }).success,
    ).toBe(false);
  });

  it("uses safe validation messages without echoing invalid input", () => {
    const invalidValue = "private internal value".repeat(10);
    const result = impactTraversalInputSchema.safeParse({
      changedItemId: invalidValue,
      items: [item("A")],
      dependencies: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message).join(" ")).not.toContain(
        invalidValue,
      );
    }
  });

  it("allows only the declared output shape", () => {
    expect(
      impactTraversalOutputSchema.safeParse({
        changedItemId: "A",
        impacts: [{ itemId: "B", depth: 1, path: ["A", "B"] }],
      }).success,
    ).toBe(true);
    expect(
      impactTraversalOutputSchema.safeParse({
        changedItemId: "A",
        impacts: [],
        databaseError: "private detail",
      }).success,
    ).toBe(false);
  });

  it("rejects inconsistent output paths and duplicate affected items", () => {
    expect(
      impactTraversalOutputSchema.safeParse({
        changedItemId: "A",
        impacts: [{ itemId: "B", depth: 2, path: ["A", "B"] }],
      }).success,
    ).toBe(false);
    expect(
      impactTraversalOutputSchema.safeParse({
        changedItemId: "A",
        impacts: [{ itemId: "B", depth: 1, path: ["X", "B"] }],
      }).success,
    ).toBe(false);
    expect(
      impactTraversalOutputSchema.safeParse({
        changedItemId: "A",
        impacts: [
          { itemId: "B", depth: 1, path: ["A", "B"] },
          { itemId: "B", depth: 2, path: ["A", "C", "B"] },
        ],
      }).success,
    ).toBe(false);
  });
});

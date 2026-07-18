import { describe, expect, it } from "vitest";

import {
  analyzeProjectRequestSchema,
  normalizeSourceTextForHash,
} from "@/features/analysis/request-schemas";

const validRequest = {
  source: {
    title: "Programme update",
    type: "pasted_update",
    author: "Programme team",
    timestamp: "2026-07-18T09:30:00+08:00",
    text: "The speaker confirmation moved to 2026-08-10.",
  },
};

describe("analyzeProjectRequestSchema", () => {
  it("accepts a bounded strict source and supplies the graph depth default", () => {
    const result = analyzeProjectRequestSchema.parse(validRequest);

    expect(result.maxDepth).toBe(5);
    expect(result.source.text).toBe(validRequest.source.text);
  });

  it("rejects unknown fields, unsupported source types, and oversized text", () => {
    expect(
      analyzeProjectRequestSchema.safeParse({
        ...validRequest,
        secret: "must not pass through",
      }).success,
    ).toBe(false);
    expect(
      analyzeProjectRequestSchema.safeParse({
        source: { ...validRequest.source, type: "external_connector" },
      }).success,
    ).toBe(false);
    expect(
      analyzeProjectRequestSchema.safeParse({
        source: { ...validRequest.source, text: "x".repeat(12_001) },
      }).success,
    ).toBe(false);
  });

  it("preserves raw evidence while rejecting blank text", () => {
    const rawText = "  First line\r\nSecond line  \r\n";
    const parsed = analyzeProjectRequestSchema.parse({
      source: { ...validRequest.source, text: rawText },
    });

    expect(parsed.source.text).toBe(rawText);
    expect(
      analyzeProjectRequestSchema.safeParse({
        source: { ...validRequest.source, text: " \r\n\t " },
      }).success,
    ).toBe(false);
  });

  it("uses safe validation messages that never echo submitted evidence", () => {
    const privateText = "private evidence ".repeat(1_000);
    const result = analyzeProjectRequestSchema.safeParse({
      source: { ...validRequest.source, text: privateText },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message).join(" ")).not.toContain(
        privateText,
      );
    }
  });
});

describe("normalizeSourceTextForHash", () => {
  it("normalizes Unicode, line endings, surrounding whitespace, and horizontal runs", () => {
    expect(normalizeSourceTextForHash("  Cafe\u0301\t update  \r\n moved\t\t today \r ")).toBe(
      "Café update\nmoved today",
    );
  });

  it("does not lowercase evidence", () => {
    expect(normalizeSourceTextForHash("BLOCKED")).not.toBe(
      normalizeSourceTextForHash("blocked"),
    );
  });
});

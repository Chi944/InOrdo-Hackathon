import { describe, expect, it } from "vitest";

import { analysisProviderLabel } from "@/app/app/analysis-provider-label";

describe("analysisProviderLabel", () => {
  it.each([
    ["openai/gpt-oss-20b", "Vercel AI Gateway · GPT-OSS 20B"],
    ["gpt-5.6-luna", "OpenAI · GPT-5.6"],
    ["gpt-5.6-luna-2026-07-01", "OpenAI · GPT-5.6"],
  ])("maps the persisted model %s to its known provider label", (model, label) => {
    expect(analysisProviderLabel(model)).toBe(label);
  });

  it.each([
    "gpt-5.6-luna-preview",
    "gpt-5.6-luna-2026-02-31",
    "GPT-5.6-luna",
    "gpt-5.6-LUNA",
    "openai/gpt-oss-20b-preview",
    "OpenAI/gpt-oss-20b",
    "openai/GPT-OSS-20b",
  ])("does not attribute a non-allowlisted known-family variant", (model) => {
    expect(analysisProviderLabel(model)).toBe("Recorded model");
  });

  it("shows a bounded safe persisted model identifier", () => {
    expect(analysisProviderLabel("provider/model-safe")).toBe(
      "Recorded model · provider/model-safe",
    );
  });

  it.each([
    "",
    "provider/model\nforged",
    "provider/model\u0000forged",
    "provider/model\u202Eforged",
    "gpt-5.6-luna-\nforged",
    "x".repeat(121),
    "provider/<script>",
  ])("does not render an unsafe or unbounded model identifier", (model) => {
    expect(analysisProviderLabel(model)).toBe("Recorded model");
  });
});

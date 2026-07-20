import { beforeEach, describe, expect, it, vi } from "vitest";

const openAIConstructor = vi.hoisted(() =>
  vi.fn(function TestOnlyOpenAI() {
    return { responses: { parse: vi.fn() } };
  }),
);

vi.mock("openai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("openai")>();
  return { ...actual, default: openAIConstructor };
});

import { createGatewayAnalysisAdapter } from "@/features/analysis/gateway-adapter";

describe("createGatewayAnalysisAdapter", () => {
  beforeEach(() => {
    openAIConstructor.mockClear();
  });

  it("uses only the explicit capped Gateway credential and transport", () => {
    createGatewayAnalysisAdapter(
      "test-only-gateway-key",
      "openai/gpt-oss-20b",
    );

    expect(openAIConstructor).toHaveBeenCalledOnce();
    expect(openAIConstructor).toHaveBeenCalledWith({
      apiKey: "test-only-gateway-key",
      baseURL: "https://ai-gateway.vercel.sh/v1",
      maxRetries: 0,
    });
  });
});

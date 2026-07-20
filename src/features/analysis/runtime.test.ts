import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  createProjectAnalysisService: vi.fn((options: unknown) => options),
  responsesParse: vi.fn().mockRejectedValue(new Error("test-only provider stop")),
  openAIConstructor: vi.fn(function TestOnlyOpenAI() {
    return { responses: { parse: runtimeMocks.responsesParse } };
  }),
}));

vi.mock("openai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("openai")>();
  return { ...actual, default: runtimeMocks.openAIConstructor };
});

vi.mock("@/features/analysis/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/analysis/service")>();
  return {
    ...actual,
    createProjectAnalysisService: runtimeMocks.createProjectAnalysisService,
  };
});

import { createProjectAnalysisRuntime } from "@/features/analysis/runtime";
import { createProjectAnalysisService } from "@/features/analysis/service";
import type { AnalysisPrompt } from "@/features/analysis/prompts";
import { getAnalysisRuntimeEnv } from "@/lib/env/server";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/env/server", () => ({
  getAnalysisRuntimeEnv: vi.fn(),
}));

describe("project analysis runtime", () => {
  const prompt: AnalysisPrompt = {
    instructions: "Treat this test-only source as untrusted evidence.",
    input: JSON.stringify({ source: "test-only source" }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not read model secrets or construct a provider at runtime creation", () => {
    createProjectAnalysisRuntime({} as ServerSupabaseClient);

    expect(getAnalysisRuntimeEnv).not.toHaveBeenCalled();
    expect(runtimeMocks.openAIConstructor).not.toHaveBeenCalled();
  });

  it("constructs only a claimed recording client without a Gateway base URL", () => {
    vi.mocked(getAnalysisRuntimeEnv).mockReturnValue({
      mode: "recording",
      policy: {
        mode: "recording",
        recordingReady: true,
        gatewayReady: false,
        recordingModelName: "gpt-5.6-luna",
        gatewayModelName: "openai/gpt-oss-20b",
      },
      credential: {
        apiKey: "test-only-recording-key",
        model: "gpt-5.6-luna",
      },
    });
    createProjectAnalysisRuntime({} as ServerSupabaseClient);
    const options = vi.mocked(createProjectAnalysisService).mock.calls[0]?.[0];

    expect(runtimeMocks.openAIConstructor).not.toHaveBeenCalled();
    options?.resolveModel({
      providerRoute: "openai_recording",
      modelName: "gpt-5.6-luna",
    });

    expect(runtimeMocks.openAIConstructor).toHaveBeenCalledOnce();
    expect(runtimeMocks.openAIConstructor).toHaveBeenCalledWith({
      apiKey: "test-only-recording-key",
      maxRetries: 0,
    });
  });

  it("constructs only a claimed Gateway client and uses its model for both calls", async () => {
    vi.mocked(getAnalysisRuntimeEnv).mockReturnValue({
      mode: "auto",
      policy: {
        mode: "auto",
        recordingReady: false,
        gatewayReady: true,
        recordingModelName: "gpt-5.6-luna",
        gatewayModelName: "openai/gpt-oss-20b",
      },
      credential: {
        apiKey: "test-only-gateway-key",
        model: "openai/gpt-oss-20b",
        baseURL: "https://ai-gateway.vercel.sh/v1",
      },
    });
    createProjectAnalysisRuntime({} as ServerSupabaseClient);
    const options = vi.mocked(createProjectAnalysisService).mock.calls[0]?.[0];

    expect(runtimeMocks.openAIConstructor).not.toHaveBeenCalled();
    const model = options?.resolveModel({
      providerRoute: "gateway_fallback",
      modelName: "openai/gpt-oss-20b",
    });

    expect(runtimeMocks.openAIConstructor).toHaveBeenCalledOnce();
    expect(runtimeMocks.openAIConstructor).toHaveBeenCalledWith({
      apiKey: "test-only-gateway-key",
      baseURL: "https://ai-gateway.vercel.sh/v1",
      maxRetries: 0,
    });
    await expect(model?.extractChange(prompt)).rejects.toMatchObject({
      code: "provider_failure",
    });
    await expect(model?.draftProposal(prompt)).rejects.toMatchObject({
      code: "provider_failure",
    });
    expect(runtimeMocks.responsesParse).toHaveBeenCalledTimes(2);
    expect(
      runtimeMocks.responsesParse.mock.calls.map(([body]) => body.model),
    ).toEqual(["openai/gpt-oss-20b", "openai/gpt-oss-20b"]);
  });

  it("fails closed without constructing or calling a client for a mismatched claim pair", () => {
    vi.mocked(getAnalysisRuntimeEnv).mockReturnValue({
      mode: "auto",
      policy: {
        mode: "auto",
        recordingReady: false,
        gatewayReady: true,
        recordingModelName: "gpt-5.6-luna",
        gatewayModelName: "openai/gpt-oss-20b",
      },
      credential: {
        apiKey: "test-only-gateway-key",
        model: "openai/gpt-oss-20b",
        baseURL: "https://ai-gateway.vercel.sh/v1",
      },
    });
    createProjectAnalysisRuntime({} as ServerSupabaseClient);
    const options = vi.mocked(createProjectAnalysisService).mock.calls[0]?.[0];

    expect(() =>
      options?.resolveModel({
        providerRoute: "gateway_fallback",
        modelName: "gpt-5.6-luna",
      }),
    ).toThrow(
      expect.objectContaining({ code: "model_unavailable" }),
    );
    expect(runtimeMocks.openAIConstructor).not.toHaveBeenCalled();
    expect(runtimeMocks.responsesParse).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  createProjectAnalysisService: vi.fn((options: unknown) => options),
  openAIConstructor: vi.fn(function TestOnlyOpenAI() {
    return { responses: { parse: vi.fn() } };
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
import { getAnalysisRuntimeEnv } from "@/lib/env/server";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/env/server", () => ({
  getAnalysisRuntimeEnv: vi.fn(),
}));

describe("project analysis runtime", () => {
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
    options?.resolveModel("openai_recording");

    expect(runtimeMocks.openAIConstructor).toHaveBeenCalledOnce();
    expect(runtimeMocks.openAIConstructor).toHaveBeenCalledWith({
      apiKey: "test-only-recording-key",
      maxRetries: 0,
    });
  });

  it("constructs only a claimed Gateway client", () => {
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
    options?.resolveModel("gateway_fallback");

    expect(runtimeMocks.openAIConstructor).toHaveBeenCalledOnce();
    expect(runtimeMocks.openAIConstructor).toHaveBeenCalledWith({
      apiKey: "test-only-gateway-key",
      baseURL: "https://ai-gateway.vercel.sh/v1",
      maxRetries: 0,
    });
  });

  it("fails closed without constructing a client when the claim and mode differ", () => {
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

    expect(() => options?.resolveModel("openai_recording")).toThrow(
      expect.objectContaining({ code: "analysis_disabled" }),
    );
    expect(runtimeMocks.openAIConstructor).not.toHaveBeenCalled();
  });
});

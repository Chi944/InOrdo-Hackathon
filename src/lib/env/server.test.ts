import { describe, expect, it } from "vitest";

import { EnvironmentConfigurationError } from "@/lib/env/public";
import {
  parseAnalysisRuntimeEnv,
  parseDemoResetEnv,
  parseOpenAIEnv,
} from "@/lib/env/server";

describe("analysis runtime environment", () => {
  it("defaults an absent mode to disabled without requiring a credential", () => {
    expect(parseAnalysisRuntimeEnv({})).toEqual({
      mode: "disabled",
      credential: null,
      policy: {
        mode: "disabled",
        recordingReady: false,
        gatewayReady: false,
        recordingModelName: "gpt-5.6-luna",
        gatewayModelName: "openai/gpt-oss-20b",
      },
    });
  });

  it("keeps explicitly disabled analysis credential-free", () => {
    expect(
      parseAnalysisRuntimeEnv({
        ANALYSIS_MODE: "disabled",
        OPENAI_API_KEY: "ignored-test-only-openai-key",
        AI_GATEWAY_API_KEY: "ignored-test-only-gateway-key",
      }),
    ).toEqual({
      mode: "disabled",
      credential: null,
      policy: {
        mode: "disabled",
        recordingReady: false,
        gatewayReady: false,
        recordingModelName: "gpt-5.6-luna",
        gatewayModelName: "openai/gpt-oss-20b",
      },
    });
  });

  it("selects only the exact recording model", () => {
    expect(
      parseAnalysisRuntimeEnv({
        ANALYSIS_MODE: "recording",
        OPENAI_API_KEY: "test-only-openai-key",
      }),
    ).toEqual({
      mode: "recording",
      credential: {
        apiKey: "test-only-openai-key",
        model: "gpt-5.6-luna",
      },
      policy: {
        mode: "recording",
        recordingReady: true,
        gatewayReady: false,
        recordingModelName: "gpt-5.6-luna",
        gatewayModelName: "openai/gpt-oss-20b",
      },
    });
  });

  it.each(["gpt-4.1", "gpt-5.6", "gpt-5.6-luna-fabricated"])(
    "rejects non-allowlisted recording model %s without reflecting it",
    (model) => {
      const result = parseAnalysisRuntimeEnv({
        ANALYSIS_MODE: "recording",
        OPENAI_API_KEY: "test-only-openai-key",
        OPENAI_MODEL: model,
      });

      expect(result).toEqual({
        mode: "recording",
        credential: null,
        policy: {
          mode: "recording",
          recordingReady: false,
          gatewayReady: false,
          recordingModelName: "gpt-5.6-luna",
          gatewayModelName: "openai/gpt-oss-20b",
        },
      });
    },
  );

  it.each([undefined, "", "   ", " padded-test-only-key", "test-only-key "])(
    "keeps recording unavailable for an invalid key: %j",
    (apiKey) => {
      expect(
        parseAnalysisRuntimeEnv({
          ANALYSIS_MODE: "recording",
          OPENAI_API_KEY: apiKey,
        }),
      ).toMatchObject({
        mode: "recording",
        credential: null,
        policy: { mode: "recording", recordingReady: false },
      });
    },
  );

  it("uses only the exact Gateway fallback in auto mode", () => {
    const result = parseAnalysisRuntimeEnv({
      ANALYSIS_MODE: "auto",
      AI_GATEWAY_API_KEY: "test-only-gateway-key",
      AI_GATEWAY_MODEL: "openai/gpt-oss-20b",
      OPENAI_API_KEY: "ignored-test-only-openai-key",
    });

    expect(result).toEqual({
      mode: "auto",
      credential: {
        apiKey: "test-only-gateway-key",
        model: "openai/gpt-oss-20b",
        baseURL: "https://ai-gateway.vercel.sh/v1",
      },
      policy: {
        mode: "auto",
        recordingReady: false,
        gatewayReady: true,
        recordingModelName: "gpt-5.6-luna",
        gatewayModelName: "openai/gpt-oss-20b",
      },
    });
    expect(JSON.stringify(result)).not.toContain(
      "ignored-test-only-openai-key",
    );
  });

  it.each([
    {
      reason: "missing key",
      values: {
        AI_GATEWAY_API_KEY: undefined,
        AI_GATEWAY_MODEL: "openai/gpt-oss-20b",
      },
    },
    {
      reason: "padded key",
      values: {
        AI_GATEWAY_API_KEY: " padded-key",
        AI_GATEWAY_MODEL: "openai/gpt-oss-20b",
      },
    },
    {
      reason: "missing model",
      values: {
        AI_GATEWAY_API_KEY: "test-only-gateway-key",
        AI_GATEWAY_MODEL: undefined,
      },
    },
    {
      reason: "unapproved model",
      values: {
        AI_GATEWAY_API_KEY: "test-only-gateway-key",
        AI_GATEWAY_MODEL: "openai/gpt-oss-120b",
      },
    },
  ] as const)("keeps fallback unavailable for $reason", ({ values }) => {
    const result = parseAnalysisRuntimeEnv({
      ANALYSIS_MODE: "auto",
      ...values,
    });

    expect(result).toMatchObject({
      mode: "auto",
      credential: null,
      policy: { mode: "auto", gatewayReady: false },
    });
    expect(JSON.stringify(result)).not.toContain("openai/gpt-oss-120b");
  });

  it("resolves an invalid mode to disabled without reflecting it", () => {
    const result = parseAnalysisRuntimeEnv({
      ANALYSIS_MODE: "unsupported-secret-like-mode",
      OPENAI_API_KEY: "ignored-test-only-openai-key",
    });

    expect(result).toMatchObject({
      mode: "disabled",
      credential: null,
      policy: { mode: "disabled" },
    });
    expect(JSON.stringify(result)).not.toContain("unsupported-secret-like-mode");
    expect(JSON.stringify(result)).not.toContain(
      "ignored-test-only-openai-key",
    );
  });
});

describe("OpenAI environment validation", () => {
  it("uses the Prompt 7 model default without requiring unrelated secrets", () => {
    expect(parseOpenAIEnv({ OPENAI_API_KEY: "test-only-key" })).toEqual({
      OPENAI_API_KEY: "test-only-key",
      OPENAI_MODEL: "gpt-5.6-luna",
    });
  });

  it("preserves an explicit model override", () => {
    expect(
      parseOpenAIEnv({
        OPENAI_API_KEY: "test-only-key",
        OPENAI_MODEL: "gpt-5.6-luna-2026-06-01",
      }),
    ).toEqual({
      OPENAI_API_KEY: "test-only-key",
      OPENAI_MODEL: "gpt-5.6-luna-2026-06-01",
    });
  });

  it("rejects a whitespace-only model override", () => {
    expect(() =>
      parseOpenAIEnv({
        OPENAI_API_KEY: "test-only-key",
        OPENAI_MODEL: "   ",
      }),
    ).toThrow("OPENAI_MODEL");
  });

  it("reports only the missing variable name", () => {
    expect(() => parseOpenAIEnv({ OPENAI_API_KEY: "" })).toThrow(
      EnvironmentConfigurationError,
    );
    expect(() => parseOpenAIEnv({ OPENAI_API_KEY: "" })).toThrow(
      "OPENAI_API_KEY",
    );
  });

  it.each(["   ", "\t", " test-only-key", "test-only-key "])(
    "rejects a blank or padded OpenAI key",
    (key) => {
      expect(() => parseOpenAIEnv({ OPENAI_API_KEY: key })).toThrow(
        "OPENAI_API_KEY",
      );
    },
  );
});

describe("demo reset environment validation", () => {
  it("requires the named demo project and a non-empty server-only secret", () => {
    expect(
      parseDemoResetEnv({
        DEMO_PROJECT_SLUG: "inordo-build-week-demo",
        DEMO_RESET_SECRET: "test-only-reset-value",
      }),
    ).toEqual({
      DEMO_PROJECT_SLUG: "inordo-build-week-demo",
      DEMO_RESET_SECRET: "test-only-reset-value",
    });
    expect(() =>
      parseDemoResetEnv({
        DEMO_PROJECT_SLUG: "inordo-build-week-demo",
        DEMO_RESET_SECRET: "",
      }),
    ).toThrow("DEMO_RESET_SECRET");
  });

  it.each([
    ["DEMO_PROJECT_SLUG", "   "],
    ["DEMO_PROJECT_SLUG", " inordo-build-week-demo"],
    ["DEMO_RESET_SECRET", "\t"],
    ["DEMO_RESET_SECRET", "test-only-reset-value "],
  ] as const)("rejects an invalid %s value", (name, value) => {
    expect(() =>
      parseDemoResetEnv({
        DEMO_PROJECT_SLUG: "inordo-build-week-demo",
        DEMO_RESET_SECRET: "test-only-reset-value",
        [name]: value,
      }),
    ).toThrow(name);
  });
});

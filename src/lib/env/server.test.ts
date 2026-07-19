import { describe, expect, it } from "vitest";

import { EnvironmentConfigurationError } from "@/lib/env/public";
import { parseDemoResetEnv, parseOpenAIEnv } from "@/lib/env/server";

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

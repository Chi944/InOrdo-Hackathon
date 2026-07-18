import { describe, expect, it } from "vitest";

import { EnvironmentConfigurationError } from "@/lib/env/public";
import { parseOpenAIEnv } from "@/lib/env/server";

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

  it("reports only the missing variable name", () => {
    expect(() => parseOpenAIEnv({ OPENAI_API_KEY: "" })).toThrow(
      EnvironmentConfigurationError,
    );
    expect(() => parseOpenAIEnv({ OPENAI_API_KEY: "" })).toThrow(
      "OPENAI_API_KEY",
    );
  });
});

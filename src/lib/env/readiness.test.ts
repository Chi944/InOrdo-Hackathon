import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  evaluateDeploymentReadiness,
  readinessVariableNames,
} from "@/lib/env/readiness";

const validEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-only-public-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-only-service-role-key",
  OPENAI_API_KEY: "test-only-openai-key",
  OPENAI_MODEL: "gpt-5.6-luna",
  DEMO_PROJECT_SLUG: "test-only-demo",
  DEMO_RESET_SECRET: "test-only-reset-secret",
};

describe("deployment readiness", () => {
  it("keeps the documented environment-name contract in sync", () => {
    const documentedNames = readFileSync(
      resolve(process.cwd(), ".env.example"),
      "utf8",
    )
      .split(/\r?\n/)
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
      .map((line) => line.split("=", 1)[0]);

    expect(documentedNames).toEqual(readinessVariableNames);
  });

  it("reports ready when every required setting is valid", () => {
    expect(evaluateDeploymentReadiness(validEnvironment)).toEqual({
      status: "ready",
      invalidVariables: [],
    });
  });

  it("uses the runtime model default when OPENAI_MODEL is omitted", () => {
    const environmentWithoutModel: Partial<typeof validEnvironment> = {
      ...validEnvironment,
    };
    delete environmentWithoutModel.OPENAI_MODEL;

    expect(evaluateDeploymentReadiness(environmentWithoutModel)).toEqual({
      status: "ready",
      invalidVariables: [],
    });
  });

  it("rejects a whitespace-only model exactly as the runtime does", () => {
    expect(
      evaluateDeploymentReadiness({
        ...validEnvironment,
        OPENAI_MODEL: "   ",
      }),
    ).toEqual({
      status: "not_ready",
      invalidVariables: ["OPENAI_MODEL"],
    });
  });

  it.each([
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
    "DEMO_PROJECT_SLUG",
    "DEMO_RESET_SECRET",
  ] as const)("rejects a whitespace-only %s", (name) => {
    expect(
      evaluateDeploymentReadiness({
        ...validEnvironment,
        [name]: "   ",
      }),
    ).toEqual({
      status: "not_ready",
      invalidVariables: [name],
    });
  });

  it.each([
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
    "DEMO_PROJECT_SLUG",
    "DEMO_RESET_SECRET",
  ] as const)("rejects surrounding whitespace in %s", (name) => {
    expect(
      evaluateDeploymentReadiness({
        ...validEnvironment,
        [name]: ` ${validEnvironment[name]} `,
      }),
    ).toEqual({
      status: "not_ready",
      invalidVariables: [name],
    });
  });

  it.each([
    "ftp://example.supabase.co",
    "javascript:alert(1)",
    "http://example.supabase.co",
    "https://username@example.supabase.co",
    "https://username:password@example.supabase.co",
    " https://example.supabase.co",
  ])("rejects an unsafe or padded Supabase URL: %s", (url) => {
    expect(
      evaluateDeploymentReadiness({
        ...validEnvironment,
        NEXT_PUBLIC_SUPABASE_URL: url,
      }),
    ).toEqual({
      status: "not_ready",
      invalidVariables: ["NEXT_PUBLIC_SUPABASE_URL"],
    });
  });

  it("reports only allowlisted variable names when settings are missing or invalid", () => {
    const sensitiveValue = "must-never-appear-in-readiness-output";
    const result = evaluateDeploymentReadiness({
      ...validEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: "not-a-valid-url",
      SUPABASE_SERVICE_ROLE_KEY: sensitiveValue,
      OPENAI_API_KEY: "",
    });

    expect(result).toEqual({
      status: "not_ready",
      invalidVariables: ["NEXT_PUBLIC_SUPABASE_URL", "OPENAI_API_KEY"],
    });
    expect(JSON.stringify(result)).not.toContain(sensitiveValue);
    expect(JSON.stringify(result)).not.toContain("not-a-valid-url");
  });
});

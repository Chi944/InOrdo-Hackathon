import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GET,
  dynamic,
  maxDuration,
  runtime,
} from "@/app/api/health/route";

const validEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-only-public-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-only-service-role-key",
  OPENAI_API_KEY: "test-only-openai-key",
  OPENAI_MODEL: "gpt-5.6-luna",
  DEMO_PROJECT_SLUG: "test-only-demo",
  DEMO_RESET_SECRET: "test-only-reset-secret",
  ANALYSIS_MODE: "disabled",
  AI_GATEWAY_API_KEY: "",
  AI_GATEWAY_MODEL: "openai/gpt-oss-20b",
};

function stubEnvironment(
  overrides: Partial<typeof validEnvironment> = {},
): void {
  for (const [name, value] of Object.entries({
    ...validEnvironment,
    ...overrides,
  })) {
    vi.stubEnv(name, value);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("GET /api/health", () => {
  it("uses the Node runtime", () => {
    expect(runtime).toBe("nodejs");
    expect(maxDuration).toBe(10);
  });

  it("prevents a build from caching deployment readiness", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("returns a non-cacheable ready response without making external calls", async () => {
    stubEnvironment();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      status: "ready",
      checks: { configuration: "ready", analysis: "disabled" },
    });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it.each([
    [
      {
        ANALYSIS_MODE: "recording",
        OPENAI_API_KEY: "test-only-openai-key",
        OPENAI_MODEL: "gpt-5.6-luna",
      },
      "recording_configured",
    ],
    [
      {
        ANALYSIS_MODE: "recording",
        OPENAI_API_KEY: "",
        OPENAI_MODEL: "gpt-5.6-luna",
      },
      "recording_unavailable",
    ],
    [
      {
        ANALYSIS_MODE: "auto",
        AI_GATEWAY_API_KEY: "test-only-gateway-key",
        AI_GATEWAY_MODEL: "openai/gpt-oss-20b",
      },
      "fallback_configured",
    ],
    [
      {
        ANALYSIS_MODE: "auto",
        AI_GATEWAY_API_KEY: "",
        AI_GATEWAY_MODEL: "openai/gpt-oss-20b",
      },
      "fallback_unavailable",
    ],
    [{ ANALYSIS_MODE: "disabled" }, "disabled"],
  ] as const)(
    "reports capability status %s without making an external call",
    async (overrides, expectedStatus) => {
      stubEnvironment(overrides);
      const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await GET();

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        status: "ready",
        checks: {
          configuration: "ready",
          analysis: expectedStatus,
        },
      });
      expect(errorLog).not.toHaveBeenCalled();
    },
  );

  it("keeps navigation ready when the selected AI credential is absent", async () => {
    stubEnvironment({
      ANALYSIS_MODE: "recording",
      OPENAI_API_KEY: "",
    });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ready",
      checks: {
        configuration: "ready",
        analysis: "recording_unavailable",
      },
    });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("returns a generic 503 and logs only missing setting names", async () => {
    const sensitiveValue = "must-never-appear-in-health-output";
    stubEnvironment({
      SUPABASE_SERVICE_ROLE_KEY: sensitiveValue,
      DEMO_RESET_SECRET: "",
    });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();
    const responseText = await response.text();
    const logText = JSON.stringify(errorLog.mock.calls);

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(JSON.parse(responseText)).toEqual({
      status: "not_ready",
      checks: { configuration: "not_ready" },
      message: "Service configuration is incomplete.",
    });
    expect(responseText).not.toContain("DEMO_RESET_SECRET");
    expect(responseText).not.toContain(sensitiveValue);
    expect(errorLog).toHaveBeenCalledOnce();
    expect(logText).toContain("DEMO_RESET_SECRET");
    expect(logText).not.toContain(sensitiveValue);
    expect(logText).not.toContain("Error:");
  });
});

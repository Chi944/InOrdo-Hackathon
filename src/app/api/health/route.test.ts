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
      checks: { configuration: "ready" },
    });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("returns a generic 503 and logs only missing setting names", async () => {
    const sensitiveValue = "must-never-appear-in-health-output";
    stubEnvironment({
      SUPABASE_SERVICE_ROLE_KEY: sensitiveValue,
      OPENAI_API_KEY: "",
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
    expect(responseText).not.toContain("OPENAI_API_KEY");
    expect(responseText).not.toContain(sensitiveValue);
    expect(errorLog).toHaveBeenCalledOnce();
    expect(logText).toContain("OPENAI_API_KEY");
    expect(logText).not.toContain(sensitiveValue);
    expect(logText).not.toContain("Error:");
  });
});

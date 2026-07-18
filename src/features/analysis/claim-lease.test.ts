import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { maxDuration } from "@/app/api/projects/[projectId]/analyze/route";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260719113000_expire_stale_analysis_claims.sql",
);

describe("analysis claim lease release contract", () => {
  it("expires only after a margin beyond the route runtime and fails closed", () => {
    const migration = readFileSync(migrationPath, "utf8");
    const leaseMatch = migration.match(/interval '(\d+) minutes'/);
    const leaseSeconds = Number(leaseMatch?.[1]) * 60;

    expect(maxDuration).toBe(90);
    expect(leaseSeconds).toBeGreaterThanOrEqual(maxDuration * 2);
    expect(migration).toContain("for update of request");
    expect(migration).toContain(
      "disable trigger analysis_requests_guard_transition",
    );
    expect(migration).toContain(
      "enable trigger analysis_requests_guard_transition",
    );
    expect(migration).toContain("'failed'::public.analysis_request_state");
    expect(migration).toContain("failure_stage = 'persistence'");
    expect(migration).toContain("failure_code = 'analysis_cancelled'");
    expect(migration).toContain("new.state = 'succeeded'");
    expect(migration).toContain("analysis claim lease expired");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const routeBudgets = [
  {
    path: "src/app/api/health/route.ts",
    seconds: 10,
  },
  {
    path: "src/app/api/projects/[projectId]/analyze/route.ts",
    seconds: 90,
  },
  {
    path: "src/app/api/projects/[projectId]/proposals/[proposalId]/apply/route.ts",
    seconds: 30,
  },
  {
    path: "src/app/api/projects/[projectId]/operations/route.ts",
    seconds: 30,
  },
  {
    path: "src/app/api/projects/[projectId]/operations/[operationId]/undo/route.ts",
    seconds: 30,
  },
  {
    path: "src/app/api/projects/[projectId]/demo/reset/route.ts",
    seconds: 30,
  },
] as const;

describe("production route runtime configuration", () => {
  it.each(routeBudgets)(
    "keeps $path on bounded Node.js compute",
    ({ path, seconds }) => {
      const source = readFileSync(resolve(process.cwd(), path), "utf8");

      expect(source).toContain('export const runtime = "nodejs";');
      expect(source).toContain(`export const maxDuration = ${seconds};`);
    },
  );

  it("keeps the two-call analysis budget below its platform duration", () => {
    const adapter = readFileSync(
      resolve(process.cwd(), "src/features/analysis/openai-adapter.ts"),
      "utf8",
    );

    expect(adapter).toContain("const DEFAULT_TIMEOUT_MS = 30_000;");
    expect(adapter).toContain("maxRetries: 0;");
    expect(2 * 30).toBeLessThan(90);
  });

  it("keeps Fluid Compute explicit in the repository deployment config", () => {
    const vercelConfig = JSON.parse(
      readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"),
    ) as unknown;

    expect(vercelConfig).toMatchObject({ fluid: true });
  });

  it("keeps local Supabase Auth redirects on the documented HTTP origins", () => {
    const supabaseConfig = readFileSync(
      resolve(process.cwd(), "supabase/config.toml"),
      "utf8",
    );

    expect(supabaseConfig).toContain('site_url = "http://localhost:3000"');
    expect(supabaseConfig).toContain(
      'additional_redirect_urls = ["http://localhost:3000/**", "http://127.0.0.1:3000/**"]',
    );
    expect(supabaseConfig).not.toContain("https://127.0.0.1");
  });

  it("keeps deployment and migration-aware rollback instructions fail closed", () => {
    const runbook = readFileSync(
      resolve(process.cwd(), "docs/deployment-runbook.md"),
      "utf8",
    );
    const revertPlanner = readFileSync(
      resolve(process.cwd(), "scripts/revert-plan.mjs"),
      "utf8",
    );

    expect(runbook.match(/set -euo pipefail/g)?.length).toBeGreaterThanOrEqual(5);
    expect(runbook).toContain(
      'test "$(git rev-parse --verify origin/main)" = "$RELEASE_SHA"',
    );
    expect(runbook).toContain('test "$DIVERGENCE" = "0 0"');
    expect(runbook).toContain('APPLIED_MIGRATION_PATHS="$(');
    expect(runbook).toContain(
      "npx --no-install supabase --output-format json migration list --linked",
    );
    expect(runbook).not.toContain("migration list --linked --output json");
    expect(runbook).toContain("node scripts/applied-migration-paths.mjs");
    expect(runbook).toContain('REVERT_MAINLINE=""');
    expect(runbook).toContain(
      'node scripts/revert-plan.mjs "$FAULTY_COMMIT_SHA" "$REVERT_MAINLINE"',
    );
    expect(runbook).toContain(
      "IFS=$'\\t' read -r \\",
    );
    expect(runbook).toContain(
      'FAULTY_COMMIT_SHA FAULTY_DIFF_BASE RESOLVED_MAINLINE <<< "$REVERT_PLAN"',
    );
    expect(revertPlanner).toContain(
      '["merge-base", "--is-ancestor", commit, "HEAD"]',
    );
    expect(runbook).not.toContain("REVERT_OPTIONS");
    expect(runbook).toContain(
      'git diff --name-only "$FAULTY_DIFF_BASE" "$FAULTY_COMMIT_SHA"',
    );
    expect(runbook).not.toContain("git diff-tree -m");
    expect(runbook).toContain(
      'git revert --no-edit "$FAULTY_COMMIT_SHA"',
    );
    expect(runbook).toContain(
      'git revert --no-edit -m "$RESOLVED_MAINLINE" "$FAULTY_COMMIT_SHA"',
    );
    expect(runbook).toContain(
      'git revert --no-commit "$FAULTY_COMMIT_SHA"',
    );
    expect(runbook).toContain(
      'git revert --no-commit -m "$RESOLVED_MAINLINE" "$FAULTY_COMMIT_SHA"',
    );
    expect(runbook).toContain("git diff --cached --check");
    expect(runbook).toContain(
      "git restore --source=HEAD --staged --worktree -- supabase/migrations",
    );
  });
});

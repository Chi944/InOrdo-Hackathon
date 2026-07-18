import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const guardPath = resolve(
  process.cwd(),
  "scripts/applied-migration-paths.mjs",
);
const supabasePackagePath = resolve(
  process.cwd(),
  "node_modules/supabase/package.json",
);
const supabaseCliPath = resolve(
  process.cwd(),
  "node_modules/supabase/dist/supabase.js",
);

function runGuardJson(ledgerJson: string, targetPaths: readonly string[]) {
  const environment: NodeJS.ProcessEnv = {
    LEDGER_JSON: ledgerJson,
    NODE_ENV: "test",
    TARGET_MIGRATION_PATHS: targetPaths.join("\n"),
  };
  if (process.env.SystemRoot) environment.SystemRoot = process.env.SystemRoot;

  return spawnSync(process.execPath, [guardPath], {
    encoding: "utf8",
    env: environment,
  });
}

function runGuard(ledger: unknown, targetPaths: readonly string[]) {
  return runGuardJson(JSON.stringify(ledger), targetPaths);
}

describe("applied migration release guard", () => {
  it("pins a CLI whose migration list exposes the JSON output-format contract", () => {
    const packageMetadata = JSON.parse(
      readFileSync(supabasePackagePath, "utf8"),
    ) as { version?: unknown };
    const help = spawnSync(
      process.execPath,
      [supabaseCliPath, "migration", "list", "--help"],
      { encoding: "utf8" },
    );

    expect(packageMetadata.version).toBe("2.109.1");
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("--output-format choice");
    expect(help.stdout).toContain("text (default), json, or stream-json");
  });

  it("prints only target migrations recorded as applied remotely", () => {
    const appliedPath =
      "supabase/migrations/20260719101500_allow_legacy_provider_model_metadata.sql";
    const localOnlyPath =
      "supabase/migrations/20260719103000_unapplied_repair.sql";
    const result = runGuard(
      {
        migrations: [
          {
            local: "20260719101500",
            remote: "20260719101500",
            time: "2026-07-19 10:15:00",
          },
          {
            local: "20260719103000",
            remote: "",
            time: "2026-07-19 10:30:00",
          },
        ],
        message: "Migrations listed",
      },
      [appliedPath, localOnlyPath],
    );

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(appliedPath);
    expect(result.stderr).toBe("");
  });

  it.each([
    { ledger: {}, label: "envelope" },
    {
      ledger: {
        migrations: [{ local: "20260719101500" }],
        message: "Migrations listed",
      },
      label: "row",
    },
    {
      ledger: {
        migrations: [
          {
            local: "20260719101500",
            remote: "20260719101500 ",
            time: "2026-07-19 10:15:00",
          },
        ],
        message: "Migrations listed",
      },
      label: "remote version",
    },
  ])("fails closed for an unexpected ledger $label", ({ ledger }) => {
    const result = runGuard(ledger, []);

    expect(result.status).toBe(4);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Unexpected Supabase migration ledger");
  });

  it("fails closed for an unversioned target migration path", () => {
    const result = runGuard(
      { migrations: [], message: "Migrations listed" },
      ["supabase/migrations/not-versioned.sql"],
    );

    expect(result.status).toBe(3);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Unversioned migration path");
  });

  it("fails closed when the ledger is not valid JSON", () => {
    const result = runGuardJson("{", []);

    expect(result.status).toBe(4);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("ledger was not valid JSON");
  });
});

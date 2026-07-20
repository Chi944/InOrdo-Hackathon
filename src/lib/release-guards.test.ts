import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const guardPath = resolve(
  process.cwd(),
  "scripts/applied-migration-paths.mjs",
);
const parityGuardPath = resolve(
  process.cwd(),
  "scripts/verify-migration-parity.mjs",
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

function runParityGuardJson(ledgerJson: string, expectedTail: string) {
  const environment: NodeJS.ProcessEnv = {
    EXPECTED_MIGRATION_TAIL: expectedTail,
    LEDGER_JSON: ledgerJson,
    NODE_ENV: "test",
  };
  if (process.env.SystemRoot) environment.SystemRoot = process.env.SystemRoot;

  return spawnSync(process.execPath, [parityGuardPath], {
    encoding: "utf8",
    env: environment,
  });
}

function runParityGuard(ledger: unknown, expectedTail: string) {
  return runParityGuardJson(JSON.stringify(ledger), expectedTail);
}

describe("applied migration release guard", () => {
  it(
    "pins a CLI whose migration list exposes the JSON output-format contract",
    () => {
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
    },
    15_000,
  );

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

describe("linked migration parity release guard", () => {
  const alignedLedger = {
    migrations: [
      {
        local: "20260719130000",
        remote: "20260719130000",
        time: "2026-07-19 13:00:00",
      },
      {
        local: "20260719140000",
        remote: "20260719140000",
        time: "2026-07-19 14:00:00",
      },
    ],
    message: "Migrations listed",
  };

  it("confirms an aligned ledger whose final row is the expected tail", () => {
    const result = runParityGuard(alignedLedger, "20260719140000");

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("Supabase migration parity verified.\n");
    expect(result.stderr).toBe("");
  });

  it.each([
    { ledgerJson: "{", label: "invalid JSON" },
    {
      ledgerJson: JSON.stringify({ ...alignedLedger, unexpected: true }),
      label: "unexpected envelope",
    },
    {
      ledgerJson: JSON.stringify({
        ...alignedLedger,
        migrations: [
          {
            local: "20260719140000",
            remote: "20260719140000",
            time: "2026-07-19 14:00:00",
            unexpected: true,
          },
        ],
      }),
      label: "unexpected row",
    },
  ])("fails closed for $label", ({ ledgerJson }) => {
    const result = runParityGuardJson(ledgerJson, "20260719140000");

    expect(result.status).toBe(4);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Unexpected Supabase migration ledger");
  });

  it("fails closed when any local and remote migration differ", () => {
    const result = runParityGuard(
      {
        ...alignedLedger,
        migrations: [
          alignedLedger.migrations[0],
          {
            local: "20260719140000",
            remote: "",
            time: "2026-07-19 14:00:00",
          },
        ],
      },
      "20260719140000",
    );

    expect(result.status).toBe(5);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("Supabase migration ledger is not aligned.\n");
  });

  it("rejects a duplicate aligned version before trusting the final row", () => {
    const result = runParityGuard(
      {
        ...alignedLedger,
        migrations: [
          alignedLedger.migrations[0],
          {
            ...alignedLedger.migrations[0],
            time: "2026-07-19 13:00:01",
          },
          alignedLedger.migrations[1],
        ],
      },
      "20260719140000",
    );

    expect(result.status).toBe(4);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      "Unexpected Supabase migration ledger order.\n",
    );
  });

  it("fails closed when the expected tail is aligned but stale", () => {
    const result = runParityGuard(alignedLedger, "20260719130000");

    expect(result.status).toBe(6);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      "Expected migration tail is not the final aligned migration.\n",
    );
  });

  it("rejects an expected tail that is not exactly fourteen digits", () => {
    const result = runParityGuard(alignedLedger, "20260719140000 ");

    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      "Expected migration tail must be exactly 14 digits.\n",
    );
  });

  it("rejects ledgers beyond the bounded row limit", () => {
    const migration = alignedLedger.migrations[0];
    const result = runParityGuard(
      {
        migrations: Array.from({ length: 1_001 }, () => migration),
        message: "Migrations listed",
      },
      migration.local,
    );

    expect(result.status).toBe(4);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      "Unexpected Supabase migration ledger size.\n",
    );
  });
});

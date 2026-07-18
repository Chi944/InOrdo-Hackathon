function fail(message, exitCode) {
  process.stderr.write(`${message}\n`);
  process.exit(exitCode);
}

let ledger;
try {
  ledger = JSON.parse(process.env.LEDGER_JSON || "{}");
} catch {
  fail("Supabase migration ledger was not valid JSON.", 4);
}

if (
  ledger === null ||
  typeof ledger !== "object" ||
  Array.isArray(ledger) ||
  Object.keys(ledger).sort().join(",") !== "message,migrations" ||
  !Array.isArray(ledger.migrations) ||
  ledger.message !== "Migrations listed"
) {
  fail("Unexpected Supabase migration ledger envelope.", 4);
}

for (const entry of ledger.migrations) {
  if (
    entry === null ||
    typeof entry !== "object" ||
    Array.isArray(entry) ||
    Object.keys(entry).sort().join(",") !== "local,remote,time" ||
    typeof entry.local !== "string" ||
    typeof entry.remote !== "string" ||
    typeof entry.time !== "string" ||
    (entry.local !== "" && !/^\d{14}$/.test(entry.local)) ||
    (entry.remote !== "" && !/^\d{14}$/.test(entry.remote)) ||
    (entry.local === "" && entry.remote === "") ||
    !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(entry.time)
  ) {
    fail("Unexpected Supabase migration ledger row.", 4);
  }
}

const appliedVersions = new Set(
  ledger.migrations.map((entry) => entry.remote).filter(Boolean),
);
const targetPaths = (process.env.TARGET_MIGRATION_PATHS || "")
  .split(/\r?\n/)
  .filter(Boolean);
const appliedPaths = [];

for (const path of targetPaths) {
  const match = path.match(/^supabase\/migrations\/(\d{14})_/);
  if (!match) {
    fail(`Unversioned migration path: ${path}`, 3);
  }
  if (appliedVersions.has(match[1])) appliedPaths.push(path);
}

if (appliedPaths.length > 0) {
  process.stdout.write(`${appliedPaths.join("\n")}\n`);
}

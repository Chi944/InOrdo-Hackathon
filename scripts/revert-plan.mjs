import { spawnSync } from "node:child_process";

function fail(message) {
  process.stderr.write(`STOP: ${message}\n`);
  process.exit(5);
}

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0 || result.error) {
    fail("the target commit or its selected parent could not be resolved.");
  }
  return result.stdout.trim();
}

function assertCurrentHistoryAncestor(commit) {
  const result = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", commit, "HEAD"],
    { encoding: "utf8" },
  );
  if (result.status !== 0 || result.error) {
    fail("the target commit is not an ancestor of the synchronized main branch.");
  }
}

const inputs = process.argv.slice(2);
if (inputs.length < 1 || inputs.length > 2 || inputs[0].trim().length === 0) {
  fail("provide one commit and an optional merge mainline.");
}

const requestedCommit = inputs[0];
const requestedMainline = inputs[1] ?? "";
const commit = git(["rev-parse", "--verify", `${requestedCommit}^{commit}`]);
assertCurrentHistoryAncestor(commit);
const commitAndParents = git(["rev-list", "--parents", "-n", "1", commit]).split(
  " ",
);

if (commitAndParents[0] !== commit) {
  fail("the resolved commit did not match its parent record.");
}

const parents = commitAndParents.slice(1);
let diffBase;
let mainline = "none";

if (parents.length === 1) {
  if (requestedMainline !== "") {
    fail("an ordinary commit must not specify a merge mainline.");
  }
  diffBase = parents[0];
} else if (parents.length === 2) {
  if (requestedMainline !== "1" && requestedMainline !== "2") {
    fail("a two-parent merge requires an explicitly reviewed mainline of 1 or 2.");
  }
  mainline = requestedMainline;
  diffBase = parents[Number(mainline) - 1];
} else {
  fail("root and octopus-merge reverts require a separate reviewed plan.");
}

const resolvedDiffBase = git(["rev-parse", "--verify", `${diffBase}^{commit}`]);
if (resolvedDiffBase !== diffBase) {
  fail("the selected parent did not resolve exactly.");
}

process.stdout.write(`${commit}\t${diffBase}\t${mainline}\n`);

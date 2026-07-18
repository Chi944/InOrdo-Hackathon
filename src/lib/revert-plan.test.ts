import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const plannerPath = resolve(process.cwd(), "scripts/revert-plan.mjs");

type GitFixture = {
  directory: string;
  root: string;
  ordinary: string;
  merge: string;
  mergeParents: readonly [string, string];
  octopus: string;
  disconnected: string;
};

function runGit(directory: string, args: readonly string[]): string {
  const result = spawnSync("git", args, {
    cwd: directory,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Fixture Git command failed: git ${args.join(" ")}`);
  }
  return result.stdout.trim();
}

function commitFile(directory: string, path: string, contents: string, message: string) {
  writeFileSync(join(directory, path), contents, "utf8");
  runGit(directory, ["add", "--", path]);
  runGit(directory, ["commit", "-m", message]);
  return runGit(directory, ["rev-parse", "HEAD"]);
}

function createGitFixture(): GitFixture {
  const directory = mkdtempSync(join(tmpdir(), "inordo-revert-plan-"));
  runGit(directory, ["init", "-b", "main"]);
  runGit(directory, ["config", "user.email", "release-test@inordo.invalid"]);
  runGit(directory, ["config", "user.name", "InOrdo Release Test"]);

  const root = commitFile(directory, "root.txt", "root\n", "root");
  const ordinary = commitFile(
    directory,
    "ordinary.txt",
    "ordinary\n",
    "ordinary",
  );

  runGit(directory, ["switch", "-c", "feature"]);
  const feature = commitFile(directory, "feature.txt", "feature\n", "feature");
  runGit(directory, ["switch", "main"]);
  const mainParent = commitFile(directory, "main.txt", "main\n", "main");
  runGit(directory, ["merge", "--no-ff", "feature", "-m", "merge feature"]);
  const merge = runGit(directory, ["rev-parse", "HEAD"]);

  runGit(directory, ["switch", "-c", "octopus-a"]);
  commitFile(directory, "octopus-a.txt", "a\n", "octopus a");
  runGit(directory, ["switch", "main"]);
  runGit(directory, ["switch", "-c", "octopus-b"]);
  commitFile(directory, "octopus-b.txt", "b\n", "octopus b");
  runGit(directory, ["switch", "main"]);
  runGit(directory, [
    "merge",
    "--no-ff",
    "octopus-a",
    "octopus-b",
    "-m",
    "octopus merge",
  ]);
  const octopus = runGit(directory, ["rev-parse", "HEAD"]);
  const currentTree = runGit(directory, ["rev-parse", "HEAD^{tree}"]);
  const disconnectedRoot = runGit(directory, [
    "commit-tree",
    currentTree,
    "-m",
    "disconnected root",
  ]);
  const disconnected = runGit(directory, [
    "commit-tree",
    currentTree,
    "-p",
    disconnectedRoot,
    "-m",
    "disconnected ordinary",
  ]);

  return {
    directory,
    root,
    ordinary,
    merge,
    mergeParents: [mainParent, feature],
    octopus,
    disconnected,
  };
}

function runPlanner(fixture: GitFixture, commit: string, mainline = "") {
  const environment: NodeJS.ProcessEnv = { NODE_ENV: "test" };
  if (process.env.PATH) environment.PATH = process.env.PATH;
  if (process.env.SystemRoot) environment.SystemRoot = process.env.SystemRoot;

  return spawnSync(process.execPath, [plannerPath, commit, mainline], {
    cwd: fixture.directory,
    encoding: "utf8",
    env: environment,
  });
}

function parsePlan(output: string) {
  const [commit, diffBase, mainline] = output.trimEnd().split("\t");
  return { commit, diffBase, mainline };
}

describe("Git revert planner", () => {
  let fixture: GitFixture;

  beforeAll(() => {
    fixture = createGitFixture();
  }, 30_000);

  afterAll(() => {
    const expectedPrefix = resolve(tmpdir(), "inordo-revert-plan-");
    const target = resolve(fixture.directory);
    if (!target.startsWith(expectedPrefix)) {
      throw new Error("Refusing to remove an unexpected test directory.");
    }
    rmSync(target, { recursive: true, force: true });
  }, 30_000);

  it("plans an ordinary commit without a mainline", () => {
    const result = runPlanner(fixture, fixture.ordinary);

    expect(result.status).toBe(0);
    expect(parsePlan(result.stdout)).toEqual({
      commit: fixture.ordinary,
      diffBase: fixture.root,
      mainline: "none",
    });
    expect(result.stderr).toBe("");
  });

  it.each([
    ["1", 0],
    ["2", 1],
  ] as const)("plans a two-parent merge against mainline %s", (mainline, index) => {
    const result = runPlanner(fixture, fixture.merge, mainline);

    expect(result.status).toBe(0);
    expect(parsePlan(result.stdout)).toEqual({
      commit: fixture.merge,
      diffBase: fixture.mergeParents[index],
      mainline,
    });
    expect(result.stderr).toBe("");
  });

  it.each([
    ["ordinary commit with a mainline", () => runPlanner(fixture, fixture.ordinary, "1")],
    ["merge without a mainline", () => runPlanner(fixture, fixture.merge)],
    ["root commit", () => runPlanner(fixture, fixture.root)],
    ["octopus merge", () => runPlanner(fixture, fixture.octopus)],
    [
      "commit outside the current main history",
      () => runPlanner(fixture, fixture.disconnected),
    ],
  ])("fails closed for $0", (_label, execute) => {
    const result = execute();

    expect(result.status).toBe(5);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("STOP:");
  });
});

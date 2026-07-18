import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryPath = resolve(
  process.cwd(),
  "src/lib/repositories/project-data.ts",
);
const repositorySource = readFileSync(repositoryPath, "utf8");

describe("project data repository boundaries", () => {
  it("keeps every required read in a server-only repository", () => {
    expect(repositorySource).toMatch(/^import "server-only";/);

    for (const functionName of [
      "getDemoWorkspaceProject",
      "getProjectOverview",
      "listProjectItems",
      "getItemAndDependencies",
      "listSourceUpdates",
      "listImpactRunsAndProposals",
      "listOperations",
    ]) {
      expect(repositorySource).toContain(
        `export async function ${functionName}`,
      );
    }
  });

  it("uses explicit selectors and bounded collection queries", () => {
    expect(repositorySource).not.toMatch(/\.select\(\s*["'`]\s*\*/);
    expect(repositorySource).toContain("function pagination(");
    expect(repositorySource).toContain(".range(page.offset, page.end)");
    expect(repositorySource).toContain(".limit(2)");
    expect(repositorySource).toContain(".limit(limit)");
  });

  it("defaults canonical views to active demo records and the current workflow generation", () => {
    expect(repositorySource).toContain("async function getCurrentWorkflowGeneration(");
    expect(repositorySource).toContain('.eq("is_demo_retired", false)');
    expect(repositorySource).toContain('.eq("workflow_generation", generation)');
  });
});

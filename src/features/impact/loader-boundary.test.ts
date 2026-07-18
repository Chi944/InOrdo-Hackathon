import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/features/impact/loader.ts"),
  "utf8",
);

describe("graph database loader boundary", () => {
  it("is server-only, uses explicit fields, and scopes both tables", () => {
    expect(source).toMatch(/^import "server-only";/);
    expect(source).not.toMatch(/\.select\(\s*["'`]\s*\*/);
    expect(source.match(/\.eq\("workspace_id", scope\.workspaceId\)/g)).toHaveLength(2);
    expect(source.match(/\.eq\("project_id", scope\.projectId\)/g)).toHaveLength(2);
    expect(source).toContain('.eq("is_demo_retired", false)');
    expect(source).toContain('.in("status", activeItemStatuses)');
    expect(source).toContain("maxProjectGraphItems + 1");
    expect(source).toContain("maxProjectGraphDependencies + 1");
    expect(source).toContain("traverseImpactGraph");
    expect(source).not.toContain("openai");
  });
});

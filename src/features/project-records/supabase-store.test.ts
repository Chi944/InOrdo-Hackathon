import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/features/project-records/supabase-store.ts"),
  "utf8",
);

function operationSource(start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  return source.slice(startIndex, endIndex === -1 ? undefined : endIndex);
}

describe("Supabase project record store scoping", () => {
  it("uses explicit selectors and never selects all columns", () => {
    expect(source).not.toMatch(/\.select\(\s*["'`]\s*\*/);
    expect(source).toContain("projectRecordItemSelector");
    expect(source).toContain("dependencyRecordSelector");
  });

  it("conditions item updates on tenant, project, id, and version", () => {
    const update = operationSource("async updateItem(", "async listItems(");
    expect(update).toContain('.eq("workspace_id", scope.workspaceId)');
    expect(update).toContain('.eq("project_id", scope.projectId)');
    expect(update).toContain('.eq("id", itemId)');
    expect(update).toContain('.eq("version", expectedVersion)');
  });

  it("scopes dependency removal by tenant, project, and record id", () => {
    const removal = operationSource(
      "async removeDependency(",
      "async listDependencies(",
    );
    expect(removal).toContain('.eq("workspace_id", scope.workspaceId)');
    expect(removal).toContain('.eq("project_id", scope.projectId)');
    expect(removal).toContain('.eq("id", dependencyId)');
  });
});

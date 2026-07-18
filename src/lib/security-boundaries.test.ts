import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sourceRoot = resolve(process.cwd(), "src");
const moduleExtensions = [".ts", ".tsx"] as const;
const secretVariableNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "DEMO_RESET_SECRET",
] as const;

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(path);
    }
    return moduleExtensions.includes(
      extname(entry.name) as (typeof moduleExtensions)[number],
    )
      ? [path]
      : [];
  });
}

function resolveLocalImport(importer: string, specifier: string) {
  const base = specifier.startsWith("@/")
    ? resolve(sourceRoot, specifier.slice(2))
    : resolve(dirname(importer), specifier);
  const candidates = [
    ...moduleExtensions.map((extension) => `${base}${extension}`),
    ...moduleExtensions.map((extension) => join(base, `index${extension}`)),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function clientReachableModules(entry: string): Map<string, string> {
  const visited = new Map<string, string>();
  const pending = [entry];
  const importPattern = /(?:from\s+|import\s*)["']([^"']+)["']/g;

  while (pending.length > 0) {
    const path = pending.pop();
    if (!path || visited.has(path)) {
      continue;
    }

    const source = readFileSync(path, "utf8");
    visited.set(path, source);

    if (/^["']use server["'];/m.test(source)) {
      continue;
    }

    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      if (!specifier?.startsWith("@/") && !specifier?.startsWith(".")) {
        continue;
      }
      const resolved = resolveLocalImport(path, specifier);
      if (resolved) {
        pending.push(resolved);
      }
    }
  }

  return visited;
}

describe("client bundle boundaries", () => {
  it("keeps server secrets out of every client-reachable local module", () => {
    const clientEntries = listSourceFiles(sourceRoot).filter((path) =>
      /^["']use client["'];/m.test(readFileSync(path, "utf8")),
    );

    expect(clientEntries.length).toBeGreaterThan(0);

    for (const entry of clientEntries) {
      for (const [path, source] of clientReachableModules(entry)) {
        for (const secretName of secretVariableNames) {
          expect(source, relative(sourceRoot, path)).not.toContain(secretName);
        }
        expect(source, relative(sourceRoot, path)).not.toContain(
          "@/lib/env/server",
        );
        expect(source, relative(sourceRoot, path)).not.toContain(
          "@/lib/supabase/privileged",
        );
      }
    }
  });

  it("marks privileged and user-scoped server modules as server-only", () => {
    for (const path of [
      "src/lib/env/server.ts",
      "src/lib/supabase/server.ts",
      "src/lib/supabase/privileged.ts",
      "src/lib/supabase/proxy.ts",
      "src/lib/auth/guards.ts",
      "src/lib/repositories/project-data.ts",
      "src/features/analysis/context.ts",
      "src/features/analysis/openai-adapter.ts",
      "src/features/analysis/post-validation.ts",
      "src/features/analysis/route-handler.ts",
      "src/features/analysis/runtime.ts",
      "src/features/analysis/service.ts",
      "src/features/analysis/supabase-persistence.ts",
      "src/features/operations/history.ts",
      "src/features/operations/route-handler.ts",
      "src/features/operations/runtime.ts",
      "src/features/operations/service.ts",
      "src/features/operations/supabase-persistence.ts",
    ]) {
      expect(readFileSync(resolve(process.cwd(), path), "utf8"), path).toMatch(
        /^import "server-only";/,
      );
    }
  });

  it("keeps OpenAI and server environment imports outside client-reachable modules", () => {
    const clientEntries = listSourceFiles(sourceRoot).filter((path) =>
      /^["']use client["'];/m.test(readFileSync(path, "utf8")),
    );

    for (const entry of clientEntries) {
      for (const [path, source] of clientReachableModules(entry)) {
        expect(source, relative(sourceRoot, path)).not.toMatch(
          /from\s+["']openai(?:\/[^"']*)?["']/,
        );
        expect(source, relative(sourceRoot, path)).not.toContain(
          "@/features/analysis/runtime",
        );
      }
    }
  });

  it("keeps the analysis pipeline proposal-only and narrows privileged persistence", () => {
    const analysisRoot = resolve(sourceRoot, "features", "analysis");
    const analysisModules = listSourceFiles(analysisRoot).filter(
      (path) => !path.includes(".test."),
    );

    for (const path of analysisModules) {
      const source = readFileSync(path, "utf8");
      const relativePath = relative(sourceRoot, path).replaceAll("\\", "/");
      if (
        relativePath !== "features/analysis/runtime.ts" &&
        relativePath !== "features/analysis/supabase-persistence.ts"
      ) {
        expect(source, relativePath).not.toContain(
          "@/lib/supabase/privileged",
        );
      }
      expect(source, relative(sourceRoot, path)).not.toMatch(
        /\.from\(["']project_items["']\)[\s\S]{0,160}\.(?:insert|update|delete)\(/,
      );
    }
  });

  it("keeps the privileged client outside the reviewed analysis persistence boundary", () => {
    const allowedModules = new Set([
      "features/analysis/runtime.ts",
      "features/analysis/supabase-persistence.ts",
      "features/operations/runtime.ts",
      "features/operations/supabase-persistence.ts",
    ]);
    const requestModules = [
      ...listSourceFiles(resolve(sourceRoot, "app")),
      ...listSourceFiles(resolve(sourceRoot, "features")),
    ].filter((path) => !path.includes(".test."));

    for (const path of requestModules) {
      const relativePath = relative(sourceRoot, path).replaceAll("\\", "/");
      if (!allowedModules.has(relativePath)) {
        expect(readFileSync(path, "utf8"), relativePath).not.toContain(
          "@/lib/supabase/privileged",
        );
      }
    }

    expect(
      readFileSync(
        resolve(sourceRoot, "features/analysis/runtime.ts"),
        "utf8",
      ),
    ).toContain("createPrivilegedSupabaseClient");
    expect(
      readFileSync(
        resolve(sourceRoot, "features/operations/runtime.ts"),
        "utf8",
      ),
    ).toContain("createPrivilegedSupabaseClient");
  });
});

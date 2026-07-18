import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("login server actions", () => {
  it("exports only async functions at runtime", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/login/actions.ts"),
      "utf8",
    );

    expect(source).toMatch(/^"use server";/);
    expect(source).not.toMatch(/^export\s+(?:const|let|var|class)\s+/m);
    expect(source).toMatch(/^export async function loginAction/m);
    expect(source).toMatch(/^export async function logoutAction/m);
  });
});

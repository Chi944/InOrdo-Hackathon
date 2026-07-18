import { describe, expect, it } from "vitest";

import { getSafeRedirect } from "@/lib/auth/redirect";

describe("getSafeRedirect", () => {
  it("keeps local application paths", () => {
    expect(getSafeRedirect("/app/projects/123?tab=items")).toBe(
      "/app/projects/123?tab=items",
    );
  });

  it.each([
    "https://attacker.example/app",
    "//attacker.example/app",
    "/login",
    "/app\\@attacker.example",
    "javascript:alert(1)",
  ])("rejects unsafe destination %s", (destination) => {
    expect(getSafeRedirect(destination)).toBe("/app");
  });
});

import { describe, expect, it } from "vitest";

import {
  ProjectRecordError,
  mapProjectRecordDatabaseError,
} from "@/features/project-records/errors";

describe("project record database errors", () => {
  it.each([
    ["23505", "conflict"],
    ["23514", "validation"],
    ["23503", "invalid_reference"],
    ["42501", "forbidden"],
  ] as const)("maps PostgreSQL %s without leaking internals", (databaseCode, code) => {
    const result = mapProjectRecordDatabaseError({
      code: databaseCode,
      message: "sensitive table and policy detail",
      details: "private implementation",
    });

    expect(result).toBeInstanceOf(ProjectRecordError);
    expect(result.code).toBe(code);
    expect(result.message).not.toContain("sensitive");
    expect(result.message).not.toContain("private implementation");
  });

  it("uses a generic safe failure for unknown database errors", () => {
    expect(
      mapProjectRecordDatabaseError({ code: "XX000", message: "internal" }),
    ).toMatchObject({
      code: "internal",
      message: "The project record could not be saved. Please try again.",
    });
  });
});

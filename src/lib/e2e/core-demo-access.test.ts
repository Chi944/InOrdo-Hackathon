import { describe, expect, it } from "vitest";

import { isCoreDemoFixtureEnabled } from "@/lib/e2e/core-demo-access";

describe("core demo fixture access", () => {
  it.each([
    { NODE_ENV: "development", INORDO_E2E_FIXTURES: "1", expected: true },
    { NODE_ENV: "test", INORDO_E2E_FIXTURES: "1", expected: true },
    { NODE_ENV: "production", INORDO_E2E_FIXTURES: "1", expected: false },
    { NODE_ENV: "development", INORDO_E2E_FIXTURES: "true", expected: false },
    { NODE_ENV: "development", INORDO_E2E_FIXTURES: undefined, expected: false },
    { NODE_ENV: "staging", INORDO_E2E_FIXTURES: "1", expected: false },
  ])(
    "returns $expected for NODE_ENV=$NODE_ENV and the supplied flag",
    ({ expected, ...environment }) => {
      expect(isCoreDemoFixtureEnabled(environment)).toBe(expected);
    },
  );
});

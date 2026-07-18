import { describe, expect, it } from "vitest";

import {
  coreDemoStages,
  parseCoreDemoStage,
} from "@/lib/e2e/core-demo-stage";

describe("core demo fixture stage", () => {
  it.each(coreDemoStages)("accepts the %s stage", (stage) => {
    expect(parseCoreDemoStage(stage)).toBe(stage);
  });

  it.each([undefined, null, "", "APPLIED", "unknown"])(
    "fails closed to the baseline for %s",
    (stage) => {
      expect(parseCoreDemoStage(stage)).toBe("baseline");
    },
  );
});

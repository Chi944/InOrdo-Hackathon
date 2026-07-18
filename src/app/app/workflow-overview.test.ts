import { describe, expect, it } from "vitest";

import { buildWorkflowOverview } from "@/app/app/workflow-overview";

describe("workflow overview presentation", () => {
  it("keeps load failures distinct from fulfilled empty workflow data", () => {
    const unavailable = buildWorkflowOverview({
      analysisLoadFailed: true,
      operationsLoadFailed: true,
      impactCount: 0,
      hasProposal: false,
      operationCount: 0,
    });

    expect(unavailable).toMatchObject({
      analysisUnavailable: true,
      operationsUnavailable: true,
      impactDetail: "Impact data unavailable",
      historyDetail: "Operation history unavailable",
      reviewRecordCountLabel: "Unavailable",
      operationCountLabel: "Unavailable",
    });
    expect(unavailable.reviewMessage).not.toMatch(/no impact analysis/i);
    expect(unavailable.operationMessage).not.toMatch(/no applied operation/i);

    const empty = buildWorkflowOverview({
      analysisLoadFailed: false,
      operationsLoadFailed: false,
      impactCount: 0,
      hasProposal: false,
      operationCount: 0,
    });

    expect(empty.reviewRecordCountLabel).toBe("0");
    expect(empty.operationCountLabel).toBe("0");
    expect(empty.reviewMessage).toMatch(/no impact analysis/i);
    expect(empty.operationMessage).toMatch(/no applied operation/i);
  });
});

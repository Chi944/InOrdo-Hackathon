import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ImpactWorkflowData } from "@/app/app/impact-workflow-types";

const router = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { ImpactWorkflow } from "@/app/app/impact-workflow";

const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
const operationId = "d1669e0f-604c-4ec2-8ff1-717b2a4d5101";
const data: ImpactWorkflowData = {
  analysis: null,
  analysisLoadFailed: false,
  operations: [
    {
      id: operationId,
      operationType: "apply_proposal",
      state: "succeeded",
      proposalId: "5bf63e7d-c8db-4c2d-a3cc-20107cb91503",
      reversesOperationId: null,
      initiatorName: "Demo owner",
      createdAt: "2026-07-20T10:00:00.000Z",
      completedAt: "2026-07-20T10:00:01.000Z",
      reversible: true,
      undoEligible: true,
      errorCode: null,
      items: [],
    },
  ],
  operationsLoadFailed: false,
};

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("impact workflow undo", () => {
  it("rotates after a definitive undo rejection and retains the replacement key across ambiguous failures", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "conflict", message: "Undo conflict." },
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      )
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "internal_error", message: "Undo status is uncertain." },
          }),
          { status: 503, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "succeeded",
            operationId: "d1669e0f-604c-4ec2-8ff1-717b2a4d5102",
            duplicate: true,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ImpactWorkflow
        data={data}
        projectId={projectId}
        role="owner"
        syntheticWorkspace={false}
      />,
    );

    const undoButton = screen.getByRole("button", {
      name: `Undo operation ${operationId}`,
    });
    for (const expectedCalls of [1, 2, 3, 4]) {
      await user.click(undoButton);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(expectedCalls));
      await waitFor(() => expect(undoButton).toBeEnabled());
    }

    const keys = fetchMock.mock.calls.map((call) => {
      const [, options] = call as [string, RequestInit];
      return (JSON.parse(String(options.body)) as { idempotencyKey: string })
        .idempotencyKey;
    });
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys[1]).toBe(keys[2]);
    expect(keys[2]).toBe(keys[3]);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
});

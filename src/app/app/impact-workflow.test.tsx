import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ImpactWorkflowData } from "@/app/app/impact-workflow-types";
import type { AnalysisAvailability } from "@/features/analysis/provider-policy";

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
const fallbackAvailability = {
  mode: "auto",
  status: "fallback_configured",
  canAnalyze: true,
  provider: "Vercel AI Gateway",
  model: "openai/gpt-oss-20b",
  message: "The capped GPT-OSS fallback is available for authorized contributors.",
} satisfies AnalysisAvailability;
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

const createOperationData = {
  analysis: null,
  analysisLoadFailed: false,
  operations: [
    {
      id: "d1669e0f-604c-4ec2-8ff1-717b2a4d5103",
      operationType: "apply_proposal",
      state: "succeeded",
      proposalId: "5bf63e7d-c8db-4c2d-a3cc-20107cb91503",
      reversesOperationId: null,
      initiatorName: "Demo owner",
      createdAt: "2026-07-20T10:00:00.000Z",
      completedAt: "2026-07-20T10:00:01.000Z",
      reversible: false,
      undoEligible: false,
      errorCode: null,
      items: [
        {
          id: "78915e0f-604c-4ec2-8ff1-717b2a4d5103",
          ordinal: 1,
          state: "succeeded",
          itemId: "21d4e760-f552-43d4-bf6a-000000000003",
          itemLabel: "TSK-11 — Reconfirm catering",
          actionType: "create_item",
          reason: "Protect the supplier cutoff.",
          beforeValue: "Not set",
          afterValue: "TSK-11 — Reconfirm catering",
          commitFields: [
            { field: "item_type", value: "task" },
            { field: "title", value: "Reconfirm catering" },
            {
              field: "description",
              value: "Call the venue before the supplier cutoff.",
            },
            { field: "status", value: "not_started" },
            { field: "priority", value: "high" },
            {
              field: "owner_id",
              value: "6519012e-13a6-4e3e-9ae5-d09bd3054401",
            },
            { field: "start_date", value: "2026-08-01" },
            { field: "due_date", value: "2026-08-05" },
          ],
          reversible: false,
          errorCode: null,
        },
      ],
    },
  ],
  operationsLoadFailed: false,
} as const satisfies ImpactWorkflowData;

const persistedAnalysisData = {
  analysis: {
    requestId: "e7387514-03d0-48ee-a0e1-c183af721100",
    state: "succeeded",
    modelName: "provider/model-safe",
    createdAt: "2026-07-20T10:00:00.000Z",
    finishedAt: "2026-07-20T10:00:01.000Z",
    failureCode: null,
    failureStage: null,
    source: null,
    change: null,
    impacts: [],
    impactState: "completed",
    impactError: null,
    proposal: null,
    loadWarning: null,
  },
  analysisLoadFailed: false,
  operations: [],
  operationsLoadFailed: false,
} satisfies ImpactWorkflowData;

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
        analysisAvailability={fallbackAvailability}
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

  it("shows the full create receipt in the applied result and audit history", () => {
    render(
      <ImpactWorkflow
        analysisAvailability={fallbackAvailability}
        data={createOperationData}
        projectId={projectId}
        role="owner"
        syntheticWorkspace={false}
      />,
    );

    for (const regionId of ["applied-result", "audit-history"]) {
      const region = within(document.getElementById(regionId) as HTMLElement);
      for (const value of [
        "task",
        "Reconfirm catering",
        "Call the venue before the supplier cutoff.",
        "not started",
        "high",
        "6519012e-13a6-4e3e-9ae5-d09bd3054401",
        "2026-08-01",
        "2026-08-05",
      ]) {
        expect(region.getByText(value, { exact: true })).toBeVisible();
      }
    }
  });

  it("keeps viewer analysis and undo controls disabled without making a request", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(
      <ImpactWorkflow
        analysisAvailability={fallbackAvailability}
        data={data}
        projectId={projectId}
        role="viewer"
        syntheticWorkspace={false}
      />,
    );

    expect(screen.getByText(/Read-only judge access/i)).toBeVisible();
    expect(screen.getByLabelText("Source title")).toBeDisabled();
    expect(screen.getByLabelText("Source type")).toBeDisabled();
    expect(screen.getByLabelText("Author label")).toBeDisabled();
    expect(screen.getByLabelText("Occurred at (optional)")).toBeDisabled();
    expect(screen.getByLabelText("Source text")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Analyze change" })).toBeDisabled();
    const undo = screen.getByRole("button", {
      name: `Undo operation ${operationId}`,
    });
    expect(undo).toBeVisible();
    expect(undo).toBeDisabled();
    await user.click(undo);
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("attributes persisted results from their stored model metadata", () => {
    render(
      <ImpactWorkflow
        analysisAvailability={fallbackAvailability}
        data={persistedAnalysisData}
        projectId={projectId}
        role="owner"
        syntheticWorkspace={false}
      />,
    );

    const persistedAttribution = screen
      .getByText("Recorded analysis provider")
      .closest("dl") as HTMLElement;
    expect(
      within(persistedAttribution).getByText(
        "Recorded model · provider/model-safe",
      ),
    ).toBeVisible();
    expect(
      screen.getByText("Vercel AI Gateway · GPT-OSS 20B"),
    ).toBeVisible();
  });
});

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

import type {
  RecoveryAction,
  RecoveryProposal,
} from "@/app/app/impact-workflow-types";
import {
  defaultSelectedActionIds,
  RecoveryActionReview,
  selectedActionsInOrder,
} from "@/app/app/recovery-action-review";

const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";

const actions: RecoveryAction[] = [
  {
    id: "4c320952-a5e8-40d3-824b-d528c61de101",
    ordinal: 1,
    state: "pending",
    actionType: "update_item",
    title: "Update EVT-01 event date",
    currentValue: "2026-09-12",
    proposedValue: "2026-09-26",
    reason: "Align the canonical event with the source update.",
    linkedImpactItemId: "b993a2d1-8060-4c96-a7d0-e79f4cd43303",
    linkedImpactLabel: "TSK-01 — Confirm speakers",
    confidence: 0.94,
    requiresHumanInput: false,
    humanInputPrompt: null,
  },
  {
    id: "4c320952-a5e8-40d3-824b-d528c61de102",
    ordinal: 2,
    state: "pending",
    actionType: "create_item",
    title: "Create task: Reconfirm catering",
    currentValue: "No existing item",
    proposedValue: "Task — Reconfirm catering",
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
    reason: "The event date affects the catering booking.",
    linkedImpactItemId: "b993a2d1-8060-4c96-a7d0-e79f4cd43304",
    linkedImpactLabel: "TSK-02 — Catering booking",
    confidence: 0.84,
    requiresHumanInput: false,
    humanInputPrompt: null,
  },
  {
    id: "4c320952-a5e8-40d3-824b-d528c61de103",
    ordinal: 3,
    state: "pending",
    actionType: "request_confirmation",
    title: "Request human confirmation",
    currentValue: "Unresolved",
    proposedValue: "Should participant travel be rebooked?",
    reason: "Travel changes carry cost and participant consequences.",
    linkedImpactItemId: "b993a2d1-8060-4c96-a7d0-e79f4cd43305",
    linkedImpactLabel: "RSK-01 — Participant travel",
    confidence: 0.72,
    requiresHumanInput: true,
    humanInputPrompt: "Should participant travel be rebooked?",
  },
  {
    id: "4c320952-a5e8-40d3-824b-d528c61de104",
    ordinal: 4,
    state: "applied",
    actionType: "update_item",
    title: "Already applied action",
    currentValue: "Old",
    proposedValue: "New",
    reason: "Recorded earlier.",
    linkedImpactItemId: null,
    linkedImpactLabel: "Linked impact unavailable",
    confidence: 0.9,
    requiresHumanInput: false,
    humanInputPrompt: null,
  },
];

const proposal: RecoveryProposal = {
  id: "5bf63e7d-c8db-4c2d-a3cc-20107cb91503",
  state: "ready",
  title: "Recover the summit schedule",
  rationale: "Review bounded internal changes caused by the venue update.",
  modelName: "gpt-5.6-luna",
  createdAt: "2026-07-20T10:00:00.000Z",
  actions,
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

describe("recovery action selection", () => {
  it("keeps proposal context visible but sends no apply request for a viewer", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    const onApplied = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <RecoveryActionReview
        canApprove={false}
        onApplied={onApplied}
        projectId={projectId}
        proposal={proposal}
      />,
    );

    expect(screen.getByText(new RegExp(proposal.title))).toBeVisible();
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toBeDisabled();
    }
    expect(
      screen.getByRole("button", { name: "Select all safe actions" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Leave all pending" }),
    ).toBeDisabled();
    const approve = screen.getByRole("button", { name: "Approve selected" });
    expect(approve).toBeDisabled();
    await user.click(approve);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onApplied).not.toHaveBeenCalled();
  });

  it("defaults to pending undo-eligible actions and excludes nonreversible, human-input, or non-pending actions", () => {
    expect(defaultSelectedActionIds(actions)).toEqual([actions[0].id]);
    expect(
      selectedActionsInOrder(actions, new Set([actions[2].id, actions[0].id])),
    ).toEqual([actions[0], actions[2]]);

    render(
      <RecoveryActionReview
        canApprove
        onApplied={vi.fn()}
        projectId={projectId}
        proposal={proposal}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: `Select ${actions[0].title}` }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: `Select ${actions[1].title}` }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: `Select ${actions[2].title}` }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: `Select ${actions[3].title}` }),
    ).toBeDisabled();
    expect(screen.getByText(/unchecked actions remain pending/i)).toBeVisible();
  });

  it("marks nonreversible actions and warns before applying them", async () => {
    const user = userEvent.setup();
    render(
      <RecoveryActionReview
        canApprove
        onApplied={vi.fn()}
        projectId={projectId}
        proposal={proposal}
      />,
    );

    const updateCard = screen
      .getByRole("checkbox", { name: `Select ${actions[0].title}` })
      .closest("article");
    const createCard = screen
      .getByRole("checkbox", { name: `Select ${actions[1].title}` })
      .closest("article");
    const confirmationCard = screen
      .getByRole("checkbox", { name: `Select ${actions[2].title}` })
      .closest("article");

    expect(updateCard).not.toBeNull();
    expect(createCard).not.toBeNull();
    expect(confirmationCard).not.toBeNull();
    expect(within(updateCard as HTMLElement).getByText("Undo may be available")).toBeVisible();
    expect(within(createCard as HTMLElement).getByText("Cannot be undone")).toBeVisible();
    expect(
      within(confirmationCard as HTMLElement).getByText("Cannot be undone"),
    ).toBeVisible();

    await user.click(
      screen.getByRole("checkbox", { name: `Select ${actions[1].title}` }),
    );
    await user.click(screen.getByRole("button", { name: "Approve selected" }));

    const dialog = screen.getByRole("dialog", {
      name: /approve 2 selected actions/i,
    });
    expect(dialog).toHaveTextContent(
      /entire operation cannot be undone because 1 selected action is nonreversible/i,
    );
    expect(dialog).toHaveTextContent(/separate reviewed forward action/i);
  });

  it("shows every committed create-item field on the card and in final review", async () => {
    const user = userEvent.setup();
    render(
      <RecoveryActionReview
        canApprove
        onApplied={vi.fn()}
        projectId={projectId}
        proposal={proposal}
      />,
    );

    const createCard = screen
      .getByRole("checkbox", { name: `Select ${actions[1].title}` })
      .closest("article");
    expect(createCard).not.toBeNull();
    const card = within(createCard as HTMLElement);
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
      expect(card.getByText(value, { exact: true })).toBeVisible();
    }

    await user.click(
      screen.getByRole("checkbox", { name: `Select ${actions[1].title}` }),
    );
    await user.click(screen.getByRole("button", { name: "Approve selected" }));

    const dialog = within(
      screen.getByRole("dialog", { name: /approve 2 selected actions/i }),
    );
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
      expect(dialog.getByText(value, { exact: true })).toBeVisible();
    }
  });

  it("supports keyboard selection, leaves actions pending locally, and summarizes before apply", async () => {
    const user = userEvent.setup();
    render(
      <RecoveryActionReview
        canApprove
        onApplied={vi.fn()}
        projectId={projectId}
        proposal={proposal}
      />,
    );
    const humanCheckbox = screen.getByRole("checkbox", {
      name: `Select ${actions[2].title}`,
    });
    humanCheckbox.focus();
    await user.keyboard(" ");
    expect(humanCheckbox).toBeChecked();
    expect(
      screen.getByLabelText(`Human response for ${actions[2].title}`),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Leave all pending" }));
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).not.toBeChecked();
    }
    expect(screen.getByText(/no rejection request was sent/i)).toHaveTextContent(
      /no rejection request was sent/i,
    );

    await user.click(screen.getByRole("button", { name: "Select all safe actions" }));
    expect(humanCheckbox).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Approve selected" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Approve selected" }));

    const dialog = screen.getByRole("dialog", {
      name: /approve 1 selected action/i,
    });
    expect(dialog).toBeVisible();
    expect(dialog).toHaveTextContent(actions[0].title);
    expect(dialog).not.toHaveTextContent(actions[1].title);
    expect(dialog).not.toHaveTextContent(actions[2].title);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Approve selected" })).toHaveFocus();
  });

  it("sends only selected actions and the required human response through the existing apply contract", async () => {
    const user = userEvent.setup();
    const onApplied = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "succeeded",
          operationId: "d1669e0f-604c-4ec2-8ff1-717b2a4d5101",
          appliedActionIds: [actions[0].id, actions[2].id],
          duplicate: false,
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <RecoveryActionReview
        canApprove
        onApplied={onApplied}
        projectId={projectId}
        proposal={proposal}
      />,
    );

    await user.click(
      screen.getByRole("checkbox", { name: `Select ${actions[2].title}` }),
    );
    fireEvent.change(
      screen.getByLabelText(`Human response for ${actions[2].title}`),
      {
        target: {
          value: "Hold travel until the venue contract is countersigned.",
        },
      },
    );
    await user.click(screen.getByRole("button", { name: "Approve selected" }));
    await user.click(
      screen.getByRole("button", { name: "Confirm and apply selected" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `/api/projects/${projectId}/proposals/${proposal.id}/apply`,
    );
    const body = JSON.parse(String(options.body)) as {
      selectedActionIds: string[];
      humanInputs: Array<{
        actionId: string;
        confirmed: boolean;
        response: string;
      }>;
      idempotencyKey: string;
    };
    expect(body.selectedActionIds).toEqual([actions[0].id, actions[2].id]);
    expect(body.humanInputs).toEqual([
      {
        actionId: actions[2].id,
        confirmed: true,
        response: "Hold travel until the venue contract is countersigned.",
      },
    ]);
    expect(body.idempotencyKey).toMatch(/^[A-Za-z0-9._:-]{8,200}$/);
    expect(onApplied).toHaveBeenCalledWith({
      operationId: "d1669e0f-604c-4ec2-8ff1-717b2a4d5101",
      appliedActionIds: [actions[0].id, actions[2].id],
      duplicate: false,
    });
    expect(
      screen
        .getAllByRole("status")
        .some((status) =>
          /unselected actions remain pending/i.test(status.textContent ?? ""),
        ),
    ).toBe(true);
  });

  it("rotates after a definitive apply rejection and retains the replacement key across ambiguous failures", async () => {
    const user = userEvent.setup();
    const onApplied = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "conflict", message: "Review the current values." },
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      )
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "internal_error", message: "Apply status is uncertain." },
          }),
          { status: 503, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "succeeded",
            operationId: "d1669e0f-604c-4ec2-8ff1-717b2a4d5102",
            appliedActionIds: [actions[0].id, actions[1].id],
            duplicate: true,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <RecoveryActionReview
        canApprove
        onApplied={onApplied}
        projectId={projectId}
        proposal={proposal}
      />,
    );

    async function attemptApply(expectedCalls: number) {
      await user.click(screen.getByRole("button", { name: "Approve selected" }));
      await user.click(
        screen.getByRole("button", { name: "Confirm and apply selected" }),
      );
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(expectedCalls));
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Approve selected" }),
        ).toBeEnabled(),
      );
    }

    await attemptApply(1);
    await attemptApply(2);
    await attemptApply(3);
    await attemptApply(4);

    const keys = fetchMock.mock.calls.map((call) => {
      const [, options] = call as [string, RequestInit];
      return (JSON.parse(String(options.body)) as { idempotencyKey: string })
        .idempotencyKey;
    });
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys[1]).toBe(keys[2]);
    expect(keys[2]).toBe(keys[3]);
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it("gates draft approval and clears visible selection in a terminal state", () => {
    const { rerender } = render(
      <RecoveryActionReview
        canApprove
        onApplied={vi.fn()}
        projectId={projectId}
        proposal={{ ...proposal, state: "draft" }}
      />,
    );

    expect(screen.getByText(/approval is waiting on backend readiness/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Approve selected" })).toBeDisabled();

    const appliedActions = actions.map((action) =>
      action.state === "pending" ? { ...action, state: "applied" as const } : action,
    );
    rerender(
      <RecoveryActionReview
        canApprove
        onApplied={vi.fn()}
        projectId={projectId}
        proposal={{ ...proposal, actions: appliedActions, state: "applied" }}
      />,
    );

    expect(screen.getByText("Proposal is applied")).toBeVisible();
    expect(screen.getByText(/closed proposal state/i)).toBeVisible();
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).not.toBeChecked();
      expect(checkbox).toBeDisabled();
    }
  });

  it("keeps a superseded proposal visible but makes every action non-approvable", () => {
    render(
      <RecoveryActionReview
        canApprove
        onApplied={vi.fn()}
        projectId={projectId}
        proposal={{ ...proposal, state: "superseded" }}
      />,
    );

    expect(screen.getByText("Proposal is superseded")).toBeVisible();
    expect(screen.getByText(/closed proposal state/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Approve selected" })).toBeDisabled();
    for (const action of actions) {
      expect(
        screen.getByRole("checkbox", { name: `Select ${action.title}` }),
      ).toBeDisabled();
      expect(
        screen.getByRole("checkbox", { name: `Select ${action.title}` }),
      ).not.toBeChecked();
    }
  });
});

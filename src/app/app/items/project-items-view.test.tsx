import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actionMocks = vi.hoisted(() => ({
  createProjectItemAction: vi.fn(),
}));

vi.mock("@/app/app/project-record-actions", () => actionMocks);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import {
  ProjectItemsView,
  type ProjectItemsViewItem,
} from "@/app/app/items/project-items-view";

afterEach(cleanup);

beforeEach(() => {
  actionMocks.createProjectItemAction.mockReset().mockResolvedValue({
    status: "success",
    message: "Project item created.",
    idempotencyKeyDisposition: "rotate",
  });
});

const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
const workflowGeneration = 4;
const memberOptions = [
  {
    id: "3e14b4a4-421d-4d6d-8a7e-01d5a22e3002",
    displayName: "Mina Rahman",
  },
  {
    id: "b993a2d1-8060-4c96-a7d0-e79f4cd43303",
    displayName: "Leo Tan",
  },
];

const items: ProjectItemsViewItem[] = [
  {
    id: "4db0760c-d441-4b39-845d-f011b3e14404",
    itemKey: "EVENT-12",
    itemType: "event",
    title: "Regional Climate Action Summit 2026",
    description: "The coalition's synthetic summit event.",
    status: "in_progress",
    priority: "critical",
    assignee: memberOptions[0],
    startDate: "2026-09-26",
    dueDate: "2026-09-26",
    eventDate: "2026-09-26",
  },
  {
    id: "5ec1871d-e552-4c4a-956e-122c4f025505",
    itemKey: "TASK-24",
    itemType: "task",
    title: "Confirm keynote speakers",
    description: "Reconfirm availability after the date change.",
    status: "blocked",
    priority: "high",
    assignee: memberOptions[1],
    startDate: "2026-07-01",
    dueDate: "2026-07-18",
    eventDate: null,
  },
  {
    id: "6fd2982e-f663-4d5b-a67f-233d5a136606",
    itemKey: "RISK-08",
    itemType: "risk",
    title: "Speaker availability risk",
    description: "Some speakers may not be available on the new date.",
    status: "at_risk",
    priority: "high",
    assignee: null,
    startDate: null,
    dueDate: null,
    eventDate: null,
  },
];

function renderView(overrides: Partial<React.ComponentProps<typeof ProjectItemsView>> = {}) {
  return render(
    <ProjectItemsView
      canEdit
      items={items}
      memberOptions={memberOptions}
      projectId={projectId}
      workflowGeneration={workflowGeneration}
      {...overrides}
    />,
  );
}

describe("ProjectItemsView", () => {
  it("filters by search and select controls, then clears every filter", async () => {
    const user = userEvent.setup();
    renderView();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing 3 of 3 project items",
    );

    await user.type(screen.getByLabelText("Search items"), "speaker");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing 2 of 3 project items",
    );
    expect(
      screen.queryByRole("link", { name: /Regional Climate Action Summit 2026/i }),
    ).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filter by type"), "risk");
    await user.selectOptions(
      screen.getByLabelText("Filter by assignee"),
      "unassigned",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing 1 of 3 project items",
    );
    expect(
      screen.getAllByRole("link", { name: /Speaker availability risk/i }),
    ).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByLabelText("Search items")).toHaveValue("");
    expect(screen.getByLabelText("Filter by type")).toHaveValue("all");
    expect(screen.getByLabelText("Filter by assignee")).toHaveValue("all");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing 3 of 3 project items",
    );
  });

  it("exposes a desktop table and a small-screen card list with equivalent item links", () => {
    renderView();

    expect(
      screen.getByRole("table", {
        name: /project items with type, status, priority, assignee, and due date/i,
      }),
    ).toBeInTheDocument();

    const cards = screen.getByRole("list", { name: "Project items" });
    expect(within(cards).getAllByRole("listitem")).toHaveLength(3);
    expect(
      within(cards).getByRole("link", {
        name: /EVENT-12.*Regional Climate Action Summit 2026/i,
      }),
    ).toHaveAttribute(
      "href",
      "/app/items/4db0760c-d441-4b39-845d-f011b3e14404",
    );
    expect(within(cards).getByText("Unassigned")).toBeInTheDocument();
    expect(within(cards).getAllByText("High").length).toBeGreaterThan(0);
  });

  it("renders and resets a clear filtered-empty state", async () => {
    const user = userEvent.setup();
    renderView();

    await user.type(screen.getByLabelText("Search items"), "no such record");
    expect(
      screen.getByRole("heading", { name: "No items match these filters" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(
      screen.queryByRole("heading", { name: "No items match these filters" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing 3 of 3 project items",
    );
  });

  it("opens a native dialog with every server-backed create field and returns focus", async () => {
    const user = userEvent.setup();
    renderView();

    const openButton = screen.getByRole("button", { name: "Create item" });
    await user.click(openButton);

    const dialog = screen.getByRole("dialog", { name: "Create project item" });
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByLabelText(/Item key/i)).toHaveFocus();
    expect(screen.getByLabelText(/Item key/i)).toHaveAttribute(
      "name",
      "itemKey",
    );
    expect(screen.getByLabelText("Title")).toHaveAttribute("name", "title");
    expect(screen.getByLabelText("Type")).toHaveAttribute("name", "itemType");
    expect(screen.getByLabelText("Status")).toHaveAttribute("name", "status");
    expect(screen.getByLabelText("Priority")).toHaveAttribute("name", "priority");
    expect(screen.getByLabelText("Assignee")).toHaveAttribute("name", "ownerId");
    expect(screen.getByLabelText(/Description/)).toHaveAttribute(
      "name",
      "description",
    );
    expect(screen.getByLabelText(/Start date/)).toHaveAttribute(
      "name",
      "startDate",
    );
    expect(screen.getByLabelText(/Due date/)).toHaveAttribute("name", "dueDate");
    expect(screen.getByLabelText(/Event date/)).toHaveAttribute(
      "name",
      "eventDate",
    );
    const form = dialog.querySelector("form");
    const generationInput = form?.querySelector<HTMLInputElement>(
      'input[name="expectedWorkflowGeneration"]',
    );
    const keyInput = form?.querySelector<HTMLInputElement>(
      'input[name="idempotencyKey"]',
    );
    expect(generationInput).toHaveValue(String(workflowGeneration));
    await waitFor(() =>
      expect(keyInput?.value).toMatch(/^[A-Za-z0-9._:-]{8,200}$/),
    );
    const originalKey = keyInput?.value;
    await user.type(screen.getByLabelText("Title"), "Draft agenda");
    expect(keyInput?.value).not.toBe(originalKey);
    expect(
      within(dialog).getByRole("option", { name: "Mina Rahman" }),
    ).toHaveValue(memberOptions[0].id);

    await user.keyboard("{Escape}");
    expect(dialog).not.toHaveAttribute("open");
    expect(openButton).toHaveFocus();
  });

  it("keeps creation unavailable for read-only viewers and explains a true empty state", () => {
    renderView({ canEdit: false, items: [] });

    expect(screen.queryByRole("button", { name: "Create item" })).not.toBeInTheDocument();
    expect(screen.getByText(/Viewer access · Read only/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No project items yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This project does not have any visible records."),
    ).toBeInTheDocument();
  });

  it("keeps every create control and dialog exit locked while creation is pending", async () => {
    let resolveCreate:
      | ((value: {
          status: "error";
          message: string;
          idempotencyKeyDisposition: "retain";
        }) => void)
      | undefined;
    actionMocks.createProjectItemAction.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("button", { name: "Create item" }));
    const dialog = screen.getByRole("dialog", { name: "Create project item" });
    const form = dialog.querySelector("form");
    await user.type(within(dialog).getByLabelText(/Item key/i), "EVENT-99");
    await user.type(within(dialog).getByLabelText("Title"), "Confirm accessibility");
    await user.type(within(dialog).getByLabelText(/Event date/), "2026-09-26");
    await user.click(within(dialog).getByRole("button", { name: "Create item" }));

    await waitFor(() => expect(form).toHaveAttribute("aria-busy", "true"));
    for (const label of [
      /Item key/i,
      "Title",
      "Type",
      "Status",
      "Priority",
      "Assignee",
      /Description/,
      /Start date/,
      /Due date/,
      /Event date/,
    ]) {
      expect(within(dialog).getByLabelText(label)).toBeDisabled();
    }
    expect(
      within(dialog).getByRole("button", { name: "Close create item dialog" }),
    ).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: /Creating item/ }),
    ).toBeDisabled();

    const submittedForm = actionMocks.createProjectItemAction.mock.calls[0]?.[1];
    expect(submittedForm).toBeInstanceOf(FormData);
    expect((submittedForm as FormData).get("expectedWorkflowGeneration")).toBe(
      String(workflowGeneration),
    );
    expect((submittedForm as FormData).get("idempotencyKey")).toMatch(
      /^[A-Za-z0-9._:-]{8,200}$/,
    );

    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
    expect(dialog).toHaveAttribute("open");

    await act(async () => {
      resolveCreate?.({
        status: "error",
        message: "Outcome unknown. Retry unchanged.",
        idempotencyKeyDisposition: "retain",
      });
      await Promise.resolve();
    });
    await waitFor(() => expect(form).toHaveAttribute("aria-busy", "false"));
    expect(within(dialog).getByLabelText(/Item key/i)).toHaveValue("EVENT-99");
    expect(within(dialog).getByLabelText("Title")).toHaveValue(
      "Confirm accessibility",
    );
    expect(within(dialog).getByLabelText(/Event date/)).toHaveValue("2026-09-26");
  });

  it("retains one key for identical ambiguous retries and rotates it after success", async () => {
    const user = userEvent.setup();
    actionMocks.createProjectItemAction
      .mockResolvedValueOnce({
        status: "error",
        message: "Outcome unknown. Retry unchanged.",
        idempotencyKeyDisposition: "retain",
      })
      .mockResolvedValueOnce({
        status: "error",
        message: "Outcome unknown. Retry unchanged.",
        idempotencyKeyDisposition: "retain",
      })
      .mockResolvedValueOnce({
        status: "success",
        message: "Project item created.",
        idempotencyKeyDisposition: "rotate",
      });
    renderView();

    await user.click(screen.getByRole("button", { name: "Create item" }));
    const dialog = screen.getByRole("dialog", { name: "Create project item" });
    const form = dialog.querySelector("form");
    const keyInput = form?.querySelector<HTMLInputElement>(
      'input[name="idempotencyKey"]',
    );
    await waitFor(() =>
      expect(keyInput?.value).toMatch(/^[A-Za-z0-9._:-]{8,200}$/),
    );
    await user.type(screen.getByLabelText(/Item key/i), "TASK-99");
    await user.type(screen.getByLabelText("Title"), "Confirm accessibility");
    const submittedKey = keyInput?.value;

    await user.click(within(dialog).getByRole("button", { name: "Create item" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Outcome unknown. Retry unchanged.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Create item" }));
    await waitFor(() =>
      expect(actionMocks.createProjectItemAction).toHaveBeenCalledTimes(2),
    );

    const firstAttempt = actionMocks.createProjectItemAction.mock.calls[0]?.[1];
    const secondAttempt = actionMocks.createProjectItemAction.mock.calls[1]?.[1];
    expect(firstAttempt).toBeInstanceOf(FormData);
    expect(secondAttempt).toBeInstanceOf(FormData);
    expect((firstAttempt as FormData).get("idempotencyKey")).toBe(submittedKey);
    expect((secondAttempt as FormData).get("idempotencyKey")).toBe(submittedKey);
    expect(Array.from((secondAttempt as FormData).entries())).toEqual(
      Array.from((firstAttempt as FormData).entries()),
    );
    expect(keyInput?.value).toBe(submittedKey);

    await user.click(within(dialog).getByRole("button", { name: "Create item" }));
    await within(dialog).findByRole("status");
    await waitFor(() => expect(keyInput?.value).not.toBe(submittedKey));
  });

  it("rotates the key when a refreshed server generation changes the hidden payload", async () => {
    const user = userEvent.setup();
    const view = renderView();

    await user.click(screen.getByRole("button", { name: "Create item" }));
    const dialog = screen.getByRole("dialog", { name: "Create project item" });
    const keyInput = dialog.querySelector<HTMLInputElement>(
      'input[name="idempotencyKey"]',
    );
    await waitFor(() =>
      expect(keyInput?.value).toMatch(/^[A-Za-z0-9._:-]{8,200}$/),
    );
    const originalKey = keyInput?.value;

    view.rerender(
      <ProjectItemsView
        canEdit
        items={items}
        memberOptions={memberOptions}
        projectId={projectId}
        workflowGeneration={workflowGeneration + 1}
      />,
    );

    expect(
      dialog.querySelector<HTMLInputElement>(
        'input[name="expectedWorkflowGeneration"]',
      ),
    ).toHaveValue(String(workflowGeneration + 1));
    await waitFor(() => expect(keyInput?.value).not.toBe(originalKey));
  });
});

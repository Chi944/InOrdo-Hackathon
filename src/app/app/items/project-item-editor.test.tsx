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
  updateProjectItemAction: vi.fn(),
}));

vi.mock("@/app/app/project-record-actions", () => actionMocks);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { ProjectItemEditor } from "@/app/app/items/project-item-editor";

afterEach(cleanup);

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  actionMocks.updateProjectItemAction.mockReset().mockResolvedValue({
    status: "conflict",
    message: "Conflict: The project changed. Refresh and try again.",
    idempotencyKeyDisposition: "rotate",
  });
});

describe("ProjectItemEditor", () => {
  it("renders no editor controls or server-action path for a read-only viewer", async () => {
    const user = userEvent.setup();
    render(
      <ProjectItemEditor
        canEdit={false}
        item={{
          id: "3e14b4a4-421d-4d6d-8a7e-01d5a22e3002",
          itemKey: "TASK-24",
          itemType: "task",
          title: "Confirm keynote speakers",
          description: "Reconfirm availability.",
          status: "blocked",
          priority: "high",
          ownerId: null,
          startDate: "2026-07-01",
          dueDate: "2026-07-18",
          eventDate: null,
          version: 7,
        }}
        memberOptions={[]}
        projectId="8d2baf13-b687-4987-83a0-0b1294b0f001"
        workflowGeneration={4}
      />,
    );

    const notice = screen.getByText(/Viewer access is read-only/i);
    expect(screen.queryByRole("button", { name: "Edit item" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /Edit TASK-24/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(notice);
    expect(actionMocks.updateProjectItemAction).not.toHaveBeenCalled();
  });

  it("submits generation-fenced edits and rotates the key after a stale conflict", async () => {
    const user = userEvent.setup();
    render(
      <ProjectItemEditor
        canEdit
        item={{
          id: "3e14b4a4-421d-4d6d-8a7e-01d5a22e3002",
          itemKey: "TASK-24",
          itemType: "task",
          title: "Confirm keynote speakers",
          description: "Reconfirm availability.",
          status: "blocked",
          priority: "high",
          ownerId: null,
          startDate: "2026-07-01",
          dueDate: "2026-07-18",
          eventDate: null,
          version: 7,
        }}
        memberOptions={[]}
        projectId="8d2baf13-b687-4987-83a0-0b1294b0f001"
        workflowGeneration={4}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit item" }));
    const dialog = screen.getByRole("dialog", { name: "Edit TASK-24" });
    const form = dialog.querySelector("form");
    expect(
      form?.querySelector<HTMLInputElement>(
        'input[name="expectedWorkflowGeneration"]',
      ),
    ).toHaveValue("4");
    const keyInput = form?.querySelector<HTMLInputElement>(
      'input[name="idempotencyKey"]',
    );
    await waitFor(() =>
      expect(keyInput?.value).toMatch(/^[A-Za-z0-9._:-]{8,200}$/),
    );
    const initialKey = keyInput?.value;
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Confirm all speakers");
    expect(keyInput?.value).not.toBe(initialKey);
    const submittedKey = keyInput?.value;

    await user.click(screen.getByRole("button", { name: "Save item" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Refresh required\.\s*Conflict: The project changed\. Refresh and try again\./,
    );
    await waitFor(() => expect(keyInput?.value).not.toBe(submittedKey));
    expect(dialog).toHaveAttribute("open");

    const submittedForm = actionMocks.updateProjectItemAction.mock.calls[0]?.[1];
    expect(submittedForm).toBeInstanceOf(FormData);
    expect((submittedForm as FormData).get("expectedWorkflowGeneration")).toBe(
      "4",
    );
    expect((submittedForm as FormData).get("idempotencyKey")).toBe(submittedKey);
  });

  it("keeps every edit control and dialog exit locked while the update is pending", async () => {
    let resolveUpdate:
      | ((value: {
          status: "error";
          message: string;
          idempotencyKeyDisposition: "retain";
        }) => void)
      | undefined;
    actionMocks.updateProjectItemAction.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    const user = userEvent.setup();
    render(
      <ProjectItemEditor
        canEdit
        item={{
          id: "3e14b4a4-421d-4d6d-8a7e-01d5a22e3002",
          itemKey: "TASK-24",
          itemType: "task",
          title: "Confirm keynote speakers",
          description: "Reconfirm availability.",
          status: "blocked",
          priority: "high",
          ownerId: null,
          startDate: "2026-07-01",
          dueDate: "2026-07-18",
          eventDate: null,
          version: 7,
        }}
        memberOptions={[
          {
            id: "b993a2d1-8060-4c96-a7d0-e79f4cd43303",
            name: "Leo Tan",
          },
        ]}
        projectId="8d2baf13-b687-4987-83a0-0b1294b0f001"
        workflowGeneration={4}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit item" }));
    const dialog = screen.getByRole("dialog", { name: "Edit TASK-24" });
    const form = dialog.querySelector("form");
    await user.clear(within(dialog).getByLabelText("Title"));
    await user.type(within(dialog).getByLabelText("Title"), "Confirm all speakers");
    await user.selectOptions(within(dialog).getByLabelText("Type"), "event");
    await user.type(within(dialog).getByLabelText("Event date"), "2026-09-26");

    await user.click(within(dialog).getByRole("button", { name: "Save item" }));

    await waitFor(() => expect(form).toHaveAttribute("aria-busy", "true"));
    for (const label of [
      "Item key",
      "Type",
      "Title",
      "Description or rationale",
      "Status",
      "Priority",
      "Assignee",
      "Start date",
      "Due date",
      "Event date",
    ]) {
      expect(within(dialog).getByLabelText(label)).toBeDisabled();
    }
    expect(
      within(dialog).getByRole("button", { name: "Close edit item dialog" }),
    ).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: /Saving item/ }),
    ).toBeDisabled();

    const submittedForm = actionMocks.updateProjectItemAction.mock.calls[0]?.[1];
    expect(submittedForm).toBeInstanceOf(FormData);
    expect((submittedForm as FormData).get("expectedWorkflowGeneration")).toBe(
      "4",
    );
    expect((submittedForm as FormData).get("idempotencyKey")).toMatch(
      /^[A-Za-z0-9._:-]{8,200}$/,
    );

    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
    expect(dialog).toHaveAttribute("open");

    await act(async () => {
      resolveUpdate?.({
        status: "error",
        message: "Outcome unknown. Retry unchanged.",
        idempotencyKeyDisposition: "retain",
      });
      await Promise.resolve();
    });
    await waitFor(() => expect(form).toHaveAttribute("aria-busy", "false"));
    expect(within(dialog).getByLabelText("Title")).toHaveValue(
      "Confirm all speakers",
    );
    expect(within(dialog).getByLabelText("Event date")).toHaveValue(
      "2026-09-26",
    );
  });

  it("reuses the submitted key and payload for an ambiguous update retry, then rotates", async () => {
    const user = userEvent.setup();
    actionMocks.updateProjectItemAction
      .mockResolvedValueOnce({
        status: "error",
        message: "Outcome unknown. Retry unchanged.",
        idempotencyKeyDisposition: "retain",
      })
      .mockResolvedValueOnce({
        status: "conflict",
        message: "The item changed. Refresh and try again.",
        idempotencyKeyDisposition: "rotate",
      });
    render(
      <ProjectItemEditor
        canEdit
        item={{
          id: "3e14b4a4-421d-4d6d-8a7e-01d5a22e3002",
          itemKey: "TASK-24",
          itemType: "task",
          title: "Confirm keynote speakers",
          description: "Reconfirm availability.",
          status: "blocked",
          priority: "high",
          ownerId: null,
          startDate: "2026-07-01",
          dueDate: "2026-07-18",
          eventDate: null,
          version: 7,
        }}
        memberOptions={[]}
        projectId="8d2baf13-b687-4987-83a0-0b1294b0f001"
        workflowGeneration={4}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit item" }));
    const dialog = screen.getByRole("dialog", { name: "Edit TASK-24" });
    const keyInput = dialog.querySelector<HTMLInputElement>(
      'input[name="idempotencyKey"]',
    );
    await waitFor(() =>
      expect(keyInput?.value).toMatch(/^[A-Za-z0-9._:-]{8,200}$/),
    );
    await user.clear(within(dialog).getByLabelText("Title"));
    await user.type(within(dialog).getByLabelText("Title"), "Confirm all speakers");
    const submittedKey = keyInput?.value;

    await user.click(within(dialog).getByRole("button", { name: "Save item" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Outcome unknown. Retry unchanged.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Save item" }));
    await waitFor(() =>
      expect(actionMocks.updateProjectItemAction).toHaveBeenCalledTimes(2),
    );

    const firstAttempt = actionMocks.updateProjectItemAction.mock.calls[0]?.[1];
    const secondAttempt = actionMocks.updateProjectItemAction.mock.calls[1]?.[1];
    expect(firstAttempt).toBeInstanceOf(FormData);
    expect(secondAttempt).toBeInstanceOf(FormData);
    expect(Array.from((secondAttempt as FormData).entries())).toEqual(
      Array.from((firstAttempt as FormData).entries()),
    );
    expect((secondAttempt as FormData).get("idempotencyKey")).toBe(submittedKey);
    await waitFor(() => expect(keyInput?.value).not.toBe(submittedKey));
  });
});

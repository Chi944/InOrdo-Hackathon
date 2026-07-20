import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/app/project-record-actions", () => ({
  createDependencyAction: vi.fn(async () => ({
    status: "success",
    message: "Dependency added.",
    idempotencyKeyDisposition: "rotate",
  })),
  removeDependencyAction: vi.fn(async () => ({
    status: "success",
    message: "Dependency removed.",
    idempotencyKeyDisposition: "rotate",
  })),
}));

import {
  DependencyView,
  type DependencyViewEdge,
  type DependencyViewItem,
} from "@/app/app/dependencies/dependency-view";
import {
  createDependencyAction,
  removeDependencyAction,
} from "@/app/app/project-record-actions";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
const workflowGeneration = 4;
const items: DependencyViewItem[] = [
  {
    id: "3e14b4a4-421d-4d6d-8a7e-01d5a22e3002",
    itemKey: "DEC-01",
    title: "Confirm venue",
    itemType: "decision",
    status: "completed",
  },
  {
    id: "b993a2d1-8060-4c96-a7d0-e79f4cd43303",
    itemKey: "CAM-02",
    title: "Prepare invitations",
    itemType: "task",
    status: "in_progress",
  },
  {
    id: "05251673-dbdc-4cc5-a302-568f523997aa",
    itemKey: "ART-03",
    title: "Publish run sheet",
    itemType: "artifact",
    status: "not_started",
  },
];
const dependencies: DependencyViewEdge[] = [
  {
    id: "4db0760c-d441-4b39-845d-f011b3e14404",
    fromItemId: items[1].id,
    toItemId: items[0].id,
    relationship: "requires",
    rationale: "Invitations need a confirmed location.",
  },
  {
    id: "570dfb9f-691b-45b0-b735-47e1475da5e5",
    fromItemId: items[2].id,
    toItemId: items[1].id,
    relationship: "informs",
    rationale: "The final guest plan informs event operations.",
  },
];

describe("DependencyView", () => {
  it("labels dependency direction from dependent to upstream in both item sections", () => {
    render(
      <DependencyView
        canEdit
        dependencies={dependencies}
        initialSelectedItemId={items[1].id}
        items={items}
        projectId={projectId}
        workflowGeneration={workflowGeneration}
      />,
    );

    const dependsOn = screen.getByRole("heading", { name: "Depends on" }).closest("section");
    const affects = screen.getByRole("heading", { name: "Affects" }).closest("section");

    expect(dependsOn).not.toBeNull();
    expect(affects).not.toBeNull();
    expect(within(dependsOn!).getByText("Prepare invitations depends on Confirm venue")).toBeInTheDocument();
    expect(within(affects!).getByText("Publish run sheet depends on Prepare invitations")).toBeInTheDocument();
    expect(within(dependsOn!).getByText(/invitations need a confirmed location/i)).toBeInTheDocument();
  });

  it("filters the selectable item list and changes the inspected item", () => {
    render(
      <DependencyView
        canEdit
        dependencies={dependencies}
        items={items}
        projectId={projectId}
        workflowGeneration={workflowGeneration}
      />,
    );
    const itemList = screen.getByRole("list", { name: "Project items" });

    fireEvent.change(screen.getByLabelText("Search project items"), {
      target: { value: "run sheet" },
    });

    expect(within(itemList).getByRole("button", { name: /select art-03/i })).toBeInTheDocument();
    expect(within(itemList).queryByRole("button", { name: /select dec-01/i })).not.toBeInTheDocument();

    fireEvent.click(within(itemList).getByRole("button", { name: /select art-03/i }));
    expect(screen.getByRole("heading", { name: "Publish run sheet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /select art-03/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps dependency mutations unavailable to viewers while preserving navigation", () => {
    render(
      <DependencyView
        canEdit={false}
        dependencies={dependencies}
        items={items}
        projectId={projectId}
        workflowGeneration={workflowGeneration}
      />,
    );

    expect(screen.getByText("Read-only access")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add relationship" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove relationship/i })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Dependency graph" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search project items"), {
      target: { value: "run sheet" },
    });
    fireEvent.click(screen.getByRole("button", { name: /select art-03/i }));
    expect(screen.getByRole("heading", { name: "Publish run sheet" })).toBeInTheDocument();
    expect(createDependencyAction).not.toHaveBeenCalled();
    expect(removeDependencyAction).not.toHaveBeenCalled();
  });

  it("opens labeled add and remove confirmation forms", async () => {
    render(
      <DependencyView
        canEdit
        dependencies={dependencies}
        initialSelectedItemId={items[1].id}
        items={items}
        projectId={projectId}
        workflowGeneration={workflowGeneration}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add relationship" }));
    const addDialog = screen.getByRole("dialog", { name: "Add a relationship" });
    expect(within(addDialog).getByLabelText("Dependent item")).toHaveAttribute(
      "name",
      "fromItemId",
    );
    expect(within(addDialog).getByLabelText("Upstream prerequisite")).toHaveAttribute(
      "name",
      "toItemId",
    );
    expect(within(addDialog).getByLabelText("Relationship")).toHaveAttribute(
      "name",
      "relationship",
    );
    expect(within(addDialog).getByLabelText("Rationale (optional)")).toHaveAttribute(
      "maxlength",
      "2000",
    );
    fireEvent.click(
      within(addDialog).getByRole("button", {
        name: "Close add relationship dialog",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove relationship: Prepare invitations depends on Confirm venue",
      }),
    );
    const removeDialog = screen.getByRole("dialog", {
      name: "Remove relationship?",
    });
    expect(
      within(removeDialog).getByText(
        /remove the explicit edge “prepare invitations depends on confirm venue”/i,
      ),
    ).toBeInTheDocument();
    expect(
      within(removeDialog).getByRole("button", { name: "Confirm removal" }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(removeDialog).getByRole("button", { name: "Confirm removal" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Dependency removed.",
    );
  });

  it("keeps the add relationship dialog mounted and locked while its server action is pending", async () => {
    let resolveCreate: ((value: {
      status: "success";
      message: string;
      idempotencyKeyDisposition: "rotate";
    }) => void) | undefined;
    vi.mocked(createDependencyAction).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );
    render(
      <DependencyView
        canEdit
        dependencies={dependencies}
        initialSelectedItemId={items[1].id}
        items={items}
        projectId={projectId}
        workflowGeneration={workflowGeneration}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add relationship" }));
    const addDialog = screen.getByRole("dialog", { name: "Add a relationship" });
    const form = addDialog.querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.click(
      within(addDialog).getByRole("button", { name: "Add relationship" }),
    );

    await waitFor(() => expect(form).toHaveAttribute("aria-busy", "true"));
    expect(
      within(addDialog).getByRole("button", {
        name: "Close add relationship dialog",
      }),
    ).toBeDisabled();
    expect(within(addDialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(within(addDialog).getByLabelText("Dependent item")).toBeDisabled();

    fireEvent.keyDown(addDialog, { key: "Escape" });
    fireEvent.mouseDown(addDialog.parentElement!);
    expect(
      screen.getByRole("dialog", { name: "Add a relationship" }),
    ).toBeVisible();

    await act(async () => {
      resolveCreate?.({
        status: "success",
        message: "Dependency added.",
        idempotencyKeyDisposition: "rotate",
      });
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Add a relationship" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("includes the workflow generation and distinct portable keys in add and remove forms", async () => {
    render(
      <DependencyView
        canEdit
        dependencies={dependencies}
        initialSelectedItemId={items[1].id}
        items={items}
        projectId={projectId}
        workflowGeneration={workflowGeneration}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add relationship" }));
    const addDialog = screen.getByRole("dialog", { name: "Add a relationship" });
    const addForm = addDialog.querySelector("form");
    const addGeneration = addForm?.querySelector<HTMLInputElement>(
      'input[name="expectedWorkflowGeneration"]',
    );
    const addKey = addForm?.querySelector<HTMLInputElement>(
      'input[name="idempotencyKey"]',
    );
    expect(addGeneration).toHaveValue(String(workflowGeneration));
    await waitFor(() =>
      expect(addKey?.value).toMatch(/^[A-Za-z0-9._:-]{8,200}$/),
    );
    const initialAddKey = addKey?.value;
    fireEvent.change(within(addDialog).getByLabelText("Rationale (optional)"), {
      target: { value: "A changed mutation payload." },
    });
    expect(addKey?.value).not.toBe(initialAddKey);
    const rotatedAddKey = addKey?.value;
    fireEvent.click(
      within(addDialog).getByRole("button", {
        name: "Close add relationship dialog",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove relationship: Prepare invitations depends on Confirm venue",
      }),
    );
    const removeDialog = screen.getByRole("dialog", {
      name: "Remove relationship?",
    });
    const removeForm = removeDialog.querySelector("form");
    expect(
      removeForm?.querySelector<HTMLInputElement>(
        'input[name="expectedWorkflowGeneration"]',
      ),
    ).toHaveValue(String(workflowGeneration));
    const removeKey = removeForm?.querySelector<HTMLInputElement>(
      'input[name="idempotencyKey"]',
    );
    await waitFor(() =>
      expect(removeKey?.value).toMatch(/^[A-Za-z0-9._:-]{8,200}$/),
    );
    expect(removeKey?.value).not.toBe(rotatedAddKey);
  });

  it("reuses the submitted key and payload for an ambiguous add retry, then rotates", async () => {
    vi.mocked(createDependencyAction)
      .mockResolvedValueOnce({
        status: "error",
        message: "Outcome unknown. Retry unchanged.",
        idempotencyKeyDisposition: "retain",
      })
      .mockResolvedValueOnce({
        status: "conflict",
        message: "The project changed. Refresh and try again.",
        idempotencyKeyDisposition: "rotate",
      });
    render(
      <DependencyView
        canEdit
        dependencies={dependencies}
        initialSelectedItemId={items[1].id}
        items={items}
        projectId={projectId}
        workflowGeneration={workflowGeneration}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add relationship" }));
    const dialog = screen.getByRole("dialog", { name: "Add a relationship" });
    const keyInput = dialog.querySelector<HTMLInputElement>(
      'input[name="idempotencyKey"]',
    );
    await waitFor(() =>
      expect(keyInput?.value).toMatch(/^[A-Za-z0-9._:-]{8,200}$/),
    );
    fireEvent.change(within(dialog).getByLabelText("Relationship"), {
      target: { value: "informs" },
    });
    fireEvent.change(within(dialog).getByLabelText("Rationale (optional)"), {
      target: { value: "The confirmed venue informs the invitation plan." },
    });
    const submittedKey = keyInput?.value;

    fireEvent.click(within(dialog).getByRole("button", { name: "Add relationship" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Outcome unknown. Retry unchanged.",
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Add relationship" }));
    await waitFor(() =>
      expect(vi.mocked(createDependencyAction)).toHaveBeenCalledTimes(2),
    );

    const firstAttempt = vi.mocked(createDependencyAction).mock.calls[0]?.[1];
    const secondAttempt = vi.mocked(createDependencyAction).mock.calls[1]?.[1];
    expect(firstAttempt).toBeInstanceOf(FormData);
    expect(secondAttempt).toBeInstanceOf(FormData);
    expect(Array.from((secondAttempt as FormData).entries())).toEqual(
      Array.from((firstAttempt as FormData).entries()),
    );
    expect((secondAttempt as FormData).get("idempotencyKey")).toBe(submittedKey);
    await waitFor(() => expect(keyInput?.value).not.toBe(submittedKey));
  });

  it("reuses the submitted key and payload for an ambiguous removal retry, then rotates", async () => {
    vi.mocked(removeDependencyAction)
      .mockResolvedValueOnce({
        status: "error",
        message: "Outcome unknown. Retry unchanged.",
        idempotencyKeyDisposition: "retain",
      })
      .mockResolvedValueOnce({
        status: "conflict",
        message: "The project changed. Refresh and try again.",
        idempotencyKeyDisposition: "rotate",
      });
    render(
      <DependencyView
        canEdit
        dependencies={dependencies}
        initialSelectedItemId={items[1].id}
        items={items}
        projectId={projectId}
        workflowGeneration={workflowGeneration}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove relationship: Prepare invitations depends on Confirm venue",
      }),
    );
    const dialog = screen.getByRole("dialog", { name: "Remove relationship?" });
    const keyInput = dialog.querySelector<HTMLInputElement>(
      'input[name="idempotencyKey"]',
    );
    await waitFor(() =>
      expect(keyInput?.value).toMatch(/^[A-Za-z0-9._:-]{8,200}$/),
    );
    const submittedKey = keyInput?.value;

    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm removal" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Outcome unknown. Retry unchanged.",
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm removal" }));
    await waitFor(() =>
      expect(vi.mocked(removeDependencyAction)).toHaveBeenCalledTimes(2),
    );

    const firstAttempt = vi.mocked(removeDependencyAction).mock.calls[0]?.[1];
    const secondAttempt = vi.mocked(removeDependencyAction).mock.calls[1]?.[1];
    expect(firstAttempt).toBeInstanceOf(FormData);
    expect(secondAttempt).toBeInstanceOf(FormData);
    expect(Array.from((secondAttempt as FormData).entries())).toEqual(
      Array.from((firstAttempt as FormData).entries()),
    );
    expect((secondAttempt as FormData).get("idempotencyKey")).toBe(submittedKey);
    await waitFor(() => expect(keyInput?.value).not.toBe(submittedKey));
  });
});

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/app/project-record-actions", () => ({
  createDependencyAction: vi.fn(async () => ({
    status: "success",
    message: "Dependency added.",
  })),
  removeDependencyAction: vi.fn(async () => ({
    status: "success",
    message: "Dependency removed.",
  })),
}));

import {
  DependencyView,
  type DependencyViewEdge,
  type DependencyViewItem,
} from "@/app/app/dependencies/dependency-view";

afterEach(cleanup);

const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
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

  it("keeps dependency mutations unavailable to viewers", () => {
    render(
      <DependencyView
        canEdit={false}
        dependencies={dependencies}
        items={items}
        projectId={projectId}
      />,
    );

    expect(screen.getByText("Read-only access")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add relationship" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove relationship/i })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Dependency graph" })).toBeInTheDocument();
  });

  it("opens labeled add and remove confirmation forms", async () => {
    render(
      <DependencyView
        canEdit
        dependencies={dependencies}
        initialSelectedItemId={items[1].id}
        items={items}
        projectId={projectId}
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
});

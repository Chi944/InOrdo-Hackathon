import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/app/project-record-actions", () => ({
  createProjectItemAction: vi.fn(),
  updateProjectItemAction: vi.fn(),
  createDependencyAction: vi.fn(),
  removeDependencyAction: vi.fn(),
}));

import { ProjectRecordControls } from "@/app/app/project-record-controls";

afterEach(cleanup);

const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
const items = [
  {
    id: "3e14b4a4-421d-4d6d-8a7e-01d5a22e3002",
    itemKey: "OPS-12",
    title: "Confirm venue",
    status: "not_started" as const,
    version: 2,
  },
  {
    id: "b993a2d1-8060-4c96-a7d0-e79f4cd43303",
    itemKey: "OPS-13",
    title: "Prepare invitations",
    status: "in_progress" as const,
    version: 4,
  },
];
const dependencies = [
  {
    id: "4db0760c-d441-4b39-845d-f011b3e14404",
    fromItemId: items[1].id,
    toItemId: items[0].id,
    relationship: "requires" as const,
  },
];

describe("ProjectRecordControls", () => {
  it("renders real record and dependency forms for contributors", () => {
    render(
      <ProjectRecordControls
        canEdit
        dependencies={dependencies}
        items={items}
        projectId={projectId}
      />,
    );

    expect(screen.getByRole("button", { name: "Create item" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update item" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add dependency" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove OPS-13 requires OPS-12" })).toBeInTheDocument();
  });

  it("keeps mutation controls unavailable for viewers", () => {
    render(
      <ProjectRecordControls
        canEdit={false}
        dependencies={dependencies}
        items={items}
        projectId={projectId}
      />,
    );

    expect(screen.getByText(/viewer access is read-only/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create item" })).not.toBeInTheDocument();
  });

  it("resets an edited status when a refreshed item version arrives", () => {
    const { container, rerender } = render(
      <ProjectRecordControls
        canEdit
        dependencies={dependencies}
        items={items}
        projectId={projectId}
      />,
    );
    const statusSelect = screen.getAllByLabelText("Status")[1];

    fireEvent.change(statusSelect, { target: { value: "blocked" } });
    expect(statusSelect).toHaveValue("blocked");

    rerender(
      <ProjectRecordControls
        canEdit
        dependencies={dependencies}
        items={[
          { ...items[0], status: "in_progress", version: 3 },
          items[1],
        ]}
        projectId={projectId}
      />,
    );

    expect(screen.getAllByLabelText("Status")[1]).toHaveValue("in_progress");
    expect(
      container.querySelector<HTMLInputElement>('input[name="expectedVersion"]'),
    ).toHaveValue("3");
  });
});

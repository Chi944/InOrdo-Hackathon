import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  DecisionRecords,
  RiskRecords,
  type FocusedProjectItem,
} from "@/app/app/focused-records";
import { GuidedDemoCallout } from "@/app/app/guided-demo-callout";

afterEach(cleanup);

const decision: FocusedProjectItem = {
  id: "decision-1",
  itemKey: "DEC-01",
  itemType: "decision",
  title: "Approve venue contract",
  description: null,
  status: "completed",
  priority: "critical",
  ownerName: "Samira Okafor",
  dueDate: "2026-05-15",
};

const openRisk: FocusedProjectItem = {
  id: "risk-1",
  itemKey: "RSK-01",
  itemType: "risk",
  title: "Venue availability changes",
  description: "Track changes to the confirmed venue and date.",
  status: "at_risk",
  priority: "critical",
  ownerName: "Elena Torres",
  dueDate: "2026-09-12",
  metadata: { likelihood: "medium", impact: "critical" },
};

describe("focused project records", () => {
  it("states honestly when a decision rationale is missing", () => {
    render(
      <DecisionRecords
        dependencies={[
          {
            id: "dependency-1",
            fromItemId: "risk-1",
            toItemId: decision.id,
            relationship: "informs",
            rationale: "The contract decision informs venue risk.",
          },
        ]}
        itemHrefPrefix="/app/items"
        items={[decision]}
      />,
    );

    expect(screen.getByText("Decision rationale not recorded.")).toBeInTheDocument();
    expect(screen.getByText("The contract decision informs venue risk.")).toBeInTheDocument();
  });

  it("shows only risks that remain open", () => {
    render(
      <RiskRecords
        dependencies={[]}
        itemHrefPrefix="/app/items"
        items={[
          openRisk,
          {
            ...openRisk,
            id: "risk-2",
            itemKey: "RSK-02",
            title: "Resolved speaker risk",
            status: "completed",
          },
          {
            ...decision,
            id: "decision-2",
            title: "Unrelated decision",
          },
          {
            ...openRisk,
            id: "task-1",
            itemKey: "TSK-10",
            itemType: "task",
            title: "Blocked venue handoff",
            status: "blocked",
          },
        ]}
      />,
    );

    expect(screen.getByText("Venue availability changes")).toBeInTheDocument();
    expect(screen.queryByText("Resolved speaker risk")).not.toBeInTheDocument();
    expect(screen.queryByText("Unrelated decision")).not.toBeInTheDocument();
    expect(screen.getByText("Blocked venue handoff")).toBeInTheDocument();
    expect(screen.getByText(/showing 2 active records/i)).toBeInTheDocument();
  });
});

describe("GuidedDemoCallout", () => {
  const targets = [
    {
      itemId: "event-1",
      itemKey: "EVT-01",
      title: "Regional Climate Action Summit 2026",
      href: "/app/items/event-1",
    },
  ];

  it("labels the workspace as synthetic and links passed records", () => {
    render(<GuidedDemoCallout targets={targets} />);

    expect(screen.getByText(/guided demo · synthetic data/i)).toBeInTheDocument();
    expect(screen.getByText(/contains no customer data/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Open EVT-01: Regional Climate Action Summit 2026",
      }),
    ).toHaveAttribute("href", "/app/items/event-1");
  });

  it("can be dismissed without opening a modal", () => {
    render(<GuidedDemoCallout targets={targets} />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss guided demo" }));

    expect(screen.queryByRole("heading", { name: "Follow the summit plan" })).not.toBeInTheDocument();
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OrdinaryProjectNotice } from "@/app/app/projects/ordinary/ordinary-project-notice";

afterEach(cleanup);

const approvedLimitation =
  "InOrdo's records and authorization are project-scoped. Creating and using ordinary team workspaces is not available in this Build Week demo. This informational preview is intentionally separate from the live synthetic summit workspace.";

describe("OrdinaryProjectNotice", () => {
  it("shows the approved project limitation exactly", () => {
    render(<OrdinaryProjectNotice />);

    expect(screen.getByText(approvedLimitation)).toBeInTheDocument();
  });

  it("offers navigation without fake project controls", () => {
    render(<OrdinaryProjectNotice />);

    expect(
      screen.getByRole("link", { name: /back to projects/i }),
    ).toHaveAttribute("href", "/app/projects");
    expect(
      screen.getByRole("link", { name: /open synthetic project/i }),
    ).toHaveAttribute("href", "/app");
    expect(
      screen.queryByRole("button", { name: /create|invite|import|switch/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });
});

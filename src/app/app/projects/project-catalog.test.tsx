import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProjectCatalog } from "@/app/app/projects/project-catalog";

afterEach(cleanup);

describe("ProjectCatalog", () => {
  it("links to the available synthetic project and the ordinary project preview", () => {
    render(
      <ProjectCatalog
        demoProject={{
          name: "Regional Climate Action Summit 2026",
          description: "Synthetic planning workspace.",
          itemCount: 24,
        }}
      />,
    );

    expect(
      screen.getByRole("link", { name: /open synthetic project/i }),
    ).toHaveAttribute("href", "/app");
    expect(
      screen.getByRole("link", { name: /ordinary project preview/i }),
    ).toHaveAttribute("href", "/app/projects/ordinary");
    expect(screen.getByText("24 canonical records")).toBeInTheDocument();
    expect(screen.getByText("Synthetic planning workspace.")).toBeInTheDocument();
  });

  it("does not present unavailable project mutations or imports", () => {
    render(
      <ProjectCatalog
        demoProject={{
          name: "Regional Climate Action Summit 2026",
          description: null,
          itemCount: 24,
        }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /create|invite|import/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

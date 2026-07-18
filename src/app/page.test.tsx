import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("InOrdo landing shell", () => {
  it("links to the protected demo without claiming unfinished workflows", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /project change without the chain reaction/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Demo workspace coming online",
    );
    expect(
      screen.getByRole("link", { name: "Open demo workspace" }),
    ).toHaveAttribute("href", "/app");
    expect(screen.getByRole("status")).toHaveTextContent(
      /AI workflow and mutation path are still being built/i,
    );
    expect(screen.getByText("Evidence", { selector: "h3" })).toBeVisible();
    expect(screen.getByText("Human approval", { selector: "h3" })).toBeVisible();
  });
});

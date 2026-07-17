import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("InOrdo landing shell", () => {
  it("presents an honest unavailable demo state", () => {
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
      screen.getByRole("button", { name: "Open demo workspace" }),
    ).toBeDisabled();
    expect(screen.getByText("Evidence", { selector: "h3" })).toBeVisible();
    expect(screen.getByText("Human approval", { selector: "h3" })).toBeVisible();
  });
});

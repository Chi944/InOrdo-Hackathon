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
      "Protected review workspace connected",
    );
    expect(
      screen.getByRole("link", { name: "Open demo workspace" }),
    ).toHaveAttribute("href", "/app");
    expect(screen.getByRole("status")).toHaveTextContent(
      /live results remain environment- and backend-state dependent/i,
    );
    expect(screen.getByText("Evidence", { selector: "h3" })).toBeVisible();
    expect(screen.getByText("Human approval", { selector: "h3" })).toBeVisible();
  });

  it("keeps the public recovery claim provider-neutral", () => {
    render(<Home />);

    const recoveryHeadings = screen.getAllByText("Recovery draft", {
      selector: "h3",
    });
    const recoveryStep = recoveryHeadings.at(-1)?.closest("li");

    expect(recoveryStep).toHaveTextContent(
      "Use the configured bounded server-side provider to draft recovery actions, never to decide what runs.",
    );
    expect(recoveryStep).not.toHaveTextContent(
      /GPT-5\.6|GPT-OSS|OpenAI|AI Gateway/i,
    );
  });
});

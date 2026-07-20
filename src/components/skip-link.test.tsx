import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SkipLink } from "@/components/skip-link";

describe("SkipLink", () => {
  it("moves keyboard focus to the main content target", async () => {
    const user = userEvent.setup();

    render(
      <>
        <SkipLink />
        <main id="main-content">Project workspace</main>
      </>,
    );

    await user.click(screen.getByRole("link", { name: "Skip to main content" }));

    expect(screen.getByRole("main")).toHaveFocus();
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
  });
});

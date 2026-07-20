import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  pathname: "/app/projects/ordinary",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

import { ProjectNavigation } from "@/app/app/project-navigation";

afterEach(cleanup);

describe("ProjectNavigation", () => {
  it("marks only Projects current for nested project routes", () => {
    render(<ProjectNavigation />);

    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getAllByRole("link", { current: "page" })).toHaveLength(1);
  });
});

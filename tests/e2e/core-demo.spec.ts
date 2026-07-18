import { expect, test, type Page, type Route } from "@playwright/test";

import { analyzeProjectRequestSchema } from "../../src/features/analysis/request-schemas";
import {
  applyProposalRequestSchema,
  resetDemoRequestSchema,
  undoOperationRequestSchema,
} from "../../src/features/operations/request-schemas";
import { coreDemoFixtureIds } from "../../src/lib/e2e/core-demo-contract";
import {
  coreDemoStageCookieName,
  type CoreDemoStage,
} from "../../src/lib/e2e/core-demo-stage";

type ObservedRequest = "analyze" | "apply" | "undo" | "reset";

async function setFixtureStage(
  page: Page,
  requestUrl: string,
  stage: CoreDemoStage,
) {
  await page.context().addCookies([
    {
      name: coreDemoStageCookieName,
      value: stage,
      url: new URL(requestUrl).origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function rejectUnexpected(route: Route) {
  await route.abort("blockedbyclient");
}

test.describe.serial("InOrdo core demo journey", () => {
  test("moves from evidence to selective approval, audit, undo, and reset", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const contractErrors: string[] = [];
    const observedRequests: ObservedRequest[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    await page.route("**/api/projects/**", async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;

      if (request.method() !== "POST") {
        contractErrors.push(`Unexpected ${request.method()} ${pathname}`);
        await rejectUnexpected(route);
        return;
      }

      let rawBody: unknown;
      try {
        rawBody = request.postDataJSON() as unknown;
      } catch {
        contractErrors.push(`POST ${pathname} did not contain valid JSON.`);
        await route.fulfill({
          status: 400,
          json: { error: { message: "Invalid test request" } },
        });
        return;
      }

      if (
        pathname ===
        `/api/projects/${coreDemoFixtureIds.project}/analyze`
      ) {
        observedRequests.push("analyze");
        const parsed = analyzeProjectRequestSchema.safeParse(rawBody);
        if (!parsed.success) {
          contractErrors.push(`Analyze request failed schema validation: ${parsed.error.message}`);
          await route.fulfill({ status: 422, json: { error: { message: "Invalid test request" } } });
          return;
        }
        if (
          parsed.data.maxDepth !== 5 ||
          !parsed.data.source.text.includes("26 September 2026")
        ) {
          contractErrors.push("Analyze request did not preserve the seeded source contract.");
        }
        await setFixtureStage(page, request.url(), "analyzed");
        await route.fulfill({
          status: 201,
          json: {
            analysisRequestId: coreDemoFixtureIds.analysis,
            proposalId: coreDemoFixtureIds.proposal,
            duplicate: false,
          },
        });
        return;
      }

      if (
        pathname ===
        `/api/projects/${coreDemoFixtureIds.project}/proposals/${coreDemoFixtureIds.proposal}/apply`
      ) {
        observedRequests.push("apply");
        const parsed = applyProposalRequestSchema.safeParse(rawBody);
        if (!parsed.success) {
          contractErrors.push(`Apply request failed schema validation: ${parsed.error.message}`);
          await route.fulfill({ status: 422, json: { error: { message: "Invalid test request" } } });
          return;
        }
        if (
          parsed.data.selectedActionIds.length !== 1 ||
          parsed.data.selectedActionIds[0] !== coreDemoFixtureIds.safeAction ||
          parsed.data.humanInputs.length !== 0
        ) {
          contractErrors.push("Selective approval sent an unexpected action selection.");
        }
        await setFixtureStage(page, request.url(), "applied");
        await route.fulfill({
          status: 201,
          json: {
            operationId: coreDemoFixtureIds.applyOperation,
            appliedActionIds: [coreDemoFixtureIds.safeAction],
            duplicate: false,
          },
        });
        return;
      }

      if (
        pathname ===
        `/api/projects/${coreDemoFixtureIds.project}/operations/${coreDemoFixtureIds.applyOperation}/undo`
      ) {
        observedRequests.push("undo");
        const parsed = undoOperationRequestSchema.safeParse(rawBody);
        if (!parsed.success) {
          contractErrors.push(`Undo request failed schema validation: ${parsed.error.message}`);
          await route.fulfill({ status: 422, json: { error: { message: "Invalid test request" } } });
          return;
        }
        await setFixtureStage(page, request.url(), "undone");
        await route.fulfill({
          status: 201,
          json: {
            operationId: coreDemoFixtureIds.undoOperation,
            duplicate: false,
          },
        });
        return;
      }

      if (
        pathname ===
        `/api/projects/${coreDemoFixtureIds.project}/demo/reset`
      ) {
        observedRequests.push("reset");
        const parsed = resetDemoRequestSchema.safeParse(rawBody);
        if (!parsed.success) {
          contractErrors.push(`Reset request failed schema validation: ${parsed.error.message}`);
          await route.fulfill({ status: 422, json: { error: { message: "Invalid test request" } } });
          return;
        }
        const resetKeys = Object.keys(parsed.data).sort().join(",");
        if (resetKeys !== "confirmed,idempotencyKey") {
          contractErrors.push("Reset request contained a field outside the public reset contract.");
        }
        await setFixtureStage(page, request.url(), "baseline");
        await route.fulfill({
          status: 201,
          json: {
            operationId: coreDemoFixtureIds.resetOperation,
            duplicate: false,
          },
        });
        return;
      }

      contractErrors.push(`Unexpected POST ${pathname}`);
      await rejectUnexpected(route);
    });

    await page.goto("/__e2e__/core-demo", { waitUntil: "networkidle" });

    await expect(
      page.getByText("CI-only synthetic fixture — no live Supabase/OpenAI result"),
    ).toBeVisible();
    await expect(page.getByText("No analysis result yet")).toBeVisible();
    await expect(page.getByText("No audit operations yet")).toBeVisible();

    await test.step("preserve and analyze a source update", async () => {
      await page.getByRole("button", { name: "Insert seeded demo update" }).click();
      await expect(page.getByLabel("Source title")).toHaveValue(
        "Venue update — summit date",
      );
      await expect(page.getByLabel("Source text")).toHaveValue(
        /26 September 2026/,
      );
      await page.getByRole("button", { name: "Analyze change" }).click();

      await expect(
        page.getByRole("heading", { name: "Venue update — summit date" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "EVT-01 — Regional Climate Action Summit 2026",
        }),
      ).toBeVisible();
      await expect(page.getByText("2026-09-12", { exact: true })).toBeVisible();
      await expect(page.getByText("2026-09-26", { exact: true })).toBeVisible();
    });

    await test.step("show deterministic direct and indirect paths", async () => {
      await expect(
        page.getByRole("heading", { name: "Direct impacts", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Indirect impacts", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByLabel("Dependency path to Confirm keynote speakers"),
      ).toContainText("EVT-01");
      await expect(
        page.getByLabel("Dependency path to Confirm keynote speakers"),
      ).toContainText("TSK-01");
      await expect(
        page.getByLabel("Dependency path to Programme lock"),
      ).toContainText("MLS-01");
    });

    await test.step("apply only the safe selected action", async () => {
      const safeAction = page.getByRole("checkbox", {
        name: "Select Move speaker confirmation due date",
      });
      const humanAction = page.getByRole("checkbox", {
        name: "Select Confirm keynote availability",
      });
      await expect(safeAction).toBeChecked();
      await expect(humanAction).not.toBeChecked();
      await expect(page.getByText("1 selected of 2 pending.")).toBeVisible();

      await page.getByRole("button", { name: "Approve selected" }).click();
      const dialog = page.getByRole("dialog", {
        name: "Approve 1 selected action?",
      });
      await expect(dialog).toBeVisible();
      await dialog
        .getByRole("button", { name: "Confirm and apply selected" })
        .click();

      await expect(page.getByText("Undo is available")).toBeVisible();
      await expect(page.locator("#applied-result")).toContainText(
        "Due 31 Jul 2026",
      );
      await expect(page.locator("#applied-result")).toContainText(
        "Due 14 Aug 2026",
      );
      await expect(page.locator("#audit-history")).toContainText(
        "Apply proposal",
      );
    });

    await test.step("record a compensating undo", async () => {
      await page
        .getByRole("button", { name: /^Undo operation / })
        .click();

      await expect(page.locator("#audit-history")).toContainText("Undo");
      await expect(page.locator("#audit-history")).toContainText(
        `Reverses ${coreDemoFixtureIds.applyOperation}`,
      );
      await expect(
        page.getByRole("button", { name: /^Undo operation / }),
      ).toHaveCount(0);
    });

    await test.step("reset to the isolated baseline", async () => {
      await page
        .getByRole("button", { name: "Reset demo workspace" })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "Reset this demo workspace?",
      });
      await expect(dialog).toBeVisible();
      await dialog
        .getByRole("button", { name: "Confirm reset to baseline" })
        .click();

      await expect(
        page.getByText("Playwright contract fixture · stage baseline"),
      ).toBeVisible();
      await expect(page.getByText("No analysis result yet")).toBeVisible();
      await expect(page.getByText("No audit operations yet")).toBeVisible();
    });

    expect(observedRequests).toEqual(["analyze", "apply", "undo", "reset"]);
    expect(contractErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});

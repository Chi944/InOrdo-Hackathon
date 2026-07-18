import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DemoResetControl } from "@/app/app/demo-reset-control";

const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
const operationId = "d1669e0f-604c-4ec2-8ff1-717b2a4d5101";
const nextOperationId = "d1669e0f-604c-4ec2-8ff1-717b2a4d5102";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("demo reset control", () => {
  it("keeps reset unavailable to a read-only viewer", () => {
    render(
      <DemoResetControl
        canReset={false}
        onResetFinished={vi.fn()}
        projectId={projectId}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Reset demo workspace" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/only a workspace owner or admin/i),
    ).toBeVisible();
  });

  it("requires confirmation and sends the strict reset request once", async () => {
    const user = userEvent.setup();
    const onResetFinished = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "succeeded",
          operationId,
          projectId,
          duplicate: false,
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <DemoResetControl
        canReset
        onResetFinished={onResetFinished}
        projectId={projectId}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Reset demo workspace" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Reset this demo workspace?" }),
    ).toBeVisible();
    expect(
      screen.getByText(/reset has no built-in undo/i),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Confirm reset to baseline" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/projects/${projectId}/demo/reset`);
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ "content-type": "application/json" });
    const request = JSON.parse(String(options.body)) as {
      confirmed: boolean;
      idempotencyKey: string;
    };
    expect(request.confirmed).toBe(true);
    expect(request.idempotencyKey).toMatch(/^[A-Za-z0-9._:-]{8,200}$/);
    expect(onResetFinished).toHaveBeenCalledWith(operationId);
    expect(
      screen.getByText(/canonical 24-item, 26-dependency baseline/i),
    ).toBeVisible();
  });

  it("shows a user-safe failure without claiming the reset completed", async () => {
    const user = userEvent.setup();
    const onResetFinished = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "conflict",
              message: "Reset is temporarily unavailable.",
            },
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    render(
      <DemoResetControl
        canReset
        onResetFinished={onResetFinished}
        projectId={projectId}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Reset demo workspace" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm reset to baseline" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Reset is temporarily unavailable.",
      ),
    );
    expect(onResetFinished).not.toHaveBeenCalled();
  });

  it("rotates after a definitive reset rejection and retains the replacement key across ambiguous failures", async () => {
    const user = userEvent.setup();
    const onResetFinished = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "conflict", message: "Reset conflict." },
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      )
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "internal_error", message: "Reset status is uncertain." },
          }),
          { status: 503, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "succeeded",
            operationId,
            projectId,
            duplicate: true,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "succeeded",
            operationId: nextOperationId,
            projectId,
            duplicate: false,
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <DemoResetControl
        canReset
        onResetFinished={onResetFinished}
        projectId={projectId}
      />,
    );

    async function attemptReset(expectedCalls: number) {
      await user.click(
        screen.getByRole("button", { name: "Reset demo workspace" }),
      );
      await user.click(
        screen.getByRole("button", { name: "Confirm reset to baseline" }),
      );
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(expectedCalls));
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Reset demo workspace" }),
        ).toBeEnabled(),
      );
    }

    await attemptReset(1);
    await attemptReset(2);
    await attemptReset(3);
    await attemptReset(4);
    await attemptReset(5);

    const keys = fetchMock.mock.calls.map((call) => {
      const [, options] = call as [string, RequestInit];
      return (JSON.parse(String(options.body)) as { idempotencyKey: string })
        .idempotencyKey;
    });
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys[1]).toBe(keys[2]);
    expect(keys[2]).toBe(keys[3]);
    expect(keys[3]).not.toBe(keys[4]);
    expect(onResetFinished).toHaveBeenNthCalledWith(1, operationId);
    expect(onResetFinished).toHaveBeenNthCalledWith(2, nextOperationId);
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  seededDemoSource,
  SourceUpdateForm,
} from "@/app/app/source-update-form";

const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("SourceUpdateForm", () => {
  it("renders a bounded, privacy-labeled intake and inserts only the canonical synthetic source", async () => {
    const user = userEvent.setup();
    render(
      <SourceUpdateForm
        canAnalyze
        onAnalysisFinished={vi.fn()}
        projectId={projectId}
      />,
    );

    expect(screen.getByLabelText("Source title")).toBeInTheDocument();
    expect(screen.getByLabelText("Source type")).toBeInTheDocument();
    expect(screen.getByLabelText("Author label")).toBeInTheDocument();
    expect(screen.getByLabelText(/Occurred at/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Source text")).toHaveAttribute(
      "maxlength",
      "12000",
    );
    expect(screen.getByText(/synthetic workspace and privacy/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Analyze change" })).toBeEnabled();

    await user.click(
      screen.getByRole("button", { name: "Insert seeded demo update" }),
    );

    expect(screen.getByLabelText("Source title")).toHaveValue(
      seededDemoSource.title,
    );
    expect(screen.getByLabelText("Source type")).toHaveValue("pasted_update");
    expect(screen.getByLabelText("Author label")).toHaveValue(
      seededDemoSource.author,
    );
    expect(screen.getByLabelText(/Occurred at/i)).toHaveValue("");
    expect(screen.getByLabelText("Source text")).toHaveValue(
      seededDemoSource.text,
    );
    expect(
      screen.getByText(
        `${seededDemoSource.text.length} / 12,000 characters`,
      ),
    ).toBeVisible();
    expect(screen.queryByText(/candidate change/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/2026-09-26/)).not.toBeInTheDocument();
  });

  it("shows useful validation, skips the API, and focuses the first invalid field", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <SourceUpdateForm
        canAnalyze
        onAnalysisFinished={vi.fn()}
        projectId={projectId}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Analyze change" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Source title")).toHaveFocus();
    expect(screen.getByLabelText("Source title")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("Enter a short source title.")).toBeVisible();
    expect(screen.getByText("Identify the source author or team.")).toBeVisible();
    expect(screen.getByText("Paste the source update to analyze.")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /review the highlighted source fields/i,
    );
  });

  it("sends the exact strict analyze payload and reports completion", async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "completed",
          duplicate: false,
          analysisRequestId: "e7387514-03d0-48ee-a0e1-c183af721100",
          sourceDocumentId: "e7387514-03d0-48ee-a0e1-c183af721101",
          changeEventId: "e7387514-03d0-48ee-a0e1-c183af721102",
          impactRunId: "e7387514-03d0-48ee-a0e1-c183af721103",
          proposalId: "e7387514-03d0-48ee-a0e1-c183af721104",
          validationOutcome: "needs_review",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <SourceUpdateForm
        canAnalyze
        onAnalysisFinished={onFinished}
        projectId={projectId}
      />,
    );

    await user.type(screen.getByLabelText("Source title"), "Venue note");
    await user.selectOptions(screen.getByLabelText("Source type"), "manual_note");
    await user.type(screen.getByLabelText("Author label"), "Venue team");
    fireEvent.change(screen.getByLabelText(/Occurred at/i), {
      target: { value: "2026-07-20T09:30" },
    });
    await user.type(screen.getByLabelText("Source text"), "The event moved.");
    await user.click(screen.getByRole("button", { name: "Analyze change" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/projects/${projectId}/analyze`);
    expect(options).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    expect(JSON.parse(String(options.body))).toEqual({
      source: {
        title: "Venue note",
        type: "manual_note",
        author: "Venue team",
        timestamp: new Date("2026-07-20T09:30").toISOString(),
        text: "The event moved.",
      },
      maxDepth: 5,
    });
    expect(onFinished).toHaveBeenCalledWith({
      kind: "completed",
      analysisRequestId: "e7387514-03d0-48ee-a0e1-c183af721100",
      proposalId: "e7387514-03d0-48ee-a0e1-c183af721104",
      duplicate: false,
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      /analysis complete/i,
    );
  });

  it("locks a pending request against double submission", async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(
      <SourceUpdateForm
        canAnalyze
        onAnalysisFinished={onFinished}
        projectId={projectId}
      />,
    );

    await user.type(screen.getByLabelText("Source title"), "Venue note");
    await user.type(screen.getByLabelText("Author label"), "Venue team");
    await user.type(screen.getByLabelText("Source text"), "The event moved.");
    await user.click(screen.getByRole("button", { name: "Analyze change" }));

    expect(screen.getByRole("button", { name: /Analyzing change/i })).toBeDisabled();
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(
      /backend returns one result after the complete pipeline/i,
    );
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch?.(
      new Response(
        JSON.stringify({
          status: "processing",
          duplicate: true,
          analysisRequestId: "e7387514-03d0-48ee-a0e1-c183af721100",
          sourceDocumentId: "e7387514-03d0-48ee-a0e1-c183af721101",
        }),
        {
          status: 202,
          headers: {
            "content-type": "application/json",
            "retry-after": "117",
          },
        },
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Analyze change" })).toBeEnabled(),
    );
    expect(onFinished).toHaveBeenCalledWith({
      kind: "processing",
      analysisRequestId: "e7387514-03d0-48ee-a0e1-c183af721100",
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      /wait 117 seconds, then submit this exact source again/i,
    );
  });

  it("refreshes a reconciled failed analysis while retaining the safe error", async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "duplicate",
              message:
                "This project update already has a failed analysis at this project version.",
            },
            analysisRequestId: "e7387514-03d0-48ee-a0e1-c183af721100",
            sourceDocumentId: "e7387514-03d0-48ee-a0e1-c183af721101",
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    render(
      <SourceUpdateForm
        canAnalyze
        onAnalysisFinished={onFinished}
        projectId={projectId}
      />,
    );

    await user.type(screen.getByLabelText("Source title"), "Venue note");
    await user.type(screen.getByLabelText("Author label"), "Venue team");
    await user.type(screen.getByLabelText("Source text"), "The event moved.");
    await user.click(screen.getByRole("button", { name: "Analyze change" }));

    await waitFor(() =>
      expect(onFinished).toHaveBeenCalledWith({
        kind: "failed",
        analysisRequestId: "e7387514-03d0-48ee-a0e1-c183af721100",
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /already has a failed analysis/i,
    );
  });
});

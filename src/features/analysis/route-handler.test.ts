import { describe, expect, it, vi } from "vitest";

import { AnalysisError } from "@/features/analysis/errors";
import { handleAnalyzeProjectPost } from "@/features/analysis/route-handler";
import { AuthorizationError } from "@/lib/auth/errors";

const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
const analysisRequestId = "0dd9e279-fee5-4bb6-9e25-3b1a5165a510";
const sourceDocumentId = "e5a80ad3-7d7a-4758-841e-bdd773987e11";
const validBody = {
  source: {
    title: "Programme update",
    type: "pasted_update",
    author: "Programme team",
    timestamp: null,
    text: "The programme lock moved to 2026-08-17.",
  },
  maxDepth: 5,
};

function request(body: string, headers: Record<string, string> = {}) {
  return new Request(`https://inordo.test/api/projects/${projectId}/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

const completedResult = {
  kind: "completed" as const,
  requestId: analysisRequestId,
  sourceDocumentId,
  changeEventId: "2aece803-d4d7-45c3-aab8-5e0e75231501",
  impactRunId: "57a7c6b7-a3bd-4c2e-8153-219010df1502",
  proposalId: "5bf63e7d-c8db-4c2d-a3cc-20107cb91503",
  model: "gpt-5.6-luna",
  extraction: {
    requestId: "req_test_extraction",
    responseId: "resp_test_extraction",
    model: "gpt-5.6-luna",
    usage: null,
  },
  proposal: {
    requestId: "req_test_proposal",
    responseId: "resp_test_proposal",
    model: "gpt-5.6-luna",
    usage: null,
  },
};

describe("analysis POST handler", () => {
  it("returns a safe 201 result and propagates response safety headers", async () => {
    const execute = vi.fn(async () => completedResult);
    const responseHeaders = new Headers({
      "set-cookie": "sb-session=refreshed; HttpOnly",
    });

    const response = await handleAnalyzeProjectPost({
      request: request(JSON.stringify(validBody)),
      projectId,
      execute,
      responseHeaders,
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("set-cookie")).toContain("sb-session=refreshed");
    await expect(response.json()).resolves.toMatchObject({
      status: "completed",
      duplicate: false,
      analysisRequestId,
      sourceDocumentId,
      model: "gpt-5.6-luna",
    });
    expect(execute).toHaveBeenCalledWith(projectId, validBody);
  });

  it("rejects unsupported media types and malformed or non-strict JSON", async () => {
    const execute = vi.fn(async () => completedResult);
    const wrongType = new Request("https://inordo.test/analyze", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify(validBody),
    });

    expect(
      (await handleAnalyzeProjectPost({ request: wrongType, projectId, execute })).status,
    ).toBe(415);
    expect(
      (
        await handleAnalyzeProjectPost({
          request: request("{not json"),
          projectId,
          execute,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await handleAnalyzeProjectPost({
          request: request(JSON.stringify({ ...validBody, workspaceId: "forged" })),
          projectId,
          execute,
        })
      ).status,
    ).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects declared and actual oversized requests", async () => {
    const execute = vi.fn(async () => completedResult);
    const declared = request(JSON.stringify(validBody), {
      "content-length": "24001",
    });
    const actual = request(
      JSON.stringify({
        ...validBody,
        source: { ...validBody.source, text: "x".repeat(24_001) },
      }),
    );

    expect(
      (await handleAnalyzeProjectPost({ request: declared, projectId, execute })).status,
    ).toBe(413);
    expect(
      (await handleAnalyzeProjectPost({ request: actual, projectId, execute })).status,
    ).toBe(413);
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns 202 without exposing source for a duplicate in progress", async () => {
    const execute = vi.fn(async () => ({
      kind: "duplicate" as const,
      state: "processing" as const,
      requestId: analysisRequestId,
      sourceDocumentId,
      changeEventId: null,
      impactRunId: null,
      proposalId: null,
      retryAfterSeconds: 117,
    }));
    const response = await handleAnalyzeProjectPost({
      request: request(JSON.stringify(validBody)),
      projectId,
      execute,
    });

    expect(response.status).toBe(202);
    expect(response.headers.get("retry-after")).toBe("117");
    const body = await response.json();
    expect(body).toMatchObject({
      status: "processing",
      duplicate: true,
      analysisRequestId,
    });
    expect(JSON.stringify(body)).not.toContain(validBody.source.text);
  });

  it("returns the bounded database retry window for rate limiting", async () => {
    const execute = vi.fn(async () => {
      throw new AnalysisError("rate_limited", undefined, undefined, 45);
    });
    const response = await handleAnalyzeProjectPost({
      request: request(JSON.stringify(validBody)),
      projectId,
      execute,
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("45");
  });

  it.each([
    [new AuthorizationError("unauthenticated"), 401],
    [new AuthorizationError("forbidden"), 403],
    [new AuthorizationError("not_found"), 404],
    [new AnalysisError("rate_limited"), 429],
    [new AnalysisError("model_timeout"), 504],
    [new AnalysisError("project_changed"), 409],
  ] as const)("maps a safe domain error to %s", async (error, status) => {
    const execute = vi.fn(async () => {
      throw error;
    });
    const response = await handleAnalyzeProjectPost({
      request: request(JSON.stringify(validBody)),
      projectId,
      execute,
    });

    expect(response.status).toBe(status);
    expect(JSON.stringify(await response.json())).not.toContain(validBody.source.text);
  });

  it("rejects an invalid project route parameter before execution", async () => {
    const execute = vi.fn(async () => completedResult);
    const response = await handleAnalyzeProjectPost({
      request: request(JSON.stringify(validBody)),
      projectId: "not-a-project-id",
      execute,
    });

    expect(response.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });
});

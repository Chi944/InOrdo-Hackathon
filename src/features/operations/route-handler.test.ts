import { describe, expect, it, vi } from "vitest";

import { OperationError } from "@/features/operations/errors";
import {
  handleApplyProposalPost,
  handleOperationHistoryGet,
  handleResetDemoPost,
  handleUndoOperationPost,
} from "@/features/operations/route-handler";
import { AuthorizationError } from "@/lib/auth/errors";

const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
const proposalId = "5bf63e7d-c8db-4c2d-a3cc-20107cb91503";
const actionId = "4c320952-a5e8-40d3-824b-d528c61de101";
const operationId = "d1669e0f-604c-4ec2-8ff1-717b2a4d5101";

function jsonRequest(path: string, body: unknown) {
  return new Request(`https://inordo.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function streamingJsonRequest(
  path: string,
  chunks: readonly Uint8Array[],
  headers: Record<string, string>,
  onCancel: () => void,
) {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index];
      index += 1;
      if (chunk === undefined) {
        controller.close();
        return;
      }
      controller.enqueue(chunk);
    },
    cancel() {
      onCancel();
    },
  });
  const init: RequestInit & { duplex: "half" } = {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
    duplex: "half",
  };
  return new Request(`https://inordo.test${path}`, init);
}

describe("project operation route handlers", () => {
  it("applies a strict selected-action request and returns a no-store result", async () => {
    const execute = vi.fn(async () => ({
      status: "succeeded" as const,
      operationId,
      appliedActionIds: [actionId],
    }));
    const requestBody = {
      selectedActionIds: [actionId],
      humanInputs: [],
      idempotencyKey: "apply_20260718_001",
    };
    const response = await handleApplyProposalPost({
      request: jsonRequest("/apply", requestBody),
      projectId,
      proposalId,
      execute,
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      status: "succeeded",
      duplicate: false,
      operationId,
      appliedActionIds: [actionId],
    });
    expect(execute).toHaveBeenCalledWith(projectId, proposalId, requestBody);
  });

  it("returns a stable 200 response for duplicate apply idempotency", async () => {
    const execute = vi.fn(async () => ({
      status: "duplicate" as const,
      operationId,
      appliedActionIds: [actionId],
    }));
    const response = await handleApplyProposalPost({
      request: jsonRequest("/apply", {
        selectedActionIds: [actionId],
        humanInputs: [],
        idempotencyKey: "apply_20260718_002",
      }),
      projectId,
      proposalId,
      execute,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ duplicate: true });
  });

  it("rejects malformed identifiers, media types, and expanded bodies before execution", async () => {
    const execute = vi.fn();
    const expanded = {
      selectedActionIds: [actionId],
      humanInputs: [],
      idempotencyKey: "apply_20260718_003",
      table: "workspace_members",
    };
    const wrongType = new Request("https://inordo.test/apply", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify(expanded),
    });

    expect(
      (
        await handleApplyProposalPost({
          request: wrongType,
          projectId,
          proposalId,
          execute,
        })
      ).status,
    ).toBe(415);
    expect(
      (
        await handleApplyProposalPost({
          request: jsonRequest("/apply", expanded),
          projectId: "not-a-uuid",
          proposalId,
          execute,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await handleApplyProposalPost({
          request: jsonRequest("/apply", expanded),
          projectId,
          proposalId,
          execute,
        })
      ).status,
    ).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns 413 before parsing an oversized operation request", async () => {
    const execute = vi.fn();
    const response = await handleApplyProposalPost({
      request: new Request("https://inordo.test/apply", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "32001",
        },
        body: "{}",
      }),
      projectId,
      proposalId,
      execute,
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "payload_too_large",
        message: "The operation request is too large.",
      },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", {}],
    ["dishonest", { "content-length": "2" }],
  ])(
    "cancels a %s-length oversized operation stream before buffering it",
    async (_description, headers) => {
      const execute = vi.fn();
      let cancelled = false;
      const response = await handleApplyProposalPost({
        request: streamingJsonRequest(
          "/apply",
          [new Uint8Array(16_000), new Uint8Array(16_001), new Uint8Array(8)],
          headers,
          () => {
            cancelled = true;
          },
        ),
        projectId,
        proposalId,
        execute,
      });

      expect(response.status).toBe(413);
      expect(cancelled).toBe(true);
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it("routes undo and reset without accepting identifiers or secrets in bodies", async () => {
    const undo = vi.fn(async () => ({
      status: "succeeded" as const,
      operationId,
      reversesOperationId: operationId,
    }));
    const reset = vi.fn(async () => ({
      status: "succeeded" as const,
      operationId,
      projectId,
    }));

    const undoResponse = await handleUndoOperationPost({
      request: jsonRequest("/undo", {
        idempotencyKey: "undo_20260718_001",
      }),
      projectId,
      operationId,
      execute: undo,
    });
    const resetResponse = await handleResetDemoPost({
      request: jsonRequest("/reset", {
        confirmed: true,
        idempotencyKey: "reset_20260718_001",
      }),
      projectId,
      execute: reset,
    });

    expect(undoResponse.status).toBe(201);
    expect(resetResponse.status).toBe(201);
    expect(undo).toHaveBeenCalledWith(projectId, operationId, {
      idempotencyKey: "undo_20260718_001",
    });
    expect(reset).toHaveBeenCalledWith(projectId, {
      confirmed: true,
      idempotencyKey: "reset_20260718_001",
    });
    expect(JSON.stringify(reset.mock.calls)).not.toContain("secret");
  });

  it("lists bounded current or archived audit history", async () => {
    const execute = vi.fn(async () => [{ id: operationId }]);
    const response = await handleOperationHistoryGet({
      request: new Request(
        `https://inordo.test/api/projects/${projectId}/operations?limit=50&includeArchived=true`,
      ),
      projectId,
      execute,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      operations: [{ id: operationId }],
    });
    expect(execute).toHaveBeenCalledWith(projectId, {
      limit: 50,
      includeArchived: true,
    });
  });

  it.each([
    [new AuthorizationError("unauthenticated"), 401],
    [new AuthorizationError("forbidden"), 403],
    [new AuthorizationError("not_found"), 404],
    [new OperationError("validation"), 400],
    [new OperationError("payload_too_large"), 413],
    [new OperationError("conflict"), 409],
    [new OperationError("reset_unavailable"), 404],
    [new OperationError("rate_limited"), 429],
    [new OperationError("persistence"), 500],
  ] as const)("maps safe domain failures to HTTP status", async (error, status) => {
    const execute = vi.fn(async () => {
      throw error;
    });
    const response = await handleUndoOperationPost({
      request: jsonRequest("/undo", {
        idempotencyKey: "undo_20260718_002",
      }),
      projectId,
      operationId,
      execute,
    });

    expect(response.status).toBe(status);
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain("private");
    expect(body).not.toContain("service_role");
  });

  it("returns bounded conflict coordinates without raw state", async () => {
    const conflictingItemId = "1e6086b4-94f7-4bee-92ae-75219e9ca201";
    const execute = vi.fn(async () => {
      throw new OperationError("conflict", {
        conflicts: [
          {
            itemId: conflictingItemId,
            expectedVersion: 4,
            actualVersion: 5,
            reason: "version_mismatch",
          },
        ],
      });
    });
    const response = await handleUndoOperationPost({
      request: jsonRequest("/undo", {
        idempotencyKey: "undo_20260718_conflict",
      }),
      projectId,
      operationId,
      execute,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "conflict",
        message: "The project changed before the operation could be completed.",
        details: {
          conflicts: [
            {
              itemId: conflictingItemId,
              expectedVersion: 4,
              actualVersion: 5,
              reason: "version_mismatch",
            },
          ],
        },
      },
    });
  });
});

import { describe, expect, it, vi } from "vitest";

import { createProjectOperationsService } from "@/features/operations/service";

const workspaceId = "166645ec-1ab3-48dc-98c7-3b6f99b70301";
const projectId = "8d2baf13-b687-4987-83a0-0b1294b0f001";
const actorId = "6519012e-13a6-4e3e-9ae5-d09bd3054401";
const proposalId = "5bf63e7d-c8db-4c2d-a3cc-20107cb91503";
const actionId = "4c320952-a5e8-40d3-824b-d528c61de101";
const operationId = "d1669e0f-604c-4ec2-8ff1-717b2a4d5101";
const resultingOperationId = "d1669e0f-604c-4ec2-8ff1-717b2a4d5102";
const projectSlug = "inordo-build-week-demo";

function dependencies() {
  const authorize = vi.fn(async (requestedProjectId: string) => ({
    user: { id: actorId, email: null },
    scope: {
      workspaceId,
      projectId: requestedProjectId,
      membership: { workspaceId, userId: actorId, role: "owner" as const },
    },
  }));
  const executor = {
    applyProposal: vi.fn(async () => ({
      status: "succeeded" as const,
      operationId: resultingOperationId,
      appliedActionIds: [actionId],
    })),
    undoOperation: vi.fn(async () => ({
      status: "succeeded" as const,
      operationId: resultingOperationId,
      reversesOperationId: operationId,
    })),
    resetDemo: vi.fn(async () => ({
      status: "succeeded" as const,
      operationId: resultingOperationId,
      projectId,
    })),
  };
  const getExecutor = vi.fn(() => executor);
  const getResetConfiguration = vi.fn(() => ({
    projectSlug,
  }));
  const listHistory = vi.fn(async () => []);

  return {
    authorize,
    executor,
    getExecutor,
    getResetConfiguration,
    listHistory,
  };
}

describe("project operations service", () => {
  it("authorizes before initializing the privileged executor", async () => {
    const deps = dependencies();
    deps.authorize.mockRejectedValueOnce(new Error("authorization stopped"));
    const service = createProjectOperationsService(deps);

    await expect(
      service.applyProposal(projectId, proposalId, {
        selectedActionIds: [actionId],
        humanInputs: [],
        idempotencyKey: "apply_20260718_001",
      }),
    ).rejects.toThrow("authorization stopped");
    expect(deps.getExecutor).not.toHaveBeenCalled();
    expect(deps.executor.applyProposal).not.toHaveBeenCalled();
  });

  it("forwards only the authorized actor, route scope, and validated approval", async () => {
    const deps = dependencies();
    const service = createProjectOperationsService(deps);
    const input = {
      selectedActionIds: [actionId],
      humanInputs: [
        {
          actionId,
          confirmed: true as const,
          response: "Confirmed by the delivery lead.",
        },
      ],
      idempotencyKey: "apply_20260718_002",
    };

    await expect(
      service.applyProposal(projectId, proposalId, input),
    ).resolves.toEqual({
      status: "succeeded",
      operationId: resultingOperationId,
      appliedActionIds: [actionId],
    });
    expect(deps.authorize).toHaveBeenCalledWith(projectId);
    expect(deps.executor.applyProposal).toHaveBeenCalledWith({
      actorId,
      projectId,
      proposalId,
      ...input,
    });
    expect(deps.authorize.mock.invocationCallOrder[0]).toBeLessThan(
      deps.getExecutor.mock.invocationCallOrder[0]!,
    );
  });

  it("fails closed when the server-side reset gate is unavailable", async () => {
    const deps = dependencies();
    deps.getResetConfiguration.mockImplementationOnce(() => {
      throw new Error("missing server reset configuration");
    });
    const service = createProjectOperationsService(deps);

    await expect(
      service.resetDemo(projectId, {
        confirmed: true,
        idempotencyKey: "reset_20260718_001",
      }),
    ).rejects.toMatchObject({
      code: "reset_unavailable",
      message: "Demo reset is not available.",
    });
    expect(deps.authorize).toHaveBeenCalledWith(projectId);
    expect(deps.getExecutor).not.toHaveBeenCalled();
    expect(deps.executor.resetDemo).not.toHaveBeenCalled();
  });

  it("authorizes a reset before checking the server gate and forwards no secret", async () => {
    const deps = dependencies();
    const service = createProjectOperationsService(deps);

    await expect(
      service.resetDemo(projectId, {
        confirmed: true,
        idempotencyKey: "reset_20260718_002",
      }),
    ).resolves.toEqual({
      status: "succeeded",
      operationId: resultingOperationId,
      projectId,
    });
    expect(deps.authorize.mock.invocationCallOrder[0]).toBeLessThan(
      deps.getResetConfiguration.mock.invocationCallOrder[0]!,
    );
    expect(deps.getResetConfiguration.mock.invocationCallOrder[0]).toBeLessThan(
      deps.getExecutor.mock.invocationCallOrder[0]!,
    );
    expect(deps.executor.resetDemo).toHaveBeenCalledWith({
      actorId,
      projectId,
      projectSlug,
      idempotencyKey: "reset_20260718_002",
    });
    expect(JSON.stringify(deps.executor.resetDemo.mock.calls)).not.toContain(
      "reset-secret",
    );
  });

  it("forwards an authorized undo with its route operation ID", async () => {
    const deps = dependencies();
    const service = createProjectOperationsService(deps);

    await expect(
      service.undoOperation(projectId, operationId, {
        idempotencyKey: "undo_20260718_001",
      }),
    ).resolves.toEqual({
      status: "succeeded",
      operationId: resultingOperationId,
      reversesOperationId: operationId,
    });
    expect(deps.executor.undoOperation).toHaveBeenCalledWith({
      actorId,
      projectId,
      operationId,
      idempotencyKey: "undo_20260718_001",
    });
  });
});

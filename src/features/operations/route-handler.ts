import "server-only";

import { z } from "zod";

import {
  OperationError,
  operationErrorStatus,
} from "@/features/operations/errors";
import {
  applyProposalRequestSchema,
  operationHistoryQuerySchema,
  resetDemoRequestSchema,
  undoOperationRequestSchema,
  type ApplyProposalRequest,
  type OperationHistoryQuery,
  type ResetDemoRequest,
  type UndoOperationRequest,
} from "@/features/operations/request-schemas";
import type { ProjectOperationsExecutor } from "@/features/operations/supabase-persistence";
import { AuthorizationError } from "@/lib/auth/errors";
import { readBoundedRequestBody } from "@/lib/http/read-bounded-request-body";

const uuidSchema = z.uuid();
const maximumOperationRequestBytes = 32_000;

type ApplyResult = Awaited<
  ReturnType<ProjectOperationsExecutor["applyProposal"]>
>;
type UndoResult = Awaited<
  ReturnType<ProjectOperationsExecutor["undoOperation"]>
>;
type ResetResult = Awaited<ReturnType<ProjectOperationsExecutor["resetDemo"]>>;

function responseHeaders(input?: Headers) {
  const headers = new Headers(input);
  headers.set("cache-control", "private, no-store");
  headers.set("content-type", "application/json; charset=utf-8");
  return headers;
}

function jsonResponse(body: unknown, status: number, headers?: Headers) {
  return Response.json(body, {
    status,
    headers: responseHeaders(headers),
  });
}

function errorResponse(error: unknown, headers?: Headers) {
  if (error instanceof AuthorizationError) {
    return jsonResponse(
      { error: { code: error.code, message: error.message } },
      error.status,
      headers,
    );
  }
  if (error instanceof OperationError) {
    return jsonResponse(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      operationErrorStatus(error),
      headers,
    );
  }
  return jsonResponse(
    {
      error: {
        code: "internal_error",
        message: "The project operation could not be completed.",
      },
    },
    500,
    headers,
  );
}

async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    throw new OperationError("validation");
  }

  const bodyResult = await readBoundedRequestBody(
    request,
    maximumOperationRequestBytes,
  );
  if (!bodyResult.ok && bodyResult.reason === "payload_too_large") {
    throw new OperationError("payload_too_large");
  }
  if (!bodyResult.ok) {
    throw new OperationError("validation");
  }

  let json: unknown;
  try {
    json = JSON.parse(bodyResult.text) as unknown;
  } catch {
    throw new OperationError("validation");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new OperationError("validation");
  return parsed.data;
}

function parseUuid(value: string) {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) throw new OperationError("validation");
  return parsed.data;
}

async function handlePost<TRequest, TResult extends { status: string }>(options: {
  request: Request;
  schema: z.ZodType<TRequest>;
  identifiers: string[];
  execute(input: TRequest): Promise<TResult>;
  responseHeaders?: Headers;
}) {
  try {
    for (const identifier of options.identifiers) parseUuid(identifier);
    const input = await parseJsonBody(options.request, options.schema);
    const result = await options.execute(input);
    const duplicate = result.status === "duplicate";
    return jsonResponse(
      { ...result, duplicate },
      duplicate ? 200 : 201,
      options.responseHeaders,
    );
  } catch (error) {
    if (
      error instanceof OperationError &&
      options.request.headers
        .get("content-type")
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase() !== "application/json"
    ) {
      return jsonResponse(
        { error: { code: "unsupported_media_type", message: "Content-Type must be application/json." } },
        415,
        options.responseHeaders,
      );
    }
    return errorResponse(error, options.responseHeaders);
  }
}

export async function handleApplyProposalPost(options: {
  request: Request;
  projectId: string;
  proposalId: string;
  execute(
    projectId: string,
    proposalId: string,
    input: ApplyProposalRequest,
  ): Promise<ApplyResult>;
  responseHeaders?: Headers;
}) {
  return handlePost({
    request: options.request,
    schema: applyProposalRequestSchema,
    identifiers: [options.projectId, options.proposalId],
    execute: (input) =>
      options.execute(options.projectId, options.proposalId, input),
    responseHeaders: options.responseHeaders,
  });
}

export async function handleUndoOperationPost(options: {
  request: Request;
  projectId: string;
  operationId: string;
  execute(
    projectId: string,
    operationId: string,
    input: UndoOperationRequest,
  ): Promise<UndoResult>;
  responseHeaders?: Headers;
}) {
  return handlePost({
    request: options.request,
    schema: undoOperationRequestSchema,
    identifiers: [options.projectId, options.operationId],
    execute: (input) =>
      options.execute(options.projectId, options.operationId, input),
    responseHeaders: options.responseHeaders,
  });
}

export async function handleResetDemoPost(options: {
  request: Request;
  projectId: string;
  execute(projectId: string, input: ResetDemoRequest): Promise<ResetResult>;
  responseHeaders?: Headers;
}) {
  return handlePost({
    request: options.request,
    schema: resetDemoRequestSchema,
    identifiers: [options.projectId],
    execute: (input) => options.execute(options.projectId, input),
    responseHeaders: options.responseHeaders,
  });
}

export async function handleOperationHistoryGet<HistoryEntry>(options: {
  request: Request;
  projectId: string;
  execute(
    projectId: string,
    query: OperationHistoryQuery,
  ): Promise<HistoryEntry[]>;
  responseHeaders?: Headers;
}) {
  try {
    parseUuid(options.projectId);
    const url = new URL(options.request.url);
    const supported = new Set(["limit", "includeArchived"]);
    if ([...url.searchParams.keys()].some((key) => !supported.has(key))) {
      throw new OperationError("validation");
    }
    const rawLimit = url.searchParams.get("limit");
    const rawArchived = url.searchParams.get("includeArchived");
    const parsed = operationHistoryQuerySchema.safeParse({
      limit: rawLimit === null ? undefined : Number(rawLimit),
      includeArchived:
        rawArchived === null
          ? undefined
          : rawArchived === "true"
            ? true
            : rawArchived === "false"
              ? false
              : rawArchived,
    });
    if (!parsed.success) throw new OperationError("validation");
    const operations = await options.execute(options.projectId, parsed.data);
    return jsonResponse({ operations }, 200, options.responseHeaders);
  } catch (error) {
    return errorResponse(error, options.responseHeaders);
  }
}

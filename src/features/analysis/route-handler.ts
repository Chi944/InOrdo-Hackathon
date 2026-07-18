import "server-only";

import { z } from "zod";

import {
  AnalysisError,
  analysisErrorStatus,
} from "@/features/analysis/errors";
import {
  analyzeProjectRequestSchema,
  maximumAnalysisRequestBytes,
} from "@/features/analysis/request-schemas";
import type { ProjectAnalysisServiceResult } from "@/features/analysis/service";
import { AuthorizationError } from "@/lib/auth/errors";

const projectIdSchema = z.uuid({ error: "Project ID must be a valid UUID." });

export type AnalyzeProjectExecutor = (
  projectId: string,
  input: unknown,
) => Promise<ProjectAnalysisServiceResult>;

type HandleAnalyzeProjectPostOptions = {
  request: Request;
  projectId: string;
  execute: AnalyzeProjectExecutor;
  responseHeaders?: Headers;
};

function safeHeaders(input?: Headers) {
  const headers = new Headers(input);
  headers.set("cache-control", "private, no-store");
  headers.set("content-type", "application/json; charset=utf-8");
  return headers;
}

function jsonResponse(body: unknown, status: number, inputHeaders?: Headers) {
  return Response.json(body, { status, headers: safeHeaders(inputHeaders) });
}

function analysisErrorResponse(error: AnalysisError, headers?: Headers) {
  const responseHeaders = safeHeaders(headers);
  if (error.code === "rate_limited" && error.retryAfterSeconds !== null) {
    responseHeaders.set("retry-after", String(error.retryAfterSeconds));
  }
  return Response.json(error.toResponseBody(), {
    status: analysisErrorStatus(error),
    headers: responseHeaders,
  });
}

function authorizationErrorResponse(
  error: AuthorizationError,
  headers?: Headers,
) {
  return jsonResponse(
    {
      error: {
        code: error.code,
        message: error.message,
      },
    },
    error.status,
    headers,
  );
}

function completedBody(result: Extract<ProjectAnalysisServiceResult, { kind: "completed" }>) {
  return {
    status: "completed",
    duplicate: false,
    analysisRequestId: result.requestId,
    sourceDocumentId: result.sourceDocumentId,
    changeEventId: result.changeEventId,
    impactRunId: result.impactRunId,
    proposalId: result.proposalId,
    model: result.model,
    modelCalls: {
      extraction: result.extraction,
      proposal: result.proposal,
    },
    validationOutcome: "needs_review",
  };
}

function duplicateResponse(
  result: Extract<ProjectAnalysisServiceResult, { kind: "duplicate" }>,
  headers?: Headers,
) {
  if (result.state === "processing") {
    const responseHeaders = safeHeaders(headers);
    responseHeaders.set(
      "retry-after",
      String(result.retryAfterSeconds),
    );
    return Response.json(
      {
        status: "processing",
        duplicate: true,
        analysisRequestId: result.requestId,
        sourceDocumentId: result.sourceDocumentId,
      },
      { status: 202, headers: responseHeaders },
    );
  }

  if (result.state === "succeeded") {
    return jsonResponse(
      {
        status: "completed",
        duplicate: true,
        analysisRequestId: result.requestId,
        sourceDocumentId: result.sourceDocumentId,
        changeEventId: result.changeEventId,
        impactRunId: result.impactRunId,
        proposalId: result.proposalId,
        validationOutcome: "needs_review",
      },
      200,
      headers,
    );
  }

  return jsonResponse(
    {
      error: {
        code: "duplicate",
        message:
          "This project update already has a failed analysis at this project version.",
      },
      analysisRequestId: result.requestId,
      sourceDocumentId: result.sourceDocumentId,
    },
    409,
    headers,
  );
}

export async function handleAnalyzeProjectPost({
  request,
  projectId,
  execute,
  responseHeaders,
}: HandleAnalyzeProjectPostOptions): Promise<Response> {
  const parsedProjectId = projectIdSchema.safeParse(projectId);
  if (!parsedProjectId.success) {
    return analysisErrorResponse(new AnalysisError("validation"), responseHeaders);
  }

  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    return analysisErrorResponse(
      new AnalysisError("unsupported_media_type"),
      responseHeaders,
    );
  }

  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null &&
    Number.isFinite(Number(declaredLength)) &&
    Number(declaredLength) > maximumAnalysisRequestBytes
  ) {
    return analysisErrorResponse(
      new AnalysisError("payload_too_large"),
      responseHeaders,
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return analysisErrorResponse(new AnalysisError("validation"), responseHeaders);
  }
  if (new TextEncoder().encode(rawBody).byteLength > maximumAnalysisRequestBytes) {
    return analysisErrorResponse(
      new AnalysisError("payload_too_large"),
      responseHeaders,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody) as unknown;
  } catch {
    return analysisErrorResponse(new AnalysisError("validation"), responseHeaders);
  }
  const parsedRequest = analyzeProjectRequestSchema.safeParse(json);
  if (!parsedRequest.success) {
    return analysisErrorResponse(
      new AnalysisError(
        "validation",
        parsedRequest.error.issues[0]?.message,
      ),
      responseHeaders,
    );
  }

  try {
    const result = await execute(parsedProjectId.data, parsedRequest.data);
    if (result.kind === "duplicate") {
      return duplicateResponse(result, responseHeaders);
    }
    return jsonResponse(completedBody(result), 201, responseHeaders);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return authorizationErrorResponse(error, responseHeaders);
    }
    if (error instanceof AnalysisError) {
      return analysisErrorResponse(error, responseHeaders);
    }
    return jsonResponse(
      {
        error: {
          code: "internal_error",
          message: "The analysis request could not be completed.",
        },
      },
      500,
      responseHeaders,
    );
  }
}

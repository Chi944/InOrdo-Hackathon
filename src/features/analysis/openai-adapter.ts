import "server-only";

import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  ConflictError,
  InternalServerError,
  RateLimitError,
} from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type {
  ResponseCreateParamsNonStreaming,
  ResponseError,
  ResponseOutputItem,
  ResponseStatus,
  ResponseUsage,
} from "openai/resources/responses/responses";
import { z } from "zod";

import {
  changeExtractionSchema,
  recoveryProposalSchema,
  type ChangeExtraction,
  type RecoveryProposal,
} from "@/features/analysis/model-schemas";
import type { AnalysisPrompt } from "@/features/analysis/prompts";

const DEFAULT_MODEL = "gpt-5.6-luna";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_EXTRACTION_MAX_OUTPUT_TOKENS = 2_048;
const DEFAULT_PROPOSAL_MAX_OUTPUT_TOKENS = 4_096;
const MAX_METADATA_ENTRIES = 16;
const MAX_METADATA_KEY_LENGTH = 64;
const MAX_METADATA_VALUE_LENGTH = 512;

export type AnalysisRequestMetadata = Readonly<Record<string, string>>;

export type AnalysisModelUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
};

export type AnalysisModelMetadata = {
  requestId: string | null;
  responseId: string;
  model: string;
  usage: AnalysisModelUsage | null;
};

export type AnalysisModelResult<T> = {
  data: T;
  metadata: AnalysisModelMetadata;
};

export type AnalysisModelCall = AnalysisPrompt & {
  metadata?: AnalysisRequestMetadata;
};

export type ResponsesParseRequestOptions = {
  timeout: number;
  maxRetries: 1;
};

export type ParsedAnalysisResponse = {
  id: string;
  model: string;
  status?: ResponseStatus;
  error: ResponseError | null;
  incomplete_details: { reason?: "max_output_tokens" | "content_filter" } | null;
  output: Array<ResponseOutputItem>;
  output_parsed: unknown | null;
  usage?: ResponseUsage;
  _request_id?: string | null;
};

export interface ResponsesParseClient {
  parse(
    body: ResponseCreateParamsNonStreaming,
    options: ResponsesParseRequestOptions,
  ): PromiseLike<ParsedAnalysisResponse>;
}

export type OpenAIAnalysisAdapterOptions = {
  model?: string;
  timeoutMs?: number;
  extractionMaxOutputTokens?: number;
  proposalMaxOutputTokens?: number;
};

export interface OpenAIAnalysisAdapter {
  extractChange(
    call: AnalysisModelCall,
  ): Promise<AnalysisModelResult<ChangeExtraction>>;
  draftProposal(
    call: AnalysisModelCall,
  ): Promise<AnalysisModelResult<RecoveryProposal>>;
}

export type AnalysisModelErrorCode =
  | "invalid_request"
  | "timeout"
  | "transient_provider"
  | "provider_failure"
  | "refusal"
  | "incomplete"
  | "malformed_output";

export class AnalysisModelError extends Error {
  readonly code: AnalysisModelErrorCode;
  readonly metadata: AnalysisModelMetadata | null;
  readonly requestId: string | null;
  readonly incompleteReason?: "max_output_tokens" | "content_filter";

  constructor(
    code: AnalysisModelErrorCode,
    message: string,
    details: {
      metadata?: AnalysisModelMetadata;
      requestId?: string | null;
      incompleteReason?: "max_output_tokens" | "content_filter";
    } = {},
  ) {
    super(message);
    this.name = "AnalysisModelError";
    this.code = code;
    this.metadata = details.metadata ?? null;
    this.requestId = details.requestId ?? details.metadata?.requestId ?? null;
    this.incompleteReason = details.incompleteReason;
  }
}

function invalidRequestError(): AnalysisModelError {
  return new AnalysisModelError(
    "invalid_request",
    "The analysis request configuration is invalid.",
  );
}

function requirePositiveInteger(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw invalidRequestError();
  }

  return value;
}

function buildMetadata(
  stage: "extraction" | "proposal",
  metadata: AnalysisRequestMetadata | undefined,
): Record<string, string> {
  if (metadata !== undefined && (metadata === null || Array.isArray(metadata))) {
    throw invalidRequestError();
  }

  const merged: Record<string, unknown> = {
    ...(metadata ?? {}),
    analysis_stage: stage,
  };
  const entries = Object.entries(merged);

  if (entries.length > MAX_METADATA_ENTRIES) {
    throw invalidRequestError();
  }

  const valid = entries.every(
    ([key, value]) =>
      key.length > 0 &&
      key.length <= MAX_METADATA_KEY_LENGTH &&
      typeof value === "string" &&
      value.length <= MAX_METADATA_VALUE_LENGTH,
  );

  if (!valid) {
    throw invalidRequestError();
  }

  return Object.fromEntries(entries) as Record<string, string>;
}

function safeUsage(usage: ResponseUsage | undefined): AnalysisModelUsage | null {
  if (!usage) {
    return null;
  }

  return {
    inputTokens: usage.input_tokens,
    cachedInputTokens: usage.input_tokens_details?.cached_tokens ?? 0,
    cacheWriteInputTokens:
      usage.input_tokens_details?.cache_write_tokens ?? 0,
    outputTokens: usage.output_tokens,
    reasoningOutputTokens:
      usage.output_tokens_details?.reasoning_tokens ?? 0,
    totalTokens: usage.total_tokens,
  };
}

function responseMetadata(response: ParsedAnalysisResponse): AnalysisModelMetadata {
  return {
    requestId: response._request_id ?? null,
    responseId: response.id,
    model: response.model,
    usage: safeUsage(response.usage),
  };
}

function containsRefusal(response: ParsedAnalysisResponse): boolean {
  return response.output.some(
    (output) =>
      output.type === "message" &&
      output.content.some((content) => content.type === "refusal"),
  );
}

function apiRequestId(error: unknown): string | null {
  return error instanceof APIError ? error.requestID ?? null : null;
}

function normalizeThrownError(error: unknown): AnalysisModelError {
  if (error instanceof AnalysisModelError) {
    return error;
  }

  if (error instanceof SyntaxError || error instanceof z.ZodError) {
    return new AnalysisModelError(
      "malformed_output",
      "The analysis provider returned invalid structured output.",
    );
  }

  if (error instanceof APIConnectionTimeoutError) {
    return new AnalysisModelError(
      "timeout",
      "The analysis request timed out.",
    );
  }

  if (
    error instanceof APIConnectionError ||
    error instanceof ConflictError ||
    error instanceof RateLimitError ||
    error instanceof InternalServerError ||
    (error instanceof APIError &&
      (error.status === 408 ||
        error.status === 409 ||
        error.status === 429 ||
        (typeof error.status === "number" && error.status >= 500)))
  ) {
    return new AnalysisModelError(
      "transient_provider",
      "The analysis provider is temporarily unavailable.",
      { requestId: apiRequestId(error) },
    );
  }

  return new AnalysisModelError(
    "provider_failure",
    "The analysis provider could not complete the request.",
    { requestId: apiRequestId(error) },
  );
}

export function createOpenAIAnalysisAdapter(
  responses: ResponsesParseClient,
  options: OpenAIAnalysisAdapterOptions = {},
): OpenAIAnalysisAdapter {
  const model = options.model?.trim() || DEFAULT_MODEL;
  const timeoutMs = requirePositiveInteger(
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const extractionMaxOutputTokens = requirePositiveInteger(
    options.extractionMaxOutputTokens ??
      DEFAULT_EXTRACTION_MAX_OUTPUT_TOKENS,
  );
  const proposalMaxOutputTokens = requirePositiveInteger(
    options.proposalMaxOutputTokens ?? DEFAULT_PROPOSAL_MAX_OUTPUT_TOKENS,
  );

  async function parseStructured<T>(input: {
    call: AnalysisModelCall;
    stage: "extraction" | "proposal";
    schema: z.ZodType<T>;
    schemaName: string;
    maxOutputTokens: number;
  }): Promise<AnalysisModelResult<T>> {
    const metadata = buildMetadata(input.stage, input.call.metadata);
    const body = {
      model,
      instructions: input.call.instructions,
      input: input.call.input,
      text: {
        format: zodTextFormat(input.schema, input.schemaName),
      },
      store: false,
      reasoning: { effort: "low" },
      max_output_tokens: input.maxOutputTokens,
      metadata,
      tools: [],
    } satisfies ResponseCreateParamsNonStreaming;

    let response: ParsedAnalysisResponse;
    try {
      response = await responses.parse(body, {
        timeout: timeoutMs,
        maxRetries: 1,
      });
    } catch (error) {
      throw normalizeThrownError(error);
    }

    const safeMetadata = responseMetadata(response);

    if (response.status === "incomplete") {
      throw new AnalysisModelError(
        "incomplete",
        "The analysis provider returned an incomplete response.",
        {
          metadata: safeMetadata,
          incompleteReason: response.incomplete_details?.reason,
        },
      );
    }

    if (
      response.error !== null ||
      (response.status !== undefined && response.status !== "completed")
    ) {
      throw new AnalysisModelError(
        "provider_failure",
        "The analysis provider could not complete the request.",
        { metadata: safeMetadata },
      );
    }

    if (containsRefusal(response)) {
      throw new AnalysisModelError(
        "refusal",
        "The analysis provider declined this request.",
        { metadata: safeMetadata },
      );
    }

    if (response.output_parsed === null) {
      throw new AnalysisModelError(
        "malformed_output",
        "The analysis provider returned invalid structured output.",
        { metadata: safeMetadata },
      );
    }

    const parsed = input.schema.safeParse(response.output_parsed);
    if (!parsed.success) {
      throw new AnalysisModelError(
        "malformed_output",
        "The analysis provider returned invalid structured output.",
        { metadata: safeMetadata },
      );
    }

    return { data: parsed.data, metadata: safeMetadata };
  }

  return {
    extractChange(call) {
      return parseStructured({
        call,
        stage: "extraction",
        schema: changeExtractionSchema,
        schemaName: "inordo_change_extraction_v1",
        maxOutputTokens: extractionMaxOutputTokens,
      });
    },
    draftProposal(call) {
      return parseStructured({
        call,
        stage: "proposal",
        schema: recoveryProposalSchema,
        schemaName: "inordo_recovery_proposal_v1",
        maxOutputTokens: proposalMaxOutputTokens,
      });
    },
  };
}

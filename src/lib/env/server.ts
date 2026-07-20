import "server-only";

import { z } from "zod";

import {
  analysisModes,
  type AnalysisProviderPolicy,
  type GatewayModel,
  type RecordingModel,
} from "@/features/analysis/provider-policy";
import {
  EnvironmentConfigurationError,
  exactNonBlankEnvironmentValueSchema,
  publicEnvSchema,
} from "@/lib/env/public";

const openAIModelSchema = z
  .string()
  .trim()
  .min(1)
  .default("gpt-5.6-luna");

export const applicationEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: exactNonBlankEnvironmentValueSchema,
  DEMO_PROJECT_SLUG: exactNonBlankEnvironmentValueSchema,
  DEMO_RESET_SECRET: exactNonBlankEnvironmentValueSchema,
});

export const serverEnvSchema = applicationEnvSchema.extend({
  OPENAI_API_KEY: exactNonBlankEnvironmentValueSchema,
  OPENAI_MODEL: openAIModelSchema,
});

const privilegedEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: publicEnvSchema.shape.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: exactNonBlankEnvironmentValueSchema,
});

const demoEnvSchema = z.object({
  DEMO_PROJECT_SLUG: exactNonBlankEnvironmentValueSchema,
});

const demoResetEnvSchema = demoEnvSchema.extend({
  DEMO_RESET_SECRET: exactNonBlankEnvironmentValueSchema,
});

export const openAIEnvSchema = z.object({
  OPENAI_API_KEY: exactNonBlankEnvironmentValueSchema,
  OPENAI_MODEL: openAIModelSchema,
});

const openAIModelEnvSchema = openAIEnvSchema.pick({ OPENAI_MODEL: true });

const recordingModelName: RecordingModel = "gpt-5.6-luna";
const gatewayModelName: GatewayModel = "openai/gpt-oss-20b";
const gatewayBaseURL = "https://ai-gateway.vercel.sh/v1" as const;

const analysisRuntimeValuesSchema = z.object({
  ANALYSIS_MODE: z.string().optional(),
  AI_GATEWAY_API_KEY: z.string().optional(),
  AI_GATEWAY_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
});

export type AnalysisRuntimeEnv =
  | {
      mode: "disabled";
      policy: AnalysisProviderPolicy;
      credential: null;
    }
  | {
      mode: "recording";
      policy: AnalysisProviderPolicy;
      credential: { apiKey: string; model: RecordingModel } | null;
    }
  | {
      mode: "auto";
      policy: AnalysisProviderPolicy;
      credential: {
        apiKey: string;
        model: GatewayModel;
        baseURL: typeof gatewayBaseURL;
      } | null;
    };

function baseAnalysisPolicy(
  mode: AnalysisProviderPolicy["mode"],
): AnalysisProviderPolicy {
  return {
    mode,
    recordingReady: false,
    gatewayReady: false,
    recordingModelName,
    gatewayModelName,
  };
}

export function parseAnalysisRuntimeEnv(values: unknown): AnalysisRuntimeEnv {
  const parsed = analysisRuntimeValuesSchema.safeParse(values);
  const parsedMode = parsed.success
    ? z.enum(analysisModes).safeParse(parsed.data.ANALYSIS_MODE)
    : null;
  if (!parsedMode?.success || !parsed.success) {
    return {
      mode: "disabled",
      policy: baseAnalysisPolicy("disabled"),
      credential: null,
    };
  }

  const mode = parsedMode.data;
  if (mode === "recording") {
    const apiKey = exactNonBlankEnvironmentValueSchema.safeParse(
      parsed.data.OPENAI_API_KEY,
    );
    const configuredModel = parsed.data.OPENAI_MODEL ?? recordingModelName;
    const ready = apiKey.success && configuredModel === recordingModelName;

    return {
      mode,
      policy: {
        ...baseAnalysisPolicy(mode),
        recordingReady: ready,
      },
      credential: ready
        ? { apiKey: apiKey.data, model: recordingModelName }
        : null,
    };
  }

  if (mode === "auto") {
    const apiKey = exactNonBlankEnvironmentValueSchema.safeParse(
      parsed.data.AI_GATEWAY_API_KEY,
    );
    const ready =
      apiKey.success && parsed.data.AI_GATEWAY_MODEL === gatewayModelName;

    return {
      mode,
      policy: {
        ...baseAnalysisPolicy(mode),
        gatewayReady: ready,
      },
      credential: ready
        ? {
            apiKey: apiKey.data,
            model: gatewayModelName,
            baseURL: gatewayBaseURL,
          }
        : null,
    };
  }

  return {
    mode: "disabled",
    policy: baseAnalysisPolicy("disabled"),
    credential: null,
  };
}

export function getAnalysisRuntimeEnv(): AnalysisRuntimeEnv {
  return parseAnalysisRuntimeEnv({
    ANALYSIS_MODE: process.env.ANALYSIS_MODE,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    AI_GATEWAY_MODEL: process.env.AI_GATEWAY_MODEL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  });
}

function parseEnvironment<T extends z.ZodType>(
  scope: string,
  schema: T,
  values: unknown,
): z.infer<T> {
  const result = schema.safeParse(values);
  if (!result.success) {
    throw new EnvironmentConfigurationError(scope, result.error.issues);
  }
  return result.data;
}

export function getServerEnv(): z.infer<typeof serverEnvSchema> {
  return parseEnvironment("Server", serverEnvSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    DEMO_PROJECT_SLUG: process.env.DEMO_PROJECT_SLUG,
    DEMO_RESET_SECRET: process.env.DEMO_RESET_SECRET,
  });
}

export function getPrivilegedSupabaseEnv() {
  return parseEnvironment("Privileged Supabase", privilegedEnvSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

export function getDemoProjectSlug(): string {
  return parseEnvironment("Demo project", demoEnvSchema, {
    DEMO_PROJECT_SLUG: process.env.DEMO_PROJECT_SLUG,
  }).DEMO_PROJECT_SLUG;
}

export function parseDemoResetEnv(values: unknown) {
  return parseEnvironment("Demo reset", demoResetEnvSchema, values);
}

export function getDemoResetEnv(): z.infer<typeof demoResetEnvSchema> {
  return parseDemoResetEnv({
    DEMO_PROJECT_SLUG: process.env.DEMO_PROJECT_SLUG,
    DEMO_RESET_SECRET: process.env.DEMO_RESET_SECRET,
  });
}

export function parseOpenAIEnv(values: unknown) {
  return parseEnvironment("OpenAI", openAIEnvSchema, values);
}

export function getOpenAIEnv(): z.infer<typeof openAIEnvSchema> {
  return parseOpenAIEnv({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  });
}

export function getOpenAIModel(): string {
  return parseEnvironment("OpenAI model", openAIModelEnvSchema, {
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  }).OPENAI_MODEL;
}

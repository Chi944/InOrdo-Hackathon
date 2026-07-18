import "server-only";

import { z } from "zod";

import {
  EnvironmentConfigurationError,
  publicEnvSchema,
} from "@/lib/env/public";

export const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1),
  DEMO_PROJECT_SLUG: z.string().min(1),
  DEMO_RESET_SECRET: z.string().min(1),
});

const privilegedEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: publicEnvSchema.shape.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const demoEnvSchema = z.object({
  DEMO_PROJECT_SLUG: z.string().min(1),
});

const demoResetEnvSchema = demoEnvSchema.extend({
  DEMO_RESET_SECRET: z.string().min(1),
});

export const openAIEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().trim().min(1).default("gpt-5.6-luna"),
});

const openAIModelEnvSchema = openAIEnvSchema.pick({ OPENAI_MODEL: true });

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

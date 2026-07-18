import { z } from "zod";

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL."),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required."),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export class EnvironmentConfigurationError extends Error {
  readonly variables: readonly string[];

  constructor(scope: string, issues: readonly z.core.$ZodIssue[]) {
    const variables = [...new Set(issues.map((issue) => issue.path.join(".")))];
    super(
      `${scope} environment configuration is invalid. Check: ${variables.join(", ")}.`,
    );
    this.name = "EnvironmentConfigurationError";
    this.variables = variables;
  }
}

export function parsePublicEnv(values: unknown): PublicEnv {
  const result = publicEnvSchema.safeParse(values);

  if (!result.success) {
    throw new EnvironmentConfigurationError("Public", result.error.issues);
  }

  return result.data;
}

export function getPublicEnv(): PublicEnv {
  return parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

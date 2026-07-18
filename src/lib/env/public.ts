import { z } from "zod";

export const exactNonBlankEnvironmentValueSchema = z
  .string()
  .superRefine((value, context) => {
    if (value.trim().length === 0 || value !== value.trim()) {
      context.addIssue({
        code: "custom",
        message: "Environment values must be nonblank and unpadded.",
      });
    }
  });

const supabaseUrlSchema = z.string().superRefine((value, context) => {
  if (value.trim().length === 0 || value !== value.trim()) {
    context.addIssue({
      code: "custom",
      message: "NEXT_PUBLIC_SUPABASE_URL must be an unpadded HTTP(S) URL.",
    });
    return;
  }

  try {
    const url = new URL(value);
    const loopbackHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);
    const isSecure = url.protocol === "https:";
    const isLocalPlaintext =
      url.protocol === "http:" && loopbackHostnames.has(url.hostname);

    if (!isSecure && !isLocalPlaintext) {
      context.addIssue({
        code: "custom",
        message:
          "NEXT_PUBLIC_SUPABASE_URL must use HTTPS, except for loopback development URLs.",
      });
    }

    if (url.username.length > 0 || url.password.length > 0) {
      context.addIssue({
        code: "custom",
        message: "NEXT_PUBLIC_SUPABASE_URL must not include credentials.",
      });
    }
  } catch {
    context.addIssue({
      code: "custom",
      message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL.",
    });
  }
});

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrlSchema,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: exactNonBlankEnvironmentValueSchema,
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

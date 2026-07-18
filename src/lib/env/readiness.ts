import "server-only";

import { serverEnvSchema } from "@/lib/env/server";

export const readinessVariableNames = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "DEMO_PROJECT_SLUG",
  "DEMO_RESET_SECRET",
] as const;

export type ReadinessVariableName = (typeof readinessVariableNames)[number];

export type DeploymentEnvironment = Partial<
  Record<ReadinessVariableName, string | undefined>
>;

export type DeploymentReadiness =
  | { status: "ready"; invalidVariables: readonly [] }
  | {
      status: "not_ready";
      invalidVariables: readonly ReadinessVariableName[];
    };

const readinessVariableSet = new Set<string>(readinessVariableNames);

export function evaluateDeploymentReadiness(
  values: DeploymentEnvironment,
): DeploymentReadiness {
  const result = serverEnvSchema.safeParse(values);
  if (result.success) {
    return { status: "ready", invalidVariables: [] };
  }

  const invalidVariables = [
    ...new Set(
      result.error.issues.flatMap((issue) => {
        const variable = issue.path[0];
        return typeof variable === "string" && readinessVariableSet.has(variable)
          ? [variable as ReadinessVariableName]
          : [];
      }),
    ),
  ].sort(
    (left, right) =>
      readinessVariableNames.indexOf(left) -
      readinessVariableNames.indexOf(right),
  );

  return { status: "not_ready", invalidVariables };
}

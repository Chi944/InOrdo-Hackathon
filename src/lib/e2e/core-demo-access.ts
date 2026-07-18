import "server-only";

type CoreDemoEnvironment = Readonly<{
  INORDO_E2E_FIXTURES?: string;
  NODE_ENV?: string;
}>;

/**
 * CI fixtures are deliberately unavailable from production builds, even when
 * an operator accidentally sets the opt-in environment variable.
 */
export function isCoreDemoFixtureEnabled(
  environment: CoreDemoEnvironment = process.env,
): boolean {
  const isNonProductionRuntime =
    environment.NODE_ENV === "development" ||
    environment.NODE_ENV === "test";

  return (
    isNonProductionRuntime && environment.INORDO_E2E_FIXTURES === "1"
  );
}

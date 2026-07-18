import { evaluateDeploymentReadiness } from "@/lib/env/readiness";

export const runtime = "nodejs";
export const maxDuration = 10;
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store",
} as const;

export async function GET(): Promise<Response> {
  const readiness = evaluateDeploymentReadiness({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    DEMO_PROJECT_SLUG: process.env.DEMO_PROJECT_SLUG,
    DEMO_RESET_SECRET: process.env.DEMO_RESET_SECRET,
  });

  if (readiness.status === "not_ready") {
    console.error(
      `[health] Deployment configuration is not ready. Check: ${readiness.invalidVariables.join(", ")}.`,
    );
    return Response.json(
      {
        status: "not_ready",
        checks: { configuration: "not_ready" },
        message: "Service configuration is incomplete.",
      },
      { status: 503, headers: responseHeaders },
    );
  }

  return Response.json(
    { status: "ready", checks: { configuration: "ready" } },
    { status: 200, headers: responseHeaders },
  );
}

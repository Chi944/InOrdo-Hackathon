import "server-only";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { ImpactWorkflow } from "@/app/app/impact-workflow";
import type { AnalysisAvailability } from "@/features/analysis/provider-policy";
import { isCoreDemoFixtureEnabled } from "@/lib/e2e/core-demo-access";
import { coreDemoFixtureIds } from "@/lib/e2e/core-demo-contract";
import { coreDemoWorkflowData } from "@/lib/e2e/core-demo-fixtures";
import {
  coreDemoStageCookieName,
  parseCoreDemoStage,
} from "@/lib/e2e/core-demo-stage";

export const dynamic = "force-dynamic";

const fixtureAnalysisAvailability = {
  mode: "auto",
  status: "fallback_configured",
  canAnalyze: true,
  provider: "Vercel AI Gateway",
  model: "openai/gpt-oss-20b",
  message: "The capped GPT-OSS fallback is available for authorized contributors.",
} satisfies AnalysisAvailability;

export default async function CoreDemoFixturePage() {
  if (!isCoreDemoFixtureEnabled()) {
    notFound();
  }

  const cookieStore = await cookies();
  const stage = parseCoreDemoStage(
    cookieStore.get(coreDemoStageCookieName)?.value,
  );

  return (
    <main className="min-h-screen bg-paper" id="main-content" tabIndex={-1}>
      <div className="mx-auto grid w-full max-w-[90rem] gap-5 px-5 py-6 sm:px-8 lg:px-12 lg:py-9">
        <div
          className="border-2 border-red-700 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900"
          role="status"
        >
          CI-only synthetic fixture — no live Supabase/OpenAI result
        </div>
        <header className="border border-rule bg-white p-5 lg:p-6">
          <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
            Playwright contract fixture · stage {stage}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-ink">
            InOrdo core demo journey
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            This isolated page renders the production workflow components with
            deterministic synthetic records. Browser tests intercept only the
            four server mutation seams.
          </p>
        </header>
        <ImpactWorkflow
          analysisAvailability={fixtureAnalysisAvailability}
          data={coreDemoWorkflowData(stage)}
          projectId={coreDemoFixtureIds.project}
          refreshPath="/__e2e__/core-demo"
          role="owner"
          syntheticWorkspace
        />
      </div>
    </main>
  );
}

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";

const ordinaryProjectLimitation =
  "InOrdo's records and authorization are project-scoped. Creating and using ordinary team workspaces is not available in this Build Week demo. This informational preview is intentionally separate from the live synthetic summit workspace.";

export function OrdinaryProjectNotice() {
  return (
    <>
      <Link
        className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
        href="/app/projects"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to projects
      </Link>

      <header className="border-b border-rule pb-6">
        <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-muted">
          Ordinary workspace · Informational preview
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-ink sm:text-4xl">
          Team project
        </h1>
      </header>

      <section
        aria-labelledby="ordinary-project-status"
        className="mt-6 border border-rule bg-white p-6 sm:p-8"
      >
        <p className="font-mono text-[0.63rem] uppercase tracking-[0.12em] text-signal">
          Build Week availability
        </p>
        <h2
          className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-ink"
          id="ordinary-project-status"
        >
          Informational preview only
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
          {ordinaryProjectLimitation}
        </p>
        <Link
          aria-label="Open synthetic project"
          className="mt-6 inline-flex min-h-11 items-center gap-2 border border-ink bg-ink px-4 text-sm font-semibold text-white transition hover:bg-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          href="/app"
        >
          Open synthetic project
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </section>
    </>
  );
}

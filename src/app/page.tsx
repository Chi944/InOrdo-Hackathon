import {
  ArrowDown,
  FileText,
  GitBranch,
  LockKeyhole,
  Network,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

const workflow = [
  {
    title: "Evidence",
    description:
      "Preserve the original update and review the structured change beside it.",
    icon: FileText,
  },
  {
    title: "Deterministic impact",
    description:
      "Traverse explicit dependencies so every downstream item has a visible path.",
    icon: Network,
  },
  {
    title: "Recovery draft",
    description:
      "Use the configured bounded server-side provider to draft recovery actions, never to decide what runs.",
    icon: Sparkles,
  },
  {
    title: "Human approval",
    description:
      "Apply only selected internal changes and keep a reversible operation record.",
    icon: ShieldCheck,
  },
] as const;

export default function Home() {
  return (
    <main id="main-content" tabIndex={-1}>
      <header className="mx-auto flex w-full max-w-[90rem] items-center justify-between px-5 py-6 sm:px-8 lg:px-12">
        <a
          className="inline-flex items-center gap-3 rounded-sm font-semibold tracking-[-0.04em] text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
          href="#main-content"
          aria-label="InOrdo home"
        >
          <span
            className="grid size-9 place-items-center border border-ink bg-ink font-mono text-[0.65rem] tracking-[0.08em] text-paper"
            aria-hidden="true"
          >
            IO
          </span>
          <span className="text-lg">InOrdo</span>
        </a>
        <span className="border border-rule bg-white/60 px-3 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
          Evidence review build
        </span>
      </header>

      <section className="mx-auto grid w-full max-w-[90rem] gap-12 px-5 pb-16 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,0.88fr)_minmax(32rem,1.12fr)] lg:items-center lg:gap-16 lg:px-12 lg:pb-24 lg:pt-20">
        <div className="max-w-2xl">
          <p className="mb-5 flex items-center gap-3 font-mono text-[0.72rem] uppercase tracking-[0.16em] text-signal">
            <span className="h-px w-8 bg-signal" aria-hidden="true" />
            Work and productivity · Build Week
          </p>
          <h1 className="max-w-[12ch] text-balance text-[clamp(3.2rem,7.5vw,7.4rem)] font-semibold leading-[0.88] tracking-[-0.075em] text-ink">
            Control project change without the chain reaction.
          </h1>
          <p className="mt-8 max-w-xl text-pretty text-lg leading-8 text-muted sm:text-xl">
            InOrdo turns an unstructured update into evidence-backed changes,
            traces the work they affect, and keeps people in control before
            anything is applied.
          </p>

          <div
            className="mt-10 border-l-2 border-caution bg-white px-5 py-4 shadow-[0_12px_35px_rgba(23,35,31,0.06)]"
            role="status"
          >
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-caution">
              Current state
            </p>
            <p className="mt-1 font-semibold text-ink">
              Protected review workspace connected
            </p>
            <p className="mt-1 text-sm leading-6 text-muted" id="demo-status-note">
              The authenticated UI uses the existing analysis, impact, apply,
              history, and undo contracts. Live results remain environment- and
              backend-state dependent; synthetic previews stay labeled.
            </p>
          </div>

          <Link
            className="mt-6 inline-flex min-h-12 items-center gap-2 bg-ink px-5 text-sm font-semibold text-white transition hover:bg-signal focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
            href="/app"
            aria-describedby="demo-status-note"
          >
            <LockKeyhole className="size-4" aria-hidden="true" />
            Open demo workspace
          </Link>
        </div>

        <div className="ledger-grid relative border border-rule bg-white p-4 shadow-[0_30px_80px_rgba(23,35,31,0.1)] sm:p-7">
          <div className="mb-7 flex items-center justify-between border-b border-rule pb-4">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted">
                Illustrative trace · not connected
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">
                Venue date change
              </h2>
            </div>
            <span className="border border-caution/35 bg-caution-soft px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-caution">
              Review only
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] sm:items-center">
            <article className="border border-rule bg-paper p-5">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-signal">
                  Evidence
                </span>
                <FileText className="size-4 text-signal" aria-hidden="true" />
              </div>
              <p className="mt-6 text-base font-medium leading-7 text-ink">
                “The venue moved the summit from 12 September to 26 September.”
              </p>
              <p className="mt-5 font-mono text-[0.64rem] text-muted">
                Source text preserved
              </p>
            </article>

            <div className="flex justify-center text-signal" aria-hidden="true">
              <ArrowDown className="size-5 sm:-rotate-90" />
            </div>

            <article className="border border-ink bg-ink p-5 text-paper">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-[#AEBEFF]">
                  Candidate change
                </span>
                <GitBranch className="size-4 text-[#AEBEFF]" aria-hidden="true" />
              </div>
              <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm">
                <dt className="text-[#AAB4AF]">Field</dt>
                <dd className="font-mono">event_date</dd>
                <dt className="text-[#AAB4AF]">Before</dt>
                <dd className="font-mono line-through">2026-09-12</dd>
                <dt className="text-[#AAB4AF]">Proposed</dt>
                <dd className="font-mono text-[#AEBEFF]">2026-09-26</dd>
              </dl>
              <p className="mt-5 border-t border-white/15 pt-4 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-[#D5DBD8]">
                Needs human confirmation
              </p>
            </article>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              ["Direct", "Speaker confirmations", "1 hop"],
              ["Downstream", "Briefing pack", "3 hops"],
              ["Held", "Student travel", "Owner review"],
            ].map(([kind, item, path]) => (
              <div className="border border-rule bg-white p-4" key={item}>
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">
                  {kind}
                </span>
                <p className="mt-2 text-sm font-semibold text-ink">{item}</p>
                <p className="mt-1 font-mono text-[0.62rem] text-signal">{path}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-rule bg-white" aria-labelledby="workflow-title">
        <div className="mx-auto w-full max-w-[90rem] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.6fr_1.4fr] lg:gap-16">
            <div>
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-signal">
                P0 control loop
              </p>
              <h2
                className="mt-3 max-w-sm text-3xl font-semibold tracking-[-0.055em] text-ink sm:text-4xl"
                id="workflow-title"
              >
                AI interprets. The graph explains. People decide.
              </h2>
            </div>
            <ol className="grid border-l border-t border-rule sm:grid-cols-2">
              {workflow.map((step, index) => {
                const Icon = step.icon;

                return (
                  <li className="border-b border-r border-rule p-6 sm:p-7" key={step.title}>
                    <div className="flex items-center justify-between">
                      <Icon className="size-5 text-signal" aria-hidden="true" />
                      <span className="font-mono text-[0.62rem] text-muted">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="mt-10 text-lg font-semibold tracking-[-0.025em] text-ink">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{step.description}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-[90rem] flex-col gap-3 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <p>InOrdo · OpenAI Build Week</p>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.12em]">
          Evidence → impact → approval → undo
        </p>
      </footer>
    </main>
  );
}

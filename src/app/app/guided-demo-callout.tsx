"use client";

import { Compass, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export type GuidedDemoTarget = {
  itemId: string;
  itemKey: string;
  title: string;
  href: string;
};

type GuidedDemoCalloutProps = {
  targets: readonly GuidedDemoTarget[];
  seedNote?: string;
};

export function GuidedDemoCallout({ seedNote, targets }: GuidedDemoCalloutProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <aside
      className="border border-signal/30 bg-white p-4 sm:p-5"
      aria-labelledby="guided-demo-heading"
    >
      <div className="flex items-start gap-3">
        <span
          className="grid size-9 shrink-0 place-items-center bg-[#eef1ff] text-signal"
          aria-hidden="true"
        >
          <Compass className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
            Guided demo · Synthetic data
          </p>
          <h2
            className="mt-1 text-lg font-semibold tracking-[-0.03em] text-ink"
            id="guided-demo-heading"
          >
            Follow the summit plan
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            This fictional workspace contains no customer data. Open a seeded
            record below to see how project items and their explicit
            dependencies connect.
          </p>
        </div>
        <button
          aria-label="Dismiss guided demo"
          className="grid size-10 shrink-0 place-items-center border border-rule bg-white text-ink transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          onClick={() => setDismissed(true)}
          type="button"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {targets.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Suggested demo records">
          {targets.map((target) => (
            <li key={target.itemId}>
              <Link
                aria-label={`Open ${target.itemKey}: ${target.title}`}
                className="inline-flex min-h-10 max-w-full items-center gap-2 border border-rule bg-paper px-3 text-sm text-ink transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                href={target.href}
              >
                <span className="shrink-0 font-mono text-[0.64rem] text-signal">
                  {target.itemKey}
                </span>
                <span className="truncate">{target.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">
          Suggested records will appear when the seeded project is available.
        </p>
      )}

      {seedNote ? (
        <p className="mt-4 border-l-2 border-caution pl-3 text-xs leading-5 text-muted">
          <span className="font-semibold text-ink">Seed note: </span>
          {seedNote}
        </p>
      ) : null}
    </aside>
  );
}

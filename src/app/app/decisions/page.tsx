import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { DecisionRecords } from "@/app/app/focused-records";
import { loadProjectViewData } from "@/app/app/project-view-data";

export default async function ProjectDecisionsPage() {
  const { dependencies, items } = await loadProjectViewData();

  return (
    <main
      className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-8 sm:py-10 lg:px-12"
      id="main-content"
      tabIndex={-1}
    >
      <Link
        className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
        href="/app"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to project overview
      </Link>
      <header className="mb-8 border-b border-rule pb-6">
        <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
          Focused project view
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-ink sm:text-4xl">
          Project decisions
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          Trace the status and available rationale behind choices recorded in
          this synthetic project.
        </p>
      </header>
      <DecisionRecords
        dependencies={dependencies.map((dependency) => ({
          id: dependency.id,
          fromItemId: dependency.from_item_id,
          toItemId: dependency.to_item_id,
          relationship: dependency.relationship,
          rationale: dependency.rationale,
        }))}
        itemHrefPrefix="/app/items"
        items={items.map((item) => ({
          id: item.id,
          itemKey: item.item_key,
          itemType: item.item_type,
          title: item.title,
          description: item.description,
          status: item.status,
          priority: item.priority,
          ownerName: item.owner?.display_name ?? null,
          dueDate: item.due_date,
          eventDate: item.event_date,
          metadata: item.metadata,
        }))}
      />
    </main>
  );
}

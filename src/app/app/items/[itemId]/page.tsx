import { format, parseISO } from "date-fns";
import { ArrowLeft, ArrowRight, CalendarDays, GitBranch } from "lucide-react";
import Link from "next/link";

import { ProjectItemEditor } from "@/app/app/items/project-item-editor";
import { loadProjectItemView } from "@/app/app/project-view-data";
import type { Json } from "@/types/database";

function formatDate(value: string | null) {
  return value ? format(parseISO(value), "MMMM d, yyyy") : "Not set";
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

function metadataEntries(metadata: Json) {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") {
    return [];
  }
  return Object.entries(metadata).flatMap(([key, value]) => {
    if (["string", "number", "boolean"].includes(typeof value)) {
      return [[label(key), String(value)] as const];
    }
    return [];
  });
}

export default async function ProjectItemDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const {
    overview,
    item,
    prerequisites,
    dependents,
    memberOptions,
    role,
  } = await loadProjectItemView(itemId);
  const metadata = metadataEntries(item.metadata);
  const canEdit = role !== "viewer";

  return (
    <main className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-8 sm:py-10 lg:px-12" id="main-content">
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <li><Link className="rounded-sm underline decoration-rule underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href="/app">Overview</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link className="rounded-sm underline decoration-rule underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href="/app/items">Items</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-semibold text-ink">{item.item_key}</li>
        </ol>
      </nav>

      <header className="grid gap-6 border-b border-rule pb-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[0.64rem] uppercase tracking-[0.11em]">
            <span className="border border-rule bg-white px-2.5 py-1.5 text-muted">{label(item.item_type)}</span>
            <span className="border border-signal/25 bg-[#eef1ff] px-2.5 py-1.5 text-signal">Synthetic record</span>
            <span className="text-muted">Version {item.version}</span>
          </div>
          <p className="mt-5 font-mono text-sm font-semibold text-signal">{item.item_key}</p>
          <h1 className="mt-2 max-w-4xl break-words text-4xl font-semibold tracking-[-0.055em] text-ink sm:text-5xl">
            {item.title}
          </h1>
          <p className="mt-4 max-w-3xl break-words text-base leading-7 text-muted">
            {item.description ?? "No description or rationale is recorded for this item yet."}
          </p>
        </div>
        <ProjectItemEditor
          canEdit={canEdit}
          item={{
            id: item.id,
            itemKey: item.item_key,
            itemType: item.item_type,
            title: item.title,
            description: item.description,
            status: item.status,
            priority: item.priority,
            ownerId: item.owner_id,
            startDate: item.start_date,
            dueDate: item.due_date,
            eventDate: item.event_date,
            version: item.version,
          }}
          memberOptions={memberOptions}
          projectId={overview.project.id}
        />
      </header>

      <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="border border-rule bg-white" aria-labelledby="item-details-heading">
          <div className="border-b border-rule px-5 py-4">
            <p className="font-mono text-[0.63rem] uppercase tracking-[0.12em] text-signal">Current server state</p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]" id="item-details-heading">Item details</h2>
          </div>
          <dl className="grid gap-px bg-rule sm:grid-cols-2">
            {[
              ["Status", label(item.status)],
              ["Priority", item.priority],
              ["Assignee", item.owner?.display_name ?? "Unassigned"],
              ["Start date", formatDate(item.start_date)],
              ["Due date", formatDate(item.due_date)],
              ["Event date", formatDate(item.event_date)],
            ].map(([term, value]) => (
              <div className="min-w-0 bg-white px-5 py-4" key={term}>
                <dt className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted">{term}</dt>
                <dd className="mt-2 break-words text-sm font-semibold capitalize text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          {metadata.length > 0 ? (
            <div className="border-t border-rule px-5 py-4">
              <h3 className="text-sm font-semibold">Additional seeded context</h3>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                {metadata.map(([term, value]) => (
                  <div key={term}>
                    <dt className="text-xs capitalize text-muted">{term}</dt>
                    <dd className="mt-1 text-sm font-semibold capitalize">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </section>

        <section className="border border-rule bg-white" aria-labelledby="relationships-heading">
          <div className="flex flex-col gap-3 border-b border-rule px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[0.63rem] uppercase tracking-[0.12em] text-signal">Explicit dependency direction</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]" id="relationships-heading">Relationships</h2>
            </div>
            <Link className="inline-flex min-h-10 items-center gap-2 rounded-sm text-sm font-semibold text-signal underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href={`/app/dependencies?item=${item.id}`}>
              Manage relationships <GitBranch className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-px bg-rule lg:grid-cols-2">
            <div className="bg-white p-5">
              <h3 className="flex items-center gap-2 text-base font-semibold"><ArrowLeft className="size-4 text-signal" aria-hidden="true" />Depends on</h3>
              <p className="mt-2 text-sm leading-6 text-muted">Upstream records this item requires or uses as context.</p>
              <ul className="mt-4 grid gap-3">
                {prerequisites.length === 0 ? (
                  <li className="border border-dashed border-rule bg-paper p-4 text-sm text-muted">No upstream relationships.</li>
                ) : prerequisites.map((dependency) => (
                  <li className="border border-rule p-4" key={dependency.id}>
                    <Link className="font-semibold text-ink underline decoration-rule underline-offset-4 hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href={`/app/items/${dependency.upstream.id}`}>
                      {dependency.upstream.item_key} — {dependency.upstream.title}
                    </Link>
                    <p className="mt-2 text-xs uppercase tracking-[0.08em] text-muted">Relationship: {label(dependency.relationship)}</p>
                    {dependency.rationale ? <p className="mt-2 text-sm leading-6 text-muted">{dependency.rationale}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white p-5">
              <h3 className="flex items-center gap-2 text-base font-semibold">Affects <ArrowRight className="size-4 text-signal" aria-hidden="true" /></h3>
              <p className="mt-2 text-sm leading-6 text-muted">Downstream records that depend on this item.</p>
              <ul className="mt-4 grid gap-3">
                {dependents.length === 0 ? (
                  <li className="border border-dashed border-rule bg-paper p-4 text-sm text-muted">No downstream relationships.</li>
                ) : dependents.map((dependency) => (
                  <li className="border border-rule p-4" key={dependency.id}>
                    <Link className="font-semibold text-ink underline decoration-rule underline-offset-4 hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href={`/app/items/${dependency.dependent.id}`}>
                      {dependency.dependent.item_key} — {dependency.dependent.title}
                    </Link>
                    <p className="mt-2 text-xs uppercase tracking-[0.08em] text-muted">Depends on this item · {label(dependency.relationship)}</p>
                    {dependency.rationale ? <p className="mt-2 text-sm leading-6 text-muted">{dependency.rationale}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6 text-sm text-muted">
        <Link className="inline-flex items-center gap-2 font-semibold text-ink underline decoration-rule underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href="/app/items">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to project items
        </Link>
        <span className="inline-flex items-center gap-2"><CalendarDays className="size-4" aria-hidden="true" />Updated {formatDate(item.updated_at.slice(0, 10))}</span>
      </footer>
    </main>
  );
}

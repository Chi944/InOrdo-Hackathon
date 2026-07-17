import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  CircleDot,
  FileText,
  GitBranch,
  History,
  ListChecks,
} from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { AuthorizationError } from "@/lib/auth/errors";
import {
  requireProjectToWorkspace,
  requireUser,
} from "@/lib/auth/guards";
import {
  getDemoWorkspaceProject,
  getProjectOverview,
  listImpactRunsAndProposals,
  listOperations,
  listProjectItems,
  listSourceUpdates,
} from "@/lib/repositories/project-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  return value ? format(parseISO(value), "MMM d, yyyy") : "Not scheduled";
}

export default async function DemoWorkspacePage() {
  let loadError: unknown;
  let result:
    | {
        overview: Awaited<ReturnType<typeof getProjectOverview>>;
        items: Awaited<ReturnType<typeof listProjectItems>>;
        sources: Awaited<ReturnType<typeof listSourceUpdates>>;
        planning: Awaited<ReturnType<typeof listImpactRunsAndProposals>>;
        operations: Awaited<ReturnType<typeof listOperations>>;
        role: string;
      }
    | undefined;

  try {
    const client = await createServerSupabaseClient();
    const user = await requireUser(client);
    const demoProject = await getDemoWorkspaceProject(client);
    const scope = await requireProjectToWorkspace(
      client,
      user.id,
      demoProject.workspace_id,
      demoProject.id,
    );

    const [overview, items, sources, planning, operations] = await Promise.all([
      getProjectOverview(client, scope),
      listProjectItems(client, scope),
      listSourceUpdates(client, scope),
      listImpactRunsAndProposals(client, scope),
      listOperations(client, scope),
    ]);

    result = {
      overview,
      items,
      sources,
      planning,
      operations,
      role: scope.membership.role,
    };
  } catch (error) {
    loadError = error;
  }

  if (loadError instanceof AuthorizationError) {
    if (loadError.code === "unauthenticated") {
      redirect("/login?next=/app");
    }
    if (loadError.code === "not_found") {
      notFound();
    }
  }

  if (loadError) {
    throw loadError;
  }

  if (!result) {
    throw new Error("The project overview could not be loaded.");
  }

  const { overview, items, sources, planning, operations, role } = result;
  const workspace = overview.project.workspace;
  const summaryCards = [
    {
      label: "Project items",
      value: overview.counts.items,
      icon: ListChecks,
    },
    {
      label: "Source updates",
      value: overview.counts.sources,
      icon: FileText,
    },
    {
      label: "Recovery proposals",
      value: overview.counts.proposals,
      icon: GitBranch,
    },
    {
      label: "Operations",
      value: overview.counts.operations,
      icon: History,
    },
  ] as const;

  return (
    <main className="mx-auto w-full max-w-[90rem] px-5 py-10 sm:px-8 lg:px-12" id="main-content">
      <div className="flex flex-col gap-6 border-b border-rule pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.15em] text-signal">
            {workspace?.name ?? "Demo workspace"} · Authenticated preview
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.055em] text-ink sm:text-5xl">
            {overview.project.name}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted">
            {overview.project.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 font-mono text-[0.65rem] uppercase tracking-[0.1em]">
          <span className="border border-rule bg-white px-3 py-2 text-muted">
            Role: {role}
          </span>
          <span className="border border-signal/25 bg-[#eef1ff] px-3 py-2 text-signal">
            Read-only foundation
          </span>
        </div>
      </div>

      <section className="grid border-l border-t border-rule sm:grid-cols-2 xl:grid-cols-4" aria-label="Project summary">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <article className="border-b border-r border-rule bg-white p-5" key={label}>
            <div className="flex items-center justify-between text-muted">
              <span className="font-mono text-[0.64rem] uppercase tracking-[0.12em]">
                {label}
              </span>
              <Icon className="size-4" aria-hidden="true" />
            </div>
            <p className="mt-7 text-4xl font-semibold tracking-[-0.06em] text-ink">
              {value}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-10 border border-rule bg-white" aria-labelledby="items-heading">
        <div className="flex flex-col gap-2 border-b border-rule px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
              Live Supabase data
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em] text-ink" id="items-heading">
              Canonical project items
            </h2>
          </div>
          <p className="text-sm text-muted">Showing {items.data.length} of {items.total}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <thead className="bg-paper font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted">
              <tr>
                <th className="border-b border-rule px-5 py-3 font-medium" scope="col">Item</th>
                <th className="border-b border-rule px-4 py-3 font-medium" scope="col">Type</th>
                <th className="border-b border-rule px-4 py-3 font-medium" scope="col">Status</th>
                <th className="border-b border-rule px-4 py-3 font-medium" scope="col">Owner</th>
                <th className="border-b border-rule px-4 py-3 font-medium" scope="col">Due / event</th>
                <th className="border-b border-rule px-4 py-3 font-medium" scope="col">Version</th>
              </tr>
            </thead>
            <tbody>
              {items.data.map((item) => (
                <tr className="border-b border-rule last:border-b-0" key={item.id}>
                  <th className="px-5 py-4 font-medium text-ink" scope="row">
                    <span className="mr-3 font-mono text-[0.65rem] text-signal">{item.item_key}</span>
                    {item.title}
                  </th>
                  <td className="px-4 py-4 capitalize text-muted">{item.item_type}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-2 text-ink">
                      <CircleDot className="size-3.5 text-signal" aria-hidden="true" />
                      {item.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-muted">{item.owner?.display_name ?? "Unassigned"}</td>
                  <td className="px-4 py-4 text-muted">
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="size-3.5" aria-hidden="true" />
                      {formatDate(item.event_date ?? item.due_date)}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-mono text-muted">v{item.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-3" aria-label="Workflow readiness">
        {[
          ["Evidence", sources.data.length, "No source update has been submitted in the baseline."],
          ["Impact and proposals", planning.impacts.length + planning.proposals.length, "Deterministic analysis and recovery drafting are not connected yet."],
          ["Operation history", operations.data.length, "No mutation operation exists in the baseline."],
        ].map(([label, count, emptyCopy]) => (
          <article className="border border-rule bg-white p-5" key={String(label)}>
            <p className="font-mono text-[0.63rem] uppercase tracking-[0.12em] text-muted">{label}</p>
            <p className="mt-4 text-2xl font-semibold text-ink">{count}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{Number(count) === 0 ? emptyCopy : "Reviewable records are available."}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

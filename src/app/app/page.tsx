import { format, parseISO } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  FileText,
  GitBranch,
  ListChecks,
  ShieldAlert,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { buildGuidedDemoTargets } from "@/app/app/demo-targets";
import { GuidedDemoCallout } from "@/app/app/guided-demo-callout";
import { ImpactWorkflow } from "@/app/app/impact-workflow";
import { buildWorkflowOverview } from "@/app/app/workflow-overview";
import { createProjectRecordOperations } from "@/features/project-records/operations";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireProjectToWorkspace, requireUser } from "@/lib/auth/guards";
import {
  getDemoWorkspaceProject,
  getProjectOverview,
  listProjectItems,
} from "@/lib/repositories/project-data";
import { getImpactWorkflowData } from "@/lib/repositories/impact-review";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DemoWorkspacePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatDate(value: string | null) {
  return value ? format(parseISO(value), "MMM d, yyyy") : "Not scheduled";
}

function words(value: string) {
  return value.replaceAll("_", " ");
}

export default async function DemoWorkspacePage({
  searchParams,
}: DemoWorkspacePageProps) {
  const query = await searchParams;
  const requestedAnalysisId =
    typeof query.analysisRequestId === "string" &&
    uuidPattern.test(query.analysisRequestId)
      ? query.analysisRequestId
      : undefined;
  let loadError: unknown;
  let result:
    | {
        overview: Awaited<ReturnType<typeof getProjectOverview>>;
        items: Awaited<ReturnType<typeof listProjectItems>>;
        workflow: Awaited<ReturnType<typeof getImpactWorkflowData>>;
        dependencies: Awaited<
          ReturnType<
            ReturnType<typeof createProjectRecordOperations>["listDependencies"]
          >
        >;
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
    const projectRecords = createProjectRecordOperations({ client });
    const [overview, items, workflow, dependencies] =
      await Promise.all([
        getProjectOverview(client, scope),
        listProjectItems(client, scope),
        getImpactWorkflowData(client, scope, {
          analysisRequestId: requestedAnalysisId,
        }),
        projectRecords.listDependencies(scope.projectId),
      ]);

    result = {
      overview,
      items,
      workflow,
      dependencies,
      role: scope.membership.role,
    };
  } catch (error) {
    loadError = error;
  }

  if (loadError instanceof AuthorizationError) {
    if (loadError.code === "unauthenticated") redirect("/login?next=/app");
    if (loadError.code === "not_found") notFound();
  }
  if (loadError) throw loadError;
  if (!result) throw new Error("The project overview could not be loaded.");

  const {
    dependencies,
    items,
    overview,
    role,
    workflow,
  } = result;
  const workspace = overview.project.workspace;
  const eventItem = items.data.find((item) => item.item_type === "event");
  const upcomingMilestones = items.data
    .filter(
      (item) =>
        item.item_type === "milestone" &&
        !["completed", "cancelled"].includes(item.status),
    )
    .sort((left, right) =>
      (left.due_date ?? "9999-12-31").localeCompare(
        right.due_date ?? "9999-12-31",
      ),
    )
    .slice(0, 3);
  const openRisksAndBlockers = items.data.filter(
    (item) =>
      (item.item_type === "risk" || item.status === "blocked") &&
      !["completed", "cancelled"].includes(item.status),
  );
  const team = [
    ...new Map(
      items.data.flatMap((item) =>
        item.owner
          ? [[item.owner.id, item.owner] as const]
          : [],
      ),
    ).values(),
  ].sort((left, right) => left.display_name.localeCompare(right.display_name));
  const latestSource = workflow.analysis?.source;
  const workflowOverview = buildWorkflowOverview({
    analysisLoadFailed: workflow.analysisLoadFailed,
    operationsLoadFailed: workflow.operationsLoadFailed,
    impactCount: workflow.analysis?.impacts.length ?? 0,
    hasProposal: Boolean(workflow.analysis?.proposal),
    operationCount: workflow.operations.length,
  });
  const summaryCards = [
    { label: "Project items", value: overview.counts.items, icon: ListChecks },
    { label: "Dependencies", value: dependencies.length, icon: GitBranch },
    {
      label: "Risks / blockers",
      value: openRisksAndBlockers.length,
      icon: ShieldAlert,
    },
    { label: "Evidence updates", value: overview.counts.sources, icon: FileText },
  ] as const;

  const quickLinks = [
    {
      href: "/app/items",
      label: "Items",
      detail: `${items.total} canonical records`,
    },
    {
      href: "/app/dependencies",
      label: "Dependencies",
      detail: `${dependencies.length} explicit relationships`,
    },
    {
      href: "#impact-status",
      label: "Impacts",
      detail: workflowOverview.impactDetail,
    },
    {
      href: "#history-status",
      label: "History",
      detail: workflowOverview.historyDetail,
    },
  ] as const;

  return (
    <main
      className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-8 sm:py-10 lg:px-12"
      id="main-content"
    >
      <header className="grid gap-6 border-b border-rule pb-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.15em] text-signal">
            {workspace?.name ?? "Demo workspace"} ·{" "}
            {overview.project.is_demo
              ? "Synthetic project"
              : "Authenticated project"}
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
            {eventItem
              ? `Event ${formatDate(eventItem.event_date)}`
              : "No event record"}
          </span>
        </div>
      </header>

      <section
        aria-label="Project summary"
        className="grid border-l border-t border-rule sm:grid-cols-2 xl:grid-cols-4"
      >
        {summaryCards.map(({ icon: Icon, label, value }) => (
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

      <div className="mt-6">
        <GuidedDemoCallout
          seedNote="The current canonical seed has no sponsor record or sponsor relationship, so this interface does not fabricate one."
          targets={buildGuidedDemoTargets(items.data)}
        />
      </div>

      <section className="mt-6 border-l-2 border-signal bg-[#eef1ff] px-4 py-3 text-sm leading-6 text-ink" aria-label="Workspace data notice">
        <p className="font-semibold">Synthetic demonstration workspace</p>
        <p className="mt-1 text-muted">
          All names, records, dates, and seeded source text are fictional. Only results returned by the real analysis and operation contracts appear in the review below.
        </p>
      </section>

      <div className="mt-6">
        <ImpactWorkflow
          data={workflow}
          projectId={overview.project.id}
          role={role}
          syntheticWorkspace={overview.project.is_demo}
        />
      </div>

      <section aria-labelledby="quick-links-heading" className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
              Project navigation
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]" id="quick-links-heading">
              Open a project view
            </h2>
          </div>
        </div>
        <div className="grid border-l border-t border-rule sm:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((link) => (
            <Link
              className="group min-w-0 border-b border-r border-rule bg-white p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              href={link.href}
              key={link.label}
            >
              <span className="flex items-center justify-between gap-3 font-semibold text-ink">
                {link.label}
                <ArrowRight className="size-4 text-signal transition group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
              <span className="mt-2 block text-sm leading-6 text-muted">{link.detail}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8 grid min-w-0 gap-5 xl:grid-cols-2">
        <section className="min-w-0 border border-rule bg-white" aria-labelledby="milestones-heading">
          <div className="border-b border-rule px-5 py-4">
            <p className="font-mono text-[0.63rem] uppercase tracking-[0.12em] text-signal">
              Schedule
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]" id="milestones-heading">
              Upcoming milestones
            </h2>
          </div>
          {upcomingMilestones.length > 0 ? (
            <ul className="divide-y divide-rule">
              {upcomingMilestones.map((item) => (
                <li className="flex min-w-0 items-start justify-between gap-4 px-5 py-4" key={item.id}>
                  <div className="min-w-0">
                    <Link className="font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href={`/app/items/${item.id}`}>
                      {item.item_key} — {item.title}
                    </Link>
                    <p className="mt-1 text-xs capitalize text-muted">{words(item.status)}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-2 text-sm text-muted">
                    <CalendarDays className="size-4" aria-hidden="true" />
                    {formatDate(item.due_date)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm leading-6 text-muted">No open milestones are recorded.</p>
          )}
        </section>

        <section className="min-w-0 border border-rule bg-white" aria-labelledby="risks-heading">
          <div className="flex items-end justify-between gap-4 border-b border-rule px-5 py-4">
            <div>
              <p className="font-mono text-[0.63rem] uppercase tracking-[0.12em] text-caution">
                Attention
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]" id="risks-heading">
                Open risks and blockers
              </h2>
            </div>
            <Link className="text-sm font-semibold text-signal underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href="/app/risks">
              View all
            </Link>
          </div>
          {openRisksAndBlockers.length > 0 ? (
            <ul className="divide-y divide-rule">
              {openRisksAndBlockers.slice(0, 3).map((item) => (
                <li className="px-5 py-4" key={item.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="border border-caution bg-caution-soft px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-ink">
                      {words(item.status)}
                    </span>
                    <span className="text-xs capitalize text-muted">{item.priority} priority</span>
                  </div>
                  <Link className="mt-2 inline-block font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href={`/app/items/${item.id}`}>
                    {item.item_key} — {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm leading-6 text-muted">No open risk records are visible.</p>
          )}
        </section>

        <section className="min-w-0 border border-rule bg-white" aria-labelledby="source-heading">
          <div className="border-b border-rule px-5 py-4">
            <p className="font-mono text-[0.63rem] uppercase tracking-[0.12em] text-signal">
              Evidence
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]" id="source-heading">
              Selected analysis source
            </h2>
          </div>
          {workflowOverview.analysisUnavailable ? (
            <div className="p-5">
              <p className="font-semibold text-caution">
                Analysis source unavailable
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                The latest evidence record could not be loaded. Refresh before
                relying on source status.
              </p>
            </div>
          ) : latestSource ? (
            <div className="p-5">
              <p className="font-semibold text-ink">{latestSource.title}</p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">Source type</dt>
                  <dd className="mt-1 capitalize text-ink">{words(latestSource.sourceKind)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Occurred</dt>
                  <dd className="mt-1 text-ink">
                    {formatDate(
                      latestSource.occurredAt
                        ? latestSource.occurredAt.slice(0, 10)
                        : null,
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="p-5">
              <p className="font-semibold text-ink">No source update in the reset baseline</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Evidence appears here only after an authenticated user submits a real source update.
              </p>
            </div>
          )}
        </section>

        <section className="min-w-0 border border-rule bg-white" aria-labelledby="team-heading">
          <div className="border-b border-rule px-5 py-4">
            <p className="font-mono text-[0.63rem] uppercase tracking-[0.12em] text-signal">
              <Users className="mr-2 inline size-4" aria-hidden="true" />
              Assigned team
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]" id="team-heading">
              People on project items
            </h2>
          </div>
          {team.length > 0 ? (
            <ul className="grid gap-px bg-rule sm:grid-cols-2">
              {team.map((member) => (
                <li className="min-w-0 bg-white px-5 py-4" key={member.id}>
                  <p className="truncate text-sm font-semibold text-ink">{member.display_name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {items.data.filter((item) => item.owner?.id === member.id).length} assigned records
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm leading-6 text-muted">No visible items are assigned.</p>
          )}
        </section>
      </div>

      <section aria-label="Workflow readiness" className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="border border-rule bg-white p-5" id="impact-status">
          <p className="font-mono text-[0.63rem] uppercase tracking-[0.12em] text-muted">Impact and proposals</p>
          <p className="mt-4 text-2xl font-semibold text-ink">
            {workflowOverview.reviewRecordCountLabel}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            {workflowOverview.reviewMessage}
          </p>
        </article>
        <article className="border border-rule bg-white p-5" id="history-status">
          <p className="font-mono text-[0.63rem] uppercase tracking-[0.12em] text-muted">Operation history</p>
          <p className="mt-4 text-2xl font-semibold text-ink">
            {workflowOverview.operationCountLabel}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            {workflowOverview.operationMessage}
          </p>
        </article>
      </section>
    </main>
  );
}

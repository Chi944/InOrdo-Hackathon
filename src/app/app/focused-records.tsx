import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  UserRound,
} from "lucide-react";
import Link from "next/link";

export type FocusedRecordStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "at_risk"
  | "completed"
  | "cancelled";

export type FocusedRecordPriority = "low" | "medium" | "high" | "critical";

export type FocusedProjectItem = {
  id: string;
  itemKey: string;
  itemType: "task" | "milestone" | "decision" | "event" | "risk" | "artifact";
  title: string;
  description: string | null;
  status: FocusedRecordStatus;
  priority: FocusedRecordPriority;
  ownerName: string | null;
  dueDate: string | null;
  eventDate?: string | null;
  metadata?: unknown;
};

export type FocusedProjectDependency = {
  id: string;
  fromItemId: string;
  toItemId: string;
  relationship: "depends_on" | "requires" | "informs" | "scheduled_by";
  rationale: string | null;
};

type FocusedRecordsProps = {
  items: readonly FocusedProjectItem[];
  dependencies: readonly FocusedProjectDependency[];
  backHref: string;
  backLabel?: string;
  itemHrefPrefix: string;
};

type RecordSectionProps = Pick<
  FocusedRecordsProps,
  "items" | "dependencies" | "itemHrefPrefix"
>;

const labelClass =
  "font-mono text-[0.63rem] uppercase tracking-[0.12em] text-muted";

function words(value: string) {
  return value.replaceAll("_", " ");
}

function titleCase(value: string) {
  return words(value).replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not scheduled";

  const parsed = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function itemHref(prefix: string, id: string) {
  return `${prefix.replace(/\/$/, "")}/${encodeURIComponent(id)}`;
}

function metadataValue(metadata: unknown, key: "likelihood" | "impact") {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function RecordIdentity({ item }: { item: FocusedProjectItem }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-signal">
        {item.itemKey}
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-[-0.025em] text-ink">
        {item.title}
      </h3>
    </div>
  );
}

function RecordFacts({ item }: { item: FocusedProjectItem }) {
  return (
    <dl className="mt-5 grid gap-4 border-t border-rule pt-4 sm:grid-cols-3">
      <div>
        <dt className={labelClass}>Owner</dt>
        <dd className="mt-2 flex items-center gap-2 text-sm text-ink">
          <UserRound className="size-4 shrink-0 text-muted" aria-hidden="true" />
          {item.ownerName ?? "Unassigned"}
        </dd>
      </div>
      <div>
        <dt className={labelClass}>Due date</dt>
        <dd className="mt-2 flex items-center gap-2 text-sm text-ink">
          <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden="true" />
          {formatDate(item.eventDate ?? item.dueDate)}
        </dd>
      </div>
      <div>
        <dt className={labelClass}>Priority</dt>
        <dd className="mt-2 text-sm text-ink">{titleCase(item.priority)}</dd>
      </div>
    </dl>
  );
}

function StatusBadge({ status }: { status: FocusedRecordStatus }) {
  const completed = status === "completed";
  const Icon = completed ? CheckCircle2 : CircleDot;

  return (
    <span className="inline-flex shrink-0 items-center gap-2 border border-rule bg-paper px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-ink">
      <Icon className="size-3.5 text-signal" aria-hidden="true" />
      {titleCase(status)}
    </span>
  );
}

function DetailLink({
  item,
  itemHrefPrefix,
}: {
  item: FocusedProjectItem;
  itemHrefPrefix: string;
}) {
  return (
    <Link
      className="mt-5 inline-flex min-h-10 items-center border border-rule px-3 text-sm font-semibold text-ink transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
      href={itemHref(itemHrefPrefix, item.id)}
    >
      View item details
      <span className="sr-only"> for {item.itemKey}: {item.title}</span>
    </Link>
  );
}

function connectedRationales(
  itemId: string,
  dependencies: readonly FocusedProjectDependency[],
) {
  return dependencies
    .filter(
      (dependency) =>
        dependency.fromItemId === itemId || dependency.toItemId === itemId,
    )
    .map((dependency) => dependency.rationale?.trim())
    .filter((rationale): rationale is string => Boolean(rationale));
}

export function DecisionRecords({
  items,
  dependencies,
  itemHrefPrefix,
}: RecordSectionProps) {
  const decisions = items.filter((item) => item.itemType === "decision");

  return (
    <section aria-labelledby="decisions-heading" id="decisions">
      <div className="border-b border-rule pb-4">
        <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
          Recorded choices
        </p>
        <h2
          className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-ink"
          id="decisions-heading"
        >
          Decisions
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Review the recorded status, ownership, and rationale behind project
          choices.
        </p>
      </div>

      {decisions.length === 0 ? (
        <div className="border border-t-0 border-rule bg-white p-6">
          <p className="font-medium text-ink">No decisions recorded</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Decision records will appear here when they are added to this
            project.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 pt-4 xl:grid-cols-2">
          {decisions.map((item) => {
            const rationales = connectedRationales(item.id, dependencies);
            const rationale = item.description?.trim();

            return (
              <article className="border border-rule bg-white p-5" key={item.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <RecordIdentity item={item} />
                  <StatusBadge status={item.status} />
                </div>

                <div className="mt-5 border-l-2 border-signal pl-4">
                  <p className={labelClass}>Decision rationale</p>
                  <p className="mt-2 text-sm leading-6 text-ink">
                    {rationale || "Decision rationale not recorded."}
                  </p>
                </div>

                {rationales.length > 0 && (
                  <div className="mt-4 bg-paper p-4">
                    <p className={labelClass}>Connected dependency context</p>
                    <ul className="mt-2 grid gap-2 text-sm leading-6 text-muted">
                      {rationales.map((connectedRationale, index) => (
                        <li className="flex gap-2" key={`${item.id}:${index}`}>
                          <span className="text-signal" aria-hidden="true">—</span>
                          <span>{connectedRationale}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <RecordFacts item={item} />
                <DetailLink item={item} itemHrefPrefix={itemHrefPrefix} />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

const closedRiskStatuses: ReadonlySet<FocusedRecordStatus> = new Set([
  "completed",
  "cancelled",
]);

export function RiskRecords({ items, itemHrefPrefix }: RecordSectionProps) {
  const openRisksAndBlockers = items.filter(
    (item) =>
      (item.itemType === "risk" || item.status === "blocked") &&
      !closedRiskStatuses.has(item.status),
  );

  return (
    <section className="mt-12" aria-labelledby="risks-heading" id="risks">
      <div className="border-b border-rule pb-4">
        <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-caution">
          Active attention
        </p>
        <h2
          className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-ink"
          id="risks-heading"
        >
          Open risks and blockers
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Showing {openRisksAndBlockers.length} active {openRisksAndBlockers.length === 1 ? "record" : "records"}.
          Open risks and blocked project items are included; completed and cancelled records are excluded.
        </p>
      </div>

      {openRisksAndBlockers.length === 0 ? (
        <div className="border border-t-0 border-rule bg-white p-6">
          <p className="font-medium text-ink">No open risks or blockers</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            This view only includes risk records that still need attention.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 pt-4 xl:grid-cols-2">
          {openRisksAndBlockers.map((item) => {
            const likelihood = metadataValue(item.metadata, "likelihood");
            const impact = metadataValue(item.metadata, "impact");
            const isBlocker = item.status === "blocked";

            return (
              <article className="border border-rule bg-white p-5" key={item.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <RecordIdentity item={item} />
                  <div className="flex flex-wrap gap-2">
                    {isBlocker && (
                      <span className="inline-flex items-center gap-2 border border-caution bg-caution-soft px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-ink">
                        <AlertTriangle className="size-3.5 text-caution" aria-hidden="true" />
                        Blocker
                      </span>
                    )}
                    <StatusBadge status={item.status} />
                  </div>
                </div>

                {item.description?.trim() && (
                  <p className="mt-4 text-sm leading-6 text-muted">
                    {item.description.trim()}
                  </p>
                )}

                <dl className="mt-5 grid grid-cols-2 gap-3 bg-caution-soft p-4">
                  <div>
                    <dt className={labelClass}>Likelihood</dt>
                    <dd className="mt-2 text-sm font-medium text-ink">
                      {likelihood ? titleCase(likelihood) : "Not recorded"}
                    </dd>
                  </div>
                  <div>
                    <dt className={labelClass}>Impact</dt>
                    <dd className="mt-2 text-sm font-medium text-ink">
                      {impact ? titleCase(impact) : "Not recorded"}
                    </dd>
                  </div>
                </dl>

                <RecordFacts item={item} />
                <DetailLink item={item} itemHrefPrefix={itemHrefPrefix} />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function FocusedRecords({
  items,
  dependencies,
  backHref,
  backLabel = "Back to project",
  itemHrefPrefix,
}: FocusedRecordsProps) {
  return (
    <div>
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
        href={backHref}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {backLabel}
      </Link>

      <nav className="my-6 flex flex-wrap gap-2" aria-label="Focused record views">
        <a
          className="inline-flex min-h-10 items-center border border-rule bg-white px-3 text-sm font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          href="#decisions"
        >
          Decisions
        </a>
        <a
          className="inline-flex min-h-10 items-center border border-rule bg-white px-3 text-sm font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          href="#risks"
        >
          Open risks
        </a>
      </nav>

      <DecisionRecords
        dependencies={dependencies}
        itemHrefPrefix={itemHrefPrefix}
        items={items}
      />
      <RiskRecords
        dependencies={dependencies}
        itemHrefPrefix={itemHrefPrefix}
        items={items}
      />
    </div>
  );
}

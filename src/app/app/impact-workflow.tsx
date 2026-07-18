"use client";

import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  History,
  LoaderCircle,
  RotateCcw,
  Route,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";

import type {
  AnalysisReview,
  ChangeReview,
  ImpactReviewItem,
  ImpactWorkflowData,
  OperationSummary,
  ReviewItem,
} from "@/app/app/impact-workflow-types";
import {
  type ApplyResult,
  RecoveryActionReview,
} from "@/app/app/recovery-action-review";
import {
  type AnalysisSubmitResult,
  SourceUpdateForm,
} from "@/app/app/source-update-form";

type ImpactWorkflowProps = {
  projectId: string;
  role: string;
  syntheticWorkspace: boolean;
  data: ImpactWorkflowData;
};

type UndoConflict = {
  itemId: string;
  expectedVersion: number;
  actualVersion: number | null;
  reason: string;
};

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function titleCase(value: string) {
  const normalized = humanize(value);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function valueLabel(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  try {
    return JSON.stringify(value);
  } catch {
    return "Recorded value";
  }
}

function dateTimeLabel(value: string | null) {
  if (!value) return "Time not supplied";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

function dateLabel(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function confidenceLabel(confidence: number | null) {
  if (confidence === null) return "Confidence unavailable";
  return confidence >= 0.8
    ? `Higher confidence · ${Math.round(confidence * 100)}%`
    : `Needs closer review · ${Math.round(confidence * 100)}%`;
}

function reviewReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    human_approval_required: "Human approval required",
    low_confidence: "Lower model confidence",
    previous_value_mismatch: "Model previous value differed from the canonical record",
    model_uncertainty: "Model reported uncertainty",
  };
  return labels[reason] ?? titleCase(reason);
}

function confirmationCopy(state: ChangeReview["state"]) {
  if (state === "confirmed") {
    return "This candidate was confirmed through a recorded proposal approval. Source evidence and model inference remain separately labeled.";
  }
  if (state === "rejected") {
    return "This candidate was rejected and is not an approved source-of-truth change.";
  }
  if (state === "superseded") {
    return "This candidate was superseded by a later review record and cannot be approved from this proposal.";
  }
  return "A successful selected-action approval confirms this candidate. There is no separate pre-impact confirmation route.";
}

function ItemMetadata({ item }: { item: ReviewItem }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
      <div>
        <dt className="font-mono uppercase tracking-[0.08em] text-muted">Type</dt>
        <dd className="mt-1 text-ink">{titleCase(item.itemType)}</dd>
      </div>
      <div>
        <dt className="font-mono uppercase tracking-[0.08em] text-muted">Status</dt>
        <dd className="mt-1 text-ink">{titleCase(item.status)}</dd>
      </div>
      <div>
        <dt className="font-mono uppercase tracking-[0.08em] text-muted">Owner</dt>
        <dd className="mt-1 text-ink">{item.ownerName ?? "Unassigned"}</dd>
      </div>
      <div>
        <dt className="font-mono uppercase tracking-[0.08em] text-muted">Date</dt>
        <dd className="mt-1 text-ink">{dateLabel(item.eventDate ?? item.dueDate)}</dd>
      </div>
    </dl>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border border-dashed border-rule bg-paper p-5 text-center">
      <p className="font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}

function AnalysisPipelineState({ state }: { state: "processing" | "failed" }) {
  return (
    <div className={`border-l-2 px-4 py-4 ${state === "failed" ? "border-red-700 bg-red-50" : "border-signal bg-[#f4f6ff]"}`}>
      <p className="flex items-center gap-2 font-semibold text-ink">
        {state === "processing" ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none text-signal" />
        ) : (
          <AlertCircle aria-hidden="true" className="size-4 text-red-700" />
        )}
        {state === "processing" ? "Analysis is still processing" : "Analysis did not complete"}
      </p>
      <p className="mt-1 text-sm leading-6 text-muted">
        {state === "processing"
          ? "The backend exposes one overall request state, not live stage events. Refresh to check for a completed review."
          : "The preserved source remains available below. No proposal action was applied."}
      </p>
    </div>
  );
}

function SourceEvidenceCard({ analysis }: { analysis: AnalysisReview }) {
  const source = analysis.source;
  if (!source) {
    return (
      <EmptyState
        description="The analysis record exists, but its preserved source is not currently readable."
        title="Source evidence unavailable"
      />
    );
  }
  return (
    <article className="border border-rule bg-white">
      <div className="flex flex-col gap-3 border-b border-rule px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-signal">
            <FileText aria-hidden="true" className="size-3.5" />
            Source fact · preserved evidence
          </p>
          <h3 className="mt-1 break-words text-lg font-semibold tracking-[-0.025em] text-ink [overflow-wrap:anywhere]">{source.title}</h3>
        </div>
        <span className="w-fit border border-rule bg-paper px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted">
          {humanize(source.sourceKind)}
        </span>
      </div>
      <div className="p-5">
        <blockquote className="whitespace-pre-wrap break-words border-l-2 border-ink pl-4 text-sm leading-7 text-ink [overflow-wrap:anywhere]">
          {source.rawText}
        </blockquote>
        <dl className="mt-5 grid gap-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="font-mono uppercase tracking-[0.08em] text-muted">Source author</dt>
            <dd className="mt-1 text-ink">{source.sourceAuthor ?? "Not supplied"}</dd>
          </div>
          <div>
            <dt className="font-mono uppercase tracking-[0.08em] text-muted">Occurred at</dt>
            <dd className="mt-1 text-ink">{dateTimeLabel(source.occurredAt)}</dd>
          </div>
          <div>
            <dt className="font-mono uppercase tracking-[0.08em] text-muted">Captured by</dt>
            <dd className="mt-1 text-ink">{source.capturedBy ?? "Authenticated reviewer"}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

function ChangeReviewCard({ analysis }: { analysis: AnalysisReview }) {
  const change = analysis.change;
  if (!change) {
    return (
      <EmptyState
        description="No reviewable candidate change is attached to this analysis."
        title="Candidate change unavailable"
      />
    );
  }
  const uncertainty = [
    ...change.ambiguities.map((message) => ({ kind: "Ambiguity", message })),
    ...change.unresolvedReferences.map((message) => ({ kind: "Unresolved reference", message })),
    ...change.warnings.map((message) => ({ kind: "Warning", message })),
  ];

  return (
    <article className="border border-ink bg-ink text-paper">
      <div className="flex flex-col gap-3 border-b border-white/15 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-[#AEBEFF]">
            <Bot aria-hidden="true" className="size-3.5" />
            GPT-5.6 inference · not a source fact
          </p>
          <h3 className="mt-1 break-words text-lg font-semibold tracking-[-0.025em] [overflow-wrap:anywhere]">
            {change.item.itemKey} — {change.item.title}
          </h3>
        </div>
        <span className="w-fit border border-[#E1B06F]/50 bg-[#4a3522] px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-[#FFD59D]">
          {change.state === "needs_confirmation" ? "Needs human confirmation" : humanize(change.state)}
        </span>
      </div>
      <div className="p-5">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.11em] text-[#AAB4AF]">
          Changed field · {humanize(change.fieldName)}
        </p>
        <div className="mt-3 grid gap-px bg-white/15 sm:grid-cols-2">
          <div className="bg-[#202c28] p-4">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[#AAB4AF]">Canonical old value</p>
            <p className="mt-2 break-words font-mono text-sm text-paper line-through decoration-[#E1B06F]">
              {valueLabel(change.previousValue)}
            </p>
          </div>
          <div className="bg-[#202c28] p-4">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[#AEBEFF]">Inferred new value</p>
            <p className="mt-2 break-words font-mono text-sm text-[#C9D3FF]">
              {valueLabel(change.proposedValue)}
            </p>
          </div>
        </div>

        <div className="mt-4 border border-white/15 p-4">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[#AAB4AF]">Source evidence excerpt</p>
          <p className="mt-2 break-words text-sm leading-6 text-paper [overflow-wrap:anywhere]">
            {change.evidenceText ?? "No evidence excerpt is available."}
          </p>
        </div>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="border border-white/15 p-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[#AAB4AF]">Confidence</p>
            <p className="mt-1 font-semibold text-paper">{confidenceLabel(change.confidence)}</p>
          </div>
          <div className="border border-[#E1B06F]/40 bg-[#2d2a23] p-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[#FFD59D]">
              {change.state === "needs_confirmation"
                ? "Confirmation requirement"
                : "Confirmation status"}
            </p>
            <p className="mt-1 text-paper">
              {confirmationCopy(change.state)}
            </p>
          </div>
        </div>

        <ItemMetadata item={change.item} />

        <div className="mt-5 border-t border-white/15 pt-4">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[#AAB4AF]">Review signals</p>
          {uncertainty.length > 0 ? (
            <ul className="mt-2 space-y-2 text-sm leading-6">
              {uncertainty.map(({ kind, message }, index) => (
                <li className="flex gap-2" key={`${kind}:${index}`}>
                  <TriangleAlert aria-hidden="true" className="mt-1 size-4 shrink-0 text-[#FFD59D]" />
                  <span><strong>{kind}:</strong> {message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 flex items-center gap-2 text-sm text-[#D5DBD8]">
              <CheckCircle2 aria-hidden="true" className="size-4 text-[#94D6B3]" />
              No ambiguity, unresolved-reference, or warning flags were recorded.
            </p>
          )}
          {change.reviewReasons.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {change.reviewReasons.map((reason) => (
                <span className="border border-white/15 px-2 py-1 text-xs text-[#D5DBD8]" key={reason}>
                  {reviewReasonLabel(reason)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ImpactCard({ impact }: { impact: ImpactReviewItem }) {
  return (
    <article className="border border-rule bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[0.61rem] uppercase tracking-[0.11em] text-signal">
            {impact.item.itemKey} · {impact.depth === 1 ? "Direct" : `${impact.depth} hops downstream`}
          </p>
          <h4 className="mt-1 break-words text-base font-semibold text-ink [overflow-wrap:anywhere]">{impact.item.title}</h4>
        </div>
        <span
          className={`w-fit border px-2 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${
            impact.severity === "critical"
              ? "border-red-700 bg-red-50 text-red-800"
              : impact.severity === "high"
                ? "border-caution/50 bg-caution-soft text-[#7a3907]"
                : impact.severity === "medium"
                  ? "border-signal/30 bg-[#eef1ff] text-signal"
                  : "border-rule bg-paper text-muted"
          }`}
        >
          {titleCase(impact.severity)} severity
        </span>
      </div>

      <ItemMetadata item={impact.item} />

      <div className="mt-4 border-t border-rule pt-4">
        <p className="flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">
          <Route aria-hidden="true" className="size-3.5" />
          Deterministic dependency path
        </p>
        <ol className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink" aria-label={`Dependency path to ${impact.item.title}`}>
          {impact.path.map((item, index) => (
            <li className="flex min-w-0 max-w-full items-center gap-2" key={`${item.id}:${index}`}>
              <span className="flex min-w-0 max-w-full flex-col border border-rule bg-paper px-2 py-1 text-xs">
                <span className="break-all font-mono">{item.itemKey}</span>
                <span className="break-words text-muted [overflow-wrap:anywhere]">{item.title}</span>
              </span>
              {index < impact.path.length - 1 ? (
                <ArrowRight aria-hidden="true" className="size-3.5 text-muted" />
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-4 border-l-2 border-signal bg-[#f4f6ff] px-3 py-3">
        <p className="flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-signal">
          <Sparkles aria-hidden="true" className="size-3.5" />
          GPT-generated explanation
        </p>
        <p className="mt-1 break-words text-sm leading-6 text-ink [overflow-wrap:anywhere]">{impact.explanation}</p>
      </div>
    </article>
  );
}

function ImpactReview({ analysis }: { analysis: AnalysisReview }) {
  const direct = analysis.impacts.filter((impact) => impact.depth === 1);
  const indirect = analysis.impacts.filter((impact) => impact.depth > 1);
  return (
    <section aria-labelledby="impact-review-heading" className="border border-rule bg-white">
      <div className="border-b border-rule px-5 py-5 lg:px-6">
        <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">03 · Deterministic reach</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-ink" id="impact-review-heading">
          Impact review
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Paths come from explicit dependency traversal. Severity and explanations are GPT-generated annotations over those paths.
        </p>
      </div>
      <div className="grid gap-6 p-5 lg:p-6">
        {analysis.impactState === "failed" ? (
          <div className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            Impact traversal failed. {analysis.impactError ?? "No safe error detail is available."}
          </div>
        ) : analysis.impactState !== "completed" ? (
          <EmptyState
            description="The analysis does not currently expose a completed deterministic impact run. No zero-impact claim is being made."
            title="Impact review unavailable"
          />
        ) : analysis.impacts.length === 0 ? (
          <EmptyState
            description="The deterministic traversal found no active dependent items. This is a valid result, not a generated placeholder."
            title="No downstream impacts found"
          />
        ) : (
          <>
            <section aria-labelledby="direct-impact-heading">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold tracking-[-0.025em] text-ink" id="direct-impact-heading">Direct impacts</h3>
                <span className="font-mono text-xs text-muted">{direct.length} at depth 1</span>
              </div>
              {direct.length > 0 ? (
                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  {direct.map((impact) => <ImpactCard impact={impact} key={impact.id} />)}
                </div>
              ) : (
                <p className="mt-3 border border-dashed border-rule bg-paper p-4 text-sm text-muted">No direct dependent items were found.</p>
              )}
            </section>
            <section aria-labelledby="indirect-impact-heading">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold tracking-[-0.025em] text-ink" id="indirect-impact-heading">Indirect impacts</h3>
                <span className="font-mono text-xs text-muted">{indirect.length} beyond depth 1</span>
              </div>
              {indirect.length > 0 ? (
                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  {indirect.map((impact) => <ImpactCard impact={impact} key={impact.id} />)}
                </div>
              ) : (
                <p className="mt-3 border border-dashed border-rule bg-paper p-4 text-sm text-muted">No indirect dependent items were found.</p>
              )}
            </section>
          </>
        )}
      </div>
    </section>
  );
}

function safeErrorMessage(body: unknown, fallback: string) {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }
  return fallback;
}

function undoConflicts(body: unknown): UndoConflict[] {
  if (
    typeof body !== "object" ||
    body === null ||
    !("error" in body) ||
    typeof body.error !== "object" ||
    body.error === null ||
    !("details" in body.error) ||
    typeof body.error.details !== "object" ||
    body.error.details === null ||
    !("conflicts" in body.error.details) ||
    !Array.isArray(body.error.details.conflicts)
  ) return [];
  return body.error.details.conflicts.flatMap((entry) => {
    if (
      typeof entry === "object" &&
      entry !== null &&
      typeof entry.itemId === "string" &&
      typeof entry.expectedVersion === "number" &&
      (entry.actualVersion === null || typeof entry.actualVersion === "number") &&
      typeof entry.reason === "string"
    ) return [entry as UndoConflict];
    return [];
  });
}

function AppliedResult({
  projectId,
  operations,
  operationsLoadFailed,
  canApprove,
  onUndoFinished,
}: {
  projectId: string;
  operations: OperationSummary[];
  operationsLoadFailed: boolean;
  canApprove: boolean;
  onUndoFinished(operationId: string): void;
}) {
  const latest = operations[0];
  const undoTarget = operations.find((operation) => operation.undoEligible);
  const [undoing, setUndoing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<UndoConflict[]>([]);
  const undoLock = useRef(false);
  const keyRef = useRef<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  async function undo() {
    if (!undoTarget || !canApprove || undoing || undoLock.current) return;
    undoLock.current = true;
    setUndoing(true);
    setMessage(null);
    setError(null);
    setConflicts([]);
    keyRef.current ??= `impact-ui:undo:${undoTarget.id}:${
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    }`;
    try {
      const response = await fetch(
        `/api/projects/${projectId}/operations/${undoTarget.id}/undo`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idempotencyKey: keyRef.current }),
        },
      );
      const body = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        setConflicts(undoConflicts(body));
        throw new Error(
          safeErrorMessage(
            body,
            response.status === 409
              ? "Undo stopped because the current item state no longer matches the applied operation. Nothing was partially reversed."
              : "The operation could not be undone.",
          ),
        );
      }
      const responseRecord =
        typeof body === "object" && body !== null
          ? (body as Record<string, unknown>)
          : null;
      if (!responseRecord || typeof responseRecord.operationId !== "string") {
        throw new Error("The undo response was incomplete. Refresh operation history before retrying.");
      }
      const completed = responseRecord as { operationId: string; duplicate?: boolean };
      setMessage(completed.duplicate === true ? "This undo was already recorded." : "Undo completed as a linked compensating operation.");
      onUndoFinished(completed.operationId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The operation could not be undone.");
    } finally {
      undoLock.current = false;
      setUndoing(false);
      requestAnimationFrame(() => resultRef.current?.focus());
    }
  }

  return (
    <section aria-labelledby="applied-result-heading" className="border border-rule bg-white" id="applied-result">
      <div className="flex flex-col gap-3 border-b border-rule px-5 py-5 sm:flex-row sm:items-start sm:justify-between lg:px-6">
        <div>
          <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">05 · Recorded result</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-ink" id="applied-result-heading" tabIndex={-1}>
            Applied result
          </h2>
        </div>
        <a className="inline-flex min-h-10 items-center gap-2 border border-rule px-3 text-sm font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" href="#audit-history">
          <History aria-hidden="true" className="size-4" />
          View audit history
        </a>
      </div>
      <div className="p-5 lg:p-6">
        {operationsLoadFailed ? (
          <p className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800" role="alert">
            Applied results could not be loaded. Refresh before concluding that no operation exists or that undo is available.
          </p>
        ) : !latest ? (
          <EmptyState
            description="Applied operations, changed items, and backend reversibility will appear here after an approval."
            title="No operation has been applied"
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border border-rule bg-paper p-3">
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">Operation</p>
                <p className="mt-1 text-sm font-semibold text-ink">{titleCase(latest.operationType)}</p>
              </div>
              <div className="border border-rule bg-paper p-3">
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">Status</p>
                <p className="mt-1 text-sm font-semibold text-ink">{titleCase(latest.state)}</p>
              </div>
              <div className="border border-rule bg-paper p-3">
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">Initiated by</p>
                <p className="mt-1 text-sm font-semibold text-ink">{latest.initiatorName ?? "Authenticated approver"}</p>
              </div>
              <div className="border border-rule bg-paper p-3">
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">Completed</p>
                <p className="mt-1 text-sm font-semibold text-ink">{dateTimeLabel(latest.completedAt)}</p>
              </div>
            </div>

            {latest.errorCode ? (
              <p className="mt-4 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
                Operation error: {humanize(latest.errorCode)}. No successful state is implied.
              </p>
            ) : null}

            <div className="mt-5">
              <h3 className="text-base font-semibold text-ink">Changed items</h3>
              {latest.items.length > 0 ? (
                <div className="mt-3 divide-y divide-rule border-y border-rule">
                  {latest.items.map((item) => (
                    <article className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]" key={item.id}>
                      <div>
                        <p className="break-words font-semibold text-ink [overflow-wrap:anywhere]">{item.itemLabel}</p>
                        <p className="mt-1 text-xs text-muted">{item.actionType ? titleCase(item.actionType) : "Recorded action"} · {titleCase(item.state)}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">Before</p>
                        <p className="mt-1 break-words text-sm text-ink [overflow-wrap:anywhere]">{item.beforeValue}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">After</p>
                        <p className="mt-1 break-words text-sm text-ink [overflow-wrap:anywhere]">{item.afterValue}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm leading-6 text-muted">This operation has no item-level change rows.</p>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-rule pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-ink">
                  {undoTarget
                    ? "Undo is available"
                    : latest.reversible
                      ? "Undo is no longer available"
                      : "Backend marked this operation non-reversible"}
                </p>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
                  {undoTarget
                    ? `${undoTarget.id === latest.id ? "This apply operation is" : "The most recent eligible apply operation is"} marked reversible in backend history and has no successful reversal. Current state is rechecked on undo.`
                    : "No undo control is shown unless backend history identifies a reversible, successful apply with no successful reversal."}
                </p>
              </div>
              {undoTarget ? (
                <button
                  aria-label={`Undo operation ${undoTarget.id}`}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-rule bg-white px-4 text-sm font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50"
                  disabled={undoing || !canApprove}
                  onClick={undo}
                  type="button"
                >
                  {undoing ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <RotateCcw aria-hidden="true" className="size-4" />}
                  {undoing ? "Undoing…" : "Undo operation"}
                </button>
              ) : null}
            </div>
          </>
        )}

        <div className="mt-4 outline-none" ref={resultRef} tabIndex={-1}>
          {error ? (
            <div className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              <p>{error}</p>
              {conflicts.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {conflicts.map((conflict) => (
                    <li key={`${conflict.itemId}:${conflict.reason}`}>
                      Item {conflict.itemId}: {humanize(conflict.reason)}; expected version {conflict.expectedVersion}, current version {conflict.actualVersion ?? "missing"}.
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : message ? (
            <p className="border-l-2 border-green-700 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">{message}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AuditHistory({ operations, failed }: { operations: OperationSummary[]; failed: boolean }) {
  return (
    <section aria-labelledby="audit-history-heading" className="border border-rule bg-white" id="audit-history">
      <div className="border-b border-rule px-5 py-4 lg:px-6">
        <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">Traceability</p>
        <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em] text-ink" id="audit-history-heading">Audit history</h2>
      </div>
      <div className="p-5 lg:p-6">
        {failed ? (
          <p className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800">Operation history could not be loaded. Refresh before relying on reversibility or prior results.</p>
        ) : operations.length === 0 ? (
          <EmptyState description="Current-generation operations will be attributed and retained here." title="No audit operations yet" />
        ) : (
          <ol className="divide-y divide-rule border-y border-rule">
            {operations.map((operation) => (
              <li className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start" key={operation.id}>
                <div>
                  <p className="font-semibold text-ink">{titleCase(operation.operationType)} · {titleCase(operation.state)}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {operation.items.length} item-level {operation.items.length === 1 ? "record" : "records"} · {operation.initiatorName ?? "Authenticated actor"}
                    {operation.reversesOperationId ? ` · Reverses ${operation.reversesOperationId}` : ""}
                  </p>
                </div>
                <time className="font-mono text-xs text-muted" dateTime={operation.completedAt}>{dateTimeLabel(operation.completedAt)}</time>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function DemoGuide({ analysis, operations }: { analysis: AnalysisReview | null; operations: OperationSummary[] }) {
  const current = operations.length > 0
    ? 4
    : analysis?.state === "succeeded"
      ? 3
      : analysis
        ? 2
        : 1;
  const steps = [
    "Insert or enter synthetic evidence",
    "Analyze through the single server pipeline",
    "Review the inferred change and deterministic reach",
    "Select safe recovery actions and inspect history",
  ];
  return (
    <aside aria-label="Seeded demo guide" className="border border-rule bg-white px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-signal">Synthetic demo guide</p>
          <p className="mt-1 text-sm text-muted">Optional sequence for the summit venue update. General use remains available.</p>
        </div>
        <ol className="grid gap-2 text-xs sm:grid-cols-2 lg:flex lg:flex-wrap" aria-label={`Demo step ${current} of ${steps.length}`}>
          {steps.map((step, index) => {
            const number = index + 1;
            return (
              <li className={`flex items-center gap-2 border px-2.5 py-2 ${number === current ? "border-signal bg-[#eef1ff] text-signal" : number < current ? "border-green-700/30 bg-green-50 text-green-800" : "border-rule bg-paper text-muted"}`} key={step}>
                <span className="font-mono">{number < current ? "✓" : number}</span>
                <span>{step}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}

export function ImpactWorkflow({ projectId, role, syntheticWorkspace, data }: ImpactWorkflowProps) {
  const prefix = useId();
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const awaitedAnalysisId = useRef<string | null>(null);
  const awaitedOperationId = useRef<string | null>(null);
  const canAnalyze = role !== "viewer";
  const canApprove = role === "owner" || role === "admin";
  const analysis = data.analysis;

  useEffect(() => {
    if (
      awaitedAnalysisId.current &&
      analysis?.requestId === awaitedAnalysisId.current
    ) {
      reviewHeadingRef.current?.focus();
      awaitedAnalysisId.current = null;
    }
  }, [analysis?.requestId]);

  useEffect(() => {
    if (
      awaitedOperationId.current &&
      data.operations.some(
        (operation) => operation.id === awaitedOperationId.current,
      )
    ) {
      document.getElementById("applied-result-heading")?.focus();
      awaitedOperationId.current = null;
    }
  }, [data.operations]);

  function refreshAfterAnalysis(result: AnalysisSubmitResult) {
    awaitedAnalysisId.current = result.analysisRequestId;
    if (analysis?.requestId === result.analysisRequestId) {
      requestAnimationFrame(() => {
        reviewHeadingRef.current?.focus();
        awaitedAnalysisId.current = null;
      });
      startRefresh(() => router.refresh());
      return;
    }
    startRefresh(() =>
      router.replace(
        `/app?analysisRequestId=${encodeURIComponent(result.analysisRequestId)}`,
      ),
    );
  }

  function refreshAfterApply(result: ApplyResult) {
    awaitedOperationId.current = result.operationId;
    startRefresh(() => router.refresh());
  }

  function refreshAfterUndo(operationId: string) {
    awaitedOperationId.current = operationId;
    startRefresh(() => router.refresh());
  }

  return (
    <div className="grid gap-5" id="change-workflow">
      {syntheticWorkspace ? <DemoGuide analysis={analysis} operations={data.operations} /> : null}

      <SourceUpdateForm
        canAnalyze={canAnalyze}
        onAnalysisFinished={refreshAfterAnalysis}
        projectId={projectId}
      />

      <section aria-labelledby={`${prefix}-review-heading`} className="grid gap-4 border border-rule bg-paper p-4 sm:p-5">
        <div>
          <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">02 · Evidence before inference</p>
          <h2 className="mt-1 scroll-mt-6 text-2xl font-semibold tracking-[-0.04em] text-ink outline-none" id={`${prefix}-review-heading`} ref={reviewHeadingRef} tabIndex={-1}>
            Change review
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Compare the immutable source with the validated model interpretation before approving anything.</p>
        </div>

        {data.analysisLoadFailed ? (
          <p className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">The latest analysis review could not be loaded. Refresh before making a decision.</p>
        ) : !analysis ? (
          <EmptyState description="Submit a source update above. Test fixtures are never shown here as live AI results." title="No analysis result yet" />
        ) : (
          <>
            {analysis.state === "processing" || analysis.state === "failed" ? (
              <AnalysisPipelineState state={analysis.state} />
            ) : null}
            {analysis.state === "failed" ? (
              <p className="border border-red-200 bg-white px-4 py-3 text-sm leading-6 text-red-800" role="alert">
                Safe failure: {analysis.failureCode ? humanize(analysis.failureCode) : "analysis failed"}
                {analysis.failureStage ? ` during ${humanize(analysis.failureStage)}` : ""}. No project mutation was attempted.
              </p>
            ) : null}
            {analysis.loadWarning ? (
              <p className="border-l-2 border-caution bg-caution-soft px-4 py-3 text-sm text-ink" role="alert">{analysis.loadWarning}</p>
            ) : null}
            <div className="grid gap-4 xl:grid-cols-2">
              <SourceEvidenceCard analysis={analysis} />
              {analysis.state === "succeeded" ? <ChangeReviewCard analysis={analysis} /> : (
                <EmptyState description="A candidate change appears only after a validated completed analysis." title="Inference not available" />
              )}
            </div>
          </>
        )}
      </section>

      {analysis?.state === "succeeded" ? <ImpactReview analysis={analysis} /> : (
        <section className="border border-rule bg-white p-5" aria-labelledby="impact-review-heading">
          <h2 className="text-xl font-semibold text-ink" id="impact-review-heading">Impact review</h2>
          <p className="mt-2 text-sm leading-6 text-muted">A completed real analysis is required before dependency paths can be shown.</p>
        </section>
      )}

      {analysis?.state === "succeeded" && analysis.proposal ? (
        <RecoveryActionReview
          canApprove={canApprove}
          key={analysis.proposal.id}
          onApplied={refreshAfterApply}
          projectId={projectId}
          proposal={analysis.proposal}
        />
      ) : (
        <section className="border border-rule bg-white p-5" aria-labelledby="recovery-actions-heading">
          <h2 className="text-xl font-semibold text-ink" id="recovery-actions-heading">Recovery actions</h2>
          <p className="mt-2 text-sm leading-6 text-muted">No real recovery proposal is available for selection.</p>
        </section>
      )}

      <AppliedResult
        canApprove={canApprove}
        key={data.operations[0]?.id ?? "no-operation"}
        onUndoFinished={refreshAfterUndo}
        operations={data.operations}
        operationsLoadFailed={data.operationsLoadFailed}
        projectId={projectId}
      />
      <AuditHistory failed={data.operationsLoadFailed} operations={data.operations} />

      <div className="flex flex-col gap-3 border border-rule bg-white px-4 py-4 text-sm leading-6 text-muted sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="size-4 text-signal" />
          Evidence, proposals, approvals, and compensating operations remain separately attributable.
        </p>
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em]">
          <Clock3 aria-hidden="true" className="size-4" />
          No autonomous mutation
        </p>
      </div>
    </div>
  );
}

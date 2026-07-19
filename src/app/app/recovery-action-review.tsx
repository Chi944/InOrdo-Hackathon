"use client";

import { AlertTriangle, Check, LoaderCircle, ShieldAlert, X } from "lucide-react";
import {
  type FormEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  RecoveryAction,
  RecoveryProposal,
} from "@/app/app/impact-workflow-types";
import {
  createOperationIdempotencyKey,
  shouldRotateOperationIdempotencyKey,
} from "@/app/app/operation-idempotency";

export function defaultSelectedActionIds(actions: RecoveryAction[]) {
  return actions
    .filter(
      (action) =>
        action.state === "pending" &&
        !action.requiresHumanInput &&
        action.actionType === "update_item",
    )
    .sort((left, right) => left.ordinal - right.ordinal)
    .map((action) => action.id);
}

export function selectedActionsInOrder(
  actions: RecoveryAction[],
  selectedIds: ReadonlySet<string>,
) {
  return actions
    .filter(
      (action) => action.state === "pending" && selectedIds.has(action.id),
    )
    .sort((left, right) => left.ordinal - right.ordinal);
}

export type ApplyResult = {
  operationId: string;
  appliedActionIds: string[];
  duplicate: boolean;
};

type RecoveryActionReviewProps = {
  projectId: string;
  proposal: RecoveryProposal;
  canApprove: boolean;
  onApplied(result: ApplyResult): void;
};

type ConflictDetail = {
  itemId: string;
  expectedVersion: number;
  actualVersion: number | null;
  reason: string;
};

const secondaryButton =
  "inline-flex min-h-10 items-center justify-center border border-rule bg-white px-3 text-sm font-semibold text-ink transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50";

function confidenceLabel(confidence: number | null) {
  if (confidence === null) return "Confidence unavailable";
  return confidence >= 0.8
    ? `Higher confidence · ${Math.round(confidence * 100)}%`
    : `Needs closer review · ${Math.round(confidence * 100)}%`;
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function actionMayBeUndoEligible(action: RecoveryAction) {
  return action.actionType === "update_item";
}

function readResponseMessage(body: unknown, fallback: string) {
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

function readConflicts(body: unknown): ConflictDetail[] {
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
  ) {
    return [];
  }
  return body.error.details.conflicts.flatMap((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof entry.itemId !== "string" ||
      typeof entry.expectedVersion !== "number" ||
      (entry.actualVersion !== null && typeof entry.actualVersion !== "number") ||
      typeof entry.reason !== "string"
    ) {
      return [];
    }
    return [entry as ConflictDetail];
  });
}

function ActionCard({
  action,
  checked,
  disabled,
  humanResponse,
  responseError,
  onChecked,
  onHumanResponse,
}: {
  action: RecoveryAction;
  checked: boolean;
  disabled: boolean;
  humanResponse: string;
  responseError?: string;
  onChecked(checked: boolean): void;
  onHumanResponse(value: string): void;
}) {
  const prefix = useId();
  const isPending = action.state === "pending";

  return (
    <article
      className={`border p-4 transition sm:p-5 ${
        checked ? "border-signal bg-[#f8f9ff]" : "border-rule bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          aria-describedby={`${prefix}-details`}
          aria-label={`Select ${action.title}`}
          checked={checked}
          className="mt-1 size-5 shrink-0 accent-[var(--signal)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          disabled={disabled || !isPending}
          id={`${prefix}-select`}
          onChange={(event) => onChecked(event.target.checked)}
          type="checkbox"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                Action {String(action.ordinal).padStart(2, "0")} · {humanize(action.actionType)}
              </p>
              <label
                className={`mt-1 block break-words text-base font-semibold text-ink [overflow-wrap:anywhere] ${
                  isPending ? "cursor-pointer" : ""
                }`}
                htmlFor={`${prefix}-select`}
              >
                {action.title}
              </label>
            </div>
            <div className="flex flex-wrap gap-2 text-[0.66rem] font-semibold uppercase tracking-[0.07em]">
              <span className="border border-rule bg-paper px-2 py-1 text-muted">
                {humanize(action.state)}
              </span>
              {action.requiresHumanInput ? (
                <span className="border border-caution/40 bg-caution-soft px-2 py-1 text-[#7a3907]">
                  Needs human input
                </span>
              ) : (
                <span className="border border-rule bg-paper px-2 py-1 text-muted">
                  No extra input
                </span>
              )}
              <span
                className={
                  actionMayBeUndoEligible(action)
                    ? "border border-rule bg-paper px-2 py-1 text-muted"
                    : "border border-caution/40 bg-caution-soft px-2 py-1 text-[#7a3907]"
                }
              >
                {actionMayBeUndoEligible(action)
                  ? "Undo may be available"
                  : "Cannot be undone"}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-px border border-rule bg-rule sm:grid-cols-2" id={`${prefix}-details`}>
            <div className="bg-paper p-3">
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">
                Current
              </p>
              <p className="mt-1 break-words text-sm font-medium text-ink [overflow-wrap:anywhere]">
                {action.currentValue}
              </p>
            </div>
            <div className="bg-[#f4f6ff] p-3">
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-signal">
                Proposed
              </p>
              <p className="mt-1 break-words text-sm font-medium text-ink [overflow-wrap:anywhere]">
                {action.proposedValue}
              </p>
            </div>
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">Reason</dt>
              <dd className="mt-1 break-words leading-6 text-ink [overflow-wrap:anywhere]">{action.reason}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">Linked impact</dt>
              <dd className="mt-1 break-words leading-6 text-ink [overflow-wrap:anywhere]">{action.linkedImpactLabel}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">GPT confidence</dt>
              <dd className="mt-1 leading-6 text-ink">{confidenceLabel(action.confidence)}</dd>
            </div>
          </dl>

          {checked && action.requiresHumanInput ? (
            <label className="mt-4 block text-sm font-semibold text-ink" htmlFor={`${prefix}-human-response`}>
              Human response
              <textarea
                aria-label={`Human response for ${action.title}`}
                aria-describedby={responseError ? `${prefix}-prompt ${prefix}-error` : `${prefix}-prompt`}
                aria-invalid={Boolean(responseError)}
                className="mt-2 min-h-24 w-full border border-rule bg-white px-3 py-2 text-sm leading-6 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                id={`${prefix}-human-response`}
                maxLength={2000}
                onChange={(event) => onHumanResponse(event.target.value)}
                value={humanResponse}
              />
              <span className="mt-1 block text-xs font-normal leading-5 text-muted" id={`${prefix}-prompt`}>
                {action.humanInputPrompt ?? "Add the decision or constraint needed to approve this action."}
              </span>
              {responseError ? (
                <span className="mt-1 block text-xs font-normal text-red-700" id={`${prefix}-error`}>
                  {responseError}
                </span>
              ) : null}
            </label>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function RecoveryActionReview({
  projectId,
  proposal,
  canApprove,
  onApplied,
}: RecoveryActionReviewProps) {
  const prefix = useId();
  const initialSafeIds = useMemo(
    () => defaultSelectedActionIds(proposal.actions),
    [proposal.actions],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSafeIds),
  );
  const [humanResponses, setHumanResponses] = useState<Record<string, string>>({});
  const [responseErrors, setResponseErrors] = useState<Record<string, string>>({});
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictDetail[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const applyingLock = useRef(false);
  const attemptRef = useRef<{ signature: string; key: string } | null>(null);
  const backendReady =
    proposal.state === "ready" || proposal.state === "partially_approved";
  const proposalClosed = !backendReady && proposal.state !== "draft";
  const selectedActions = selectedActionsInOrder(proposal.actions, selectedIds);
  const pendingActions = proposal.actions.filter((action) => action.state === "pending");
  const invalidHumanActions = selectedActions.filter(
    (action) =>
      action.requiresHumanInput && !humanResponses[action.id]?.trim(),
  );
  const nonreversibleSelectedActions = selectedActions.filter(
    (action) => !actionMayBeUndoEligible(action),
  );

  function setChecked(action: RecoveryAction, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked && action.state === "pending") next.add(action.id);
      else next.delete(action.id);
      return next;
    });
    setResponseErrors((current) => ({ ...current, [action.id]: "" }));
    setSelectionNotice(
      checked
        ? `${action.title} selected for review.`
        : `${action.title} will remain pending.`,
    );
    setApplyError(null);
    setSuccess(null);
    attemptRef.current = null;
  }

  function selectAllSafe() {
    setSelectedIds(new Set(defaultSelectedActionIds(proposal.actions)));
    setSelectionNotice(
      "All pending update actions without a human-input requirement are selected. Nonreversible and human-input actions remain unselected.",
    );
    setApplyError(null);
    setSuccess(null);
    attemptRef.current = null;
  }

  function leaveAllPending() {
    setSelectedIds(new Set());
    setResponseErrors({});
    setSelectionNotice(
      "No actions are selected. Pending actions are unchanged; no rejection request was sent.",
    );
    setApplyError(null);
    setSuccess(null);
    attemptRef.current = null;
  }

  function closeDialog() {
    if (typeof dialogRef.current?.close === "function") dialogRef.current.close();
    else dialogRef.current?.removeAttribute("open");
    triggerRef.current?.focus();
  }

  function openConfirmation() {
    const nextErrors = Object.fromEntries(
      invalidHumanActions.map((action) => [
        action.id,
        "Add a human response before approving this action.",
      ]),
    );
    if (invalidHumanActions.length > 0) {
      setResponseErrors(nextErrors);
      requestAnimationFrame(() => {
        sectionRef.current
          ?.querySelector<HTMLTextAreaElement>(`textarea[aria-invalid="true"]`)
          ?.focus();
      });
      return;
    }
    if (selectedActions.length === 0 || !backendReady || !canApprove) return;
    setApplyError(null);
    setConflicts([]);
    const dialog = dialogRef.current;
    if (typeof dialog?.showModal === "function") dialog.showModal();
    else dialog?.setAttribute("open", "");
    requestAnimationFrame(() => cancelRef.current?.focus());
  }

  async function applySelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (applyingLock.current || applying) return;
    const currentSelected = selectedActionsInOrder(proposal.actions, selectedIds);
    const humanInputs = currentSelected
      .filter((action) => action.requiresHumanInput)
      .map((action) => ({
        actionId: action.id,
        confirmed: true as const,
        response: humanResponses[action.id]?.trim() ?? "",
      }));
    if (
      currentSelected.length === 0 ||
      humanInputs.some((input) => !input.response) ||
      !backendReady ||
      !canApprove
    ) {
      closeDialog();
      return;
    }

    const selectedActionIds = currentSelected.map((action) => action.id);
    const signature = JSON.stringify({ selectedActionIds, humanInputs });
    const attempt =
      attemptRef.current?.signature === signature
        ? attemptRef.current
        : {
            signature,
            key: createOperationIdempotencyKey(`apply:${proposal.id}`),
          };
    attemptRef.current = attempt;
    applyingLock.current = true;
    setApplying(true);
    setApplyError(null);
    setConflicts([]);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/proposals/${proposal.id}/apply`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            selectedActionIds,
            humanInputs,
            idempotencyKey: attempt.key,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        if (shouldRotateOperationIdempotencyKey(response.status)) {
          attemptRef.current = null;
        }
        setConflicts(readConflicts(body));
        throw new Error(
          readResponseMessage(
            body,
            response.status === 409
              ? "The project changed before approval could be applied. Refresh and review the current values."
              : "The selected actions could not be applied.",
          ),
        );
      }
      const responseRecord =
        typeof body === "object" && body !== null
          ? (body as Record<string, unknown>)
          : null;
      if (
        !responseRecord ||
        typeof responseRecord.operationId !== "string" ||
        !Array.isArray(responseRecord.appliedActionIds)
      ) {
        throw new Error("The apply response was incomplete. Refresh operation history before retrying.");
      }
      const completed = responseRecord as {
        operationId: string;
        appliedActionIds: unknown[];
        duplicate?: boolean;
      };
      const duplicate = completed.duplicate === true;
      setSuccess(
        duplicate
          ? "This approval was already applied. Operation history is unchanged."
          : `${completed.appliedActionIds.length} selected ${completed.appliedActionIds.length === 1 ? "action" : "actions"} applied. Unselected actions remain pending.`,
      );
      closeDialog();
      onApplied({
        operationId: completed.operationId,
        appliedActionIds: completed.appliedActionIds.filter(
          (value): value is string => typeof value === "string",
        ),
        duplicate,
      });
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (error) {
      setApplyError(
        error instanceof Error
          ? error.message
          : "The selected actions could not be applied.",
      );
      closeDialog();
      requestAnimationFrame(() => resultRef.current?.focus());
    } finally {
      applyingLock.current = false;
      setApplying(false);
    }
  }

  return (
    <section aria-labelledby={`${prefix}-heading`} className="border border-rule bg-white" ref={sectionRef}>
      <div className="border-b border-rule px-5 py-5 lg:px-6">
        <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
          04 · Human approval
        </p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-ink" id={`${prefix}-heading`}>
              Recovery actions
            </h2>
            <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-muted [overflow-wrap:anywhere]">
              {proposal.title}. {proposal.rationale}
            </p>
          </div>
          <span className="w-fit border border-rule bg-paper px-2.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted">
            Proposal {humanize(proposal.state)}
          </span>
        </div>
      </div>

      <div className="p-5 lg:p-6">
        {!backendReady ? (
          <div className="mb-5 flex gap-3 border-l-2 border-caution bg-caution-soft px-4 py-3 text-sm leading-6 text-ink">
            <ShieldAlert aria-hidden="true" className="mt-1 size-4 shrink-0 text-caution" />
            <div>
              <p className="font-semibold">
                {proposal.state === "draft"
                  ? "Approval is waiting on backend readiness"
                  : `Proposal is ${humanize(proposal.state)}`}
              </p>
              <p className="mt-1 text-muted">
                {proposal.state === "draft"
                  ? "The existing apply contract accepts only ready or partially approved proposals, so no action can be applied until the backend marks this draft ready."
                  : "This is a closed proposal state. Its actions remain visible for audit, but the existing apply contract does not accept another approval from this screen."}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-muted">
            <span className="font-semibold text-ink">{selectedActions.length} selected</span> of {pendingActions.length} pending. Unchecked actions remain pending; this screen does not send a rejection request.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className={secondaryButton}
              disabled={applying || !canApprove || proposalClosed || pendingActions.length === 0}
              onClick={selectAllSafe}
              type="button"
            >
              Select all safe actions
            </button>
            <button
              className={secondaryButton}
              disabled={applying || !canApprove || proposalClosed || selectedActions.length === 0}
              onClick={leaveAllPending}
              type="button"
            >
              Leave all pending
            </button>
          </div>
        </div>

        {proposal.actions.length === 0 ? (
          <div className="mt-5 border border-dashed border-rule bg-paper p-5 text-sm leading-6 text-muted">
            No recovery actions were generated. The evidence and impact review remain available.
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {proposal.actions.map((action) => (
              <ActionCard
                action={action}
                checked={action.state === "pending" && selectedIds.has(action.id)}
                disabled={applying || !canApprove || proposalClosed}
                humanResponse={humanResponses[action.id] ?? ""}
                key={action.id}
                onChecked={(checked) => setChecked(action, checked)}
                onHumanResponse={(value) => {
                  setHumanResponses((current) => ({ ...current, [action.id]: value }));
                  setResponseErrors((current) => ({ ...current, [action.id]: "" }));
                  attemptRef.current = null;
                }}
                responseError={responseErrors[action.id]}
              />
            ))}
          </div>
        )}

        {selectionNotice ? (
          <p className="mt-4 text-sm leading-6 text-muted">
            {selectionNotice}
          </p>
        ) : null}

        {!canApprove ? (
          <p className="mt-5 border border-rule bg-paper px-4 py-3 text-sm leading-6 text-muted">
            Approval and undo require workspace owner or admin access. You can still inspect the full evidence and proposal.
          </p>
        ) : null}

        <div
          className="mt-5 outline-none"
          ref={resultRef}
          tabIndex={-1}
        >
          {applyError ? (
            <div className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              <p>{applyError}</p>
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
          ) : success ? (
            <p className="border-l-2 border-green-700 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
              {success}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col items-start gap-2 sm:flex-row sm:items-center">
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-white transition hover:bg-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50"
            disabled={
              applying ||
              !canApprove ||
              !backendReady ||
              selectedActions.length === 0
            }
            onClick={openConfirmation}
            ref={triggerRef}
            type="button"
          >
            {applying ? (
              <>
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                Applying…
              </>
            ) : (
              "Approve selected"
            )}
          </button>
          <p className="text-xs leading-5 text-muted">
            {selectedActions.length === 0
              ? "Select at least one pending action to continue."
              : invalidHumanActions.length > 0
                ? "Add human input for every selected action that requires it."
                : "A confirmation summary appears before the existing backend apply route is called."}
          </p>
        </div>
      </div>

      <dialog
        aria-describedby={`${prefix}-dialog-description`}
        aria-labelledby={`${prefix}-dialog-title`}
        className="m-auto w-[min(38rem,calc(100%-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto border border-rule bg-white p-0 text-ink shadow-[0_30px_100px_rgba(23,35,31,0.3)] backdrop:bg-ink/55"
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
        onClose={() => triggerRef.current?.focus()}
        ref={dialogRef}
      >
        <form className="p-5 sm:p-6" onSubmit={applySelected}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
                Final review
              </p>
              <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em]" id={`${prefix}-dialog-title`}>
                Approve {selectedActions.length} selected {selectedActions.length === 1 ? "action" : "actions"}?
              </h3>
            </div>
            <button
              aria-label="Close approval confirmation"
              className="grid size-10 shrink-0 place-items-center border border-rule hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              onClick={closeDialog}
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted" id={`${prefix}-dialog-description`}>
            Only these actions will be sent to the existing apply contract. A successful apply also confirms the candidate change. Unselected actions remain pending.
          </p>
          <ol className="mt-5 divide-y divide-rule border-y border-rule">
            {selectedActions.map((action) => (
              <li className="flex gap-3 py-3 text-sm" key={action.id}>
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-green-700" />
                <span>
                  <span className="font-semibold text-ink">{action.title}</span>
                  <span className="mt-0.5 block text-muted">{action.proposedValue}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex gap-3 border-l-2 border-caution bg-caution-soft px-4 py-3 text-sm leading-6 text-ink">
            <AlertTriangle aria-hidden="true" className="mt-1 size-4 shrink-0 text-caution" />
            <p>
              Project state and permissions are rechecked by the backend. A
              conflict applies nothing. {nonreversibleSelectedActions.length > 0
                ? `The entire operation cannot be undone because ${nonreversibleSelectedActions.length} selected ${nonreversibleSelectedActions.length === 1 ? "action is" : "actions are"} nonreversible. Recovery requires a separate reviewed forward action.`
                : "Undo remains conditional on every recorded after-state still matching."}
            </p>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className={secondaryButton}
              disabled={applying}
              onClick={closeDialog}
              ref={cancelRef}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center bg-ink px-4 text-sm font-semibold text-white hover:bg-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50"
              disabled={applying}
              type="submit"
            >
              {applying ? "Applying selected…" : "Confirm and apply selected"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}

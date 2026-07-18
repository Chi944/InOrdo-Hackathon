"use client";

import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  initialRecordActionState,
  type RecordActionState,
} from "@/app/app/project-record-action-state";
import {
  createDependencyAction,
  removeDependencyAction,
} from "@/app/app/project-record-actions";

export type DependencyViewItem = {
  id: string;
  itemKey: string;
  title: string;
  itemType: "task" | "milestone" | "decision" | "event" | "risk" | "artifact";
  status:
    | "not_started"
    | "in_progress"
    | "blocked"
    | "at_risk"
    | "completed"
    | "cancelled";
};

export type DependencyViewEdge = {
  id: string;
  fromItemId: string;
  toItemId: string;
  relationship: "depends_on" | "requires" | "informs" | "scheduled_by";
  rationale?: string | null;
};

export type DependencyViewProps = {
  projectId: string;
  items: DependencyViewItem[];
  dependencies: DependencyViewEdge[];
  canEdit: boolean;
  initialSelectedItemId?: string;
};

const fieldClass =
  "mt-2 min-h-11 w-full border border-rule bg-white px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";
const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-signal disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";
const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center border border-rule bg-white px-4 text-sm font-semibold text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function itemName(item: DependencyViewItem | undefined) {
  return item ? `${item.itemKey} — ${item.title}` : "Unavailable project item";
}

function sentenceName(item: DependencyViewItem | undefined) {
  return item ? item.title : "Unavailable project item";
}

function ActionFeedback({
  state,
}: {
  state: typeof initialRecordActionState;
}) {
  if (state.status === "idle") return null;
  const isProblem = state.status === "error" || state.status === "conflict";

  return (
    <p
      className={`mt-3 border-l-2 px-3 py-2 text-sm ${
        isProblem
          ? "border-red-700 bg-red-50 text-red-800"
          : "border-green-700 bg-green-50 text-green-800"
      }`}
      role={isProblem ? "alert" : "status"}
    >
      <span className="font-semibold">
        {state.status === "conflict"
          ? "Refresh required. "
          : state.status === "error"
            ? "Could not save. "
            : "Saved. "}
      </span>
      {state.message}
    </p>
  );
}

function RelationshipDetails({
  dependency,
}: {
  dependency: DependencyViewEdge;
}) {
  return (
    <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
      <div className="flex gap-1">
        <dt className="font-semibold text-ink">Relationship:</dt>
        <dd>{humanize(dependency.relationship)}</dd>
      </div>
      <div className="flex min-w-0 gap-1">
        <dt className="shrink-0 font-semibold text-ink">Rationale:</dt>
        <dd className="min-w-0 break-words">
          {dependency.rationale?.trim() || "No rationale recorded"}
        </dd>
      </div>
    </dl>
  );
}

function RemoveRelationshipForm({
  dependency,
  dependent,
  onResult,
  projectId,
  upstream,
}: {
  dependency: DependencyViewEdge;
  dependent: DependencyViewItem | undefined;
  onResult: (result: RecordActionState) => void;
  projectId: string;
  upstream: DependencyViewItem | undefined;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [state, action, pending] = useActionState(
    async (previousState: RecordActionState, formData: FormData) => {
      const result = await removeDependencyAction(previousState, formData);
      onResult(result);
      return result;
    },
    initialRecordActionState,
  );
  const relationshipSentence = `${sentenceName(dependent)} depends on ${sentenceName(upstream)}`;

  useEffect(() => {
    if (state.status === "success") closeDialog();
  }, [state.status]);

  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else {
      dialog.removeAttribute("open");
      triggerRef.current?.focus();
    }
  }

  return (
    <div className="mt-3">
      <button
        aria-label={`Remove relationship: ${relationshipSentence}`}
        className="inline-flex min-h-10 items-center border border-rule bg-white px-3 text-xs font-semibold text-ink transition hover:border-red-700 hover:text-red-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        onClick={openDialog}
        ref={triggerRef}
        type="button"
      >
        Remove relationship
      </button>
      <dialog
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className="m-auto w-[min(32rem,calc(100%-2rem))] border border-rule bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/55"
        onClose={() => triggerRef.current?.focus()}
        ref={dialogRef}
      >
        <form action={action} className="p-5 sm:p-6">
          <input name="projectId" type="hidden" value={projectId} />
          <input name="dependencyId" type="hidden" value={dependency.id} />
          <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-caution">
            Confirm relationship removal
          </p>
          <h2
            className="mt-2 text-xl font-semibold tracking-[-0.035em] text-ink"
            id={titleId}
          >
            Remove relationship?
          </h2>
          <p
            className="mt-3 break-words text-sm leading-6 text-muted"
            id={descriptionId}
          >
            Remove the explicit edge “{relationshipSentence}”? Project items
            will remain unchanged.
          </p>
          <ActionFeedback state={state} />
          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-rule pt-5 sm:flex-row sm:justify-end">
            <button
              className={secondaryButtonClass}
              disabled={pending}
              onClick={closeDialog}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center border border-red-700 bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              disabled={pending}
              type="submit"
            >
              {pending ? "Removing relationship…" : "Confirm removal"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

function RelationshipCard({
  canEdit,
  dependency,
  dependent,
  onResult,
  projectId,
  upstream,
}: {
  canEdit: boolean;
  dependency: DependencyViewEdge;
  dependent: DependencyViewItem | undefined;
  onResult: (result: RecordActionState) => void;
  projectId: string;
  upstream: DependencyViewItem | undefined;
}) {
  return (
    <article className="border border-rule bg-white p-4">
      <p className="break-words text-sm font-semibold leading-6 text-ink">
        {sentenceName(dependent)} depends on {sentenceName(upstream)}
      </p>
      <p className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.08em] text-muted">
        {dependent?.itemKey ?? "Unknown"} → {upstream?.itemKey ?? "Unknown"}
      </p>
      <RelationshipDetails dependency={dependency} />
      {canEdit ? (
        <RemoveRelationshipForm
          dependency={dependency}
          dependent={dependent}
          onResult={onResult}
          projectId={projectId}
          upstream={upstream}
        />
      ) : null}
    </article>
  );
}

function AddRelationshipDialog({
  initialDependentId,
  items,
  onClose,
  onResult,
  projectId,
}: {
  initialDependentId: string;
  items: DependencyViewItem[];
  onClose: () => void;
  onResult: (result: RecordActionState) => void;
  projectId: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dependentId = useId();
  const relationshipId = useId();
  const upstreamId = useId();
  const rationaleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const dependentSelectRef = useRef<HTMLSelectElement>(null);
  const [dependentItemId, setDependentItemId] = useState(
    items.some((item) => item.id === initialDependentId)
      ? initialDependentId
      : (items[0]?.id ?? ""),
  );
  const [upstreamItemId, setUpstreamItemId] = useState(
    items.find((item) => item.id !== initialDependentId)?.id ?? "",
  );
  const [state, action, pending] = useActionState(
    async (previousState: RecordActionState, formData: FormData) => {
      const result = await createDependencyAction(previousState, formData);
      onResult(result);
      return result;
    },
    initialRecordActionState,
  );

  const upstreamOptions = items.filter((item) => item.id !== dependentItemId);
  const effectiveUpstreamItemId = upstreamOptions.some(
    (item) => item.id === upstreamItemId,
  )
    ? upstreamItemId
    : (upstreamOptions[0]?.id ?? "");

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    dependentSelectRef.current?.focus();

    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [onClose, state.status]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/55 p-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto border border-rule bg-paper shadow-2xl"
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-rule bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
              Explicit project edge
            </p>
            <h2
              className="mt-1 text-xl font-semibold tracking-[-0.035em] text-ink"
              id={titleId}
            >
              Add a relationship
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted" id={descriptionId}>
              Choose the item that is dependent first, then the upstream item it relies on.
            </p>
          </div>
          <button
            aria-label="Close add relationship dialog"
            className="grid size-11 shrink-0 place-items-center border border-rule bg-white text-xl text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form action={action} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <input name="projectId" type="hidden" value={projectId} />
          <label className="text-sm font-medium text-ink" htmlFor={dependentId}>
            Dependent item
            <select
              className={fieldClass}
              id={dependentId}
              name="fromItemId"
              onChange={(event) => {
                const nextDependentId = event.target.value;
                setDependentItemId(nextDependentId);
                if (nextDependentId === effectiveUpstreamItemId) {
                  setUpstreamItemId(
                    items.find((item) => item.id !== nextDependentId)?.id ?? "",
                  );
                }
              }}
              ref={dependentSelectRef}
              value={dependentItemId}
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {itemName(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-ink" htmlFor={upstreamId}>
            Upstream prerequisite
            <select
              className={fieldClass}
              id={upstreamId}
              name="toItemId"
              onChange={(event) => setUpstreamItemId(event.target.value)}
              value={effectiveUpstreamItemId}
            >
              {upstreamOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {itemName(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-ink" htmlFor={relationshipId}>
            Relationship
            <select
              className={fieldClass}
              defaultValue="requires"
              id={relationshipId}
              name="relationship"
            >
              <option value="depends_on">Depends on</option>
              <option value="requires">Requires</option>
              <option value="informs">Is informed by</option>
              <option value="scheduled_by">Is scheduled by</option>
            </select>
          </label>

          <label className="text-sm font-medium text-ink" htmlFor={rationaleId}>
            Rationale (optional)
            <textarea
              className={`${fieldClass} min-h-24 py-3`}
              id={rationaleId}
              maxLength={1000}
              name="rationale"
              placeholder="Explain why this dependency exists."
            />
          </label>

          <div className="border-t border-rule pt-4 sm:col-span-2">
            <p className="mb-4 break-words text-sm leading-6 text-muted">
              <span className="font-semibold text-ink">Direction preview: </span>
              {sentenceName(items.find((item) => item.id === dependentItemId))} depends on{" "}
              {sentenceName(
                items.find((item) => item.id === effectiveUpstreamItemId),
              )}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                className={primaryButtonClass}
                disabled={pending || !dependentItemId || !effectiveUpstreamItemId}
                type="submit"
              >
                {pending ? "Adding relationship…" : "Add relationship"}
              </button>
              <button
                className={secondaryButtonClass}
                disabled={pending}
                onClick={onClose}
                type="button"
              >
                Cancel
              </button>
            </div>
            <ActionFeedback state={state} />
          </div>
        </form>
      </div>
    </div>
  );
}

export function DependencyView({
  canEdit,
  dependencies,
  initialSelectedItemId,
  items,
  projectId,
}: DependencyViewProps) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState(
    initialSelectedItemId ?? items[0]?.id ?? "",
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionResult, setActionResult] = useState<RecordActionState>(
    initialRecordActionState,
  );
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  const selectedItem =
    itemsById.get(selectedItemId) ??
    itemsById.get(initialSelectedItemId ?? "") ??
    items[0];

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleItems = items.filter((item) => {
    if (!normalizedQuery) return true;
    return [item.itemKey, item.title, item.itemType, item.status]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });

  const dependsOn = selectedItem
    ? dependencies.filter((dependency) => dependency.fromItemId === selectedItem.id)
    : [];
  const affects = selectedItem
    ? dependencies.filter((dependency) => dependency.toItemId === selectedItem.id)
    : [];

  if (items.length === 0) {
    return (
      <section
        aria-labelledby="dependencies-heading"
        className="border border-rule bg-white p-6"
      >
        <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
          Project graph
        </p>
        <h1
          className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-ink"
          id="dependencies-heading"
        >
          Dependencies
        </h1>
        <div className="mt-5 border border-dashed border-rule bg-paper p-5">
          <h2 className="font-semibold text-ink">No project items yet</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Create project items before connecting dependencies. This view never invents project state.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="dependencies-heading">
      <div className="flex flex-col gap-4 border border-rule bg-white p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
            Project graph
          </p>
          <h1
            className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-ink sm:text-3xl"
            id="dependencies-heading"
          >
            Dependencies
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Read every edge as “dependent item depends on upstream prerequisite.” Select an item to inspect both directions.
          </p>
        </div>
        {canEdit ? (
          <button
            className={primaryButtonClass}
            disabled={items.length < 2}
            onClick={() => setDialogOpen(true)}
            ref={addButtonRef}
            type="button"
          >
            Add relationship
          </button>
        ) : null}
      </div>

      {!canEdit ? (
        <div className="mt-4 border-l-4 border-caution bg-caution-soft px-4 py-3" role="note">
          <p className="text-sm font-semibold text-ink">Read-only access</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            Viewers can inspect dependency paths, but only an owner, admin, or member can add or remove relationships.
          </p>
        </div>
      ) : null}

      <div aria-live="polite" className="min-h-0">
        <ActionFeedback state={actionResult} />
      </div>

      <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.6fr)]">
        <aside className="min-w-0 border border-rule bg-white" aria-label="Choose a project item">
          <div className="border-b border-rule p-4">
            <label className="text-sm font-semibold text-ink" htmlFor={searchId}>
              Search project items
            </label>
            <input
              className={fieldClass}
              id={searchId}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Key, title, type, or status"
              type="search"
              value={query}
            />
          </div>
          <div className="max-h-[32rem] overflow-y-auto p-2">
            {visibleItems.length === 0 ? (
              <p className="p-3 text-sm leading-6 text-muted" role="status">
                No project items match “{query}”.
              </p>
            ) : (
              <ul aria-label="Project items" className="space-y-1">
                {visibleItems.map((item) => {
                  const selected = item.id === selectedItem?.id;
                  return (
                    <li key={item.id}>
                      <button
                        aria-label={`Select ${itemName(item)}`}
                        aria-pressed={selected}
                        className={`min-h-14 w-full border px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal ${
                          selected
                            ? "border-ink bg-ink text-paper"
                            : "border-transparent bg-white text-ink hover:border-rule hover:bg-paper"
                        }`}
                        onClick={() => setSelectedItemId(item.id)}
                        type="button"
                      >
                        <span className="block font-mono text-[0.68rem] uppercase tracking-[0.08em] opacity-75">
                          {item.itemKey} · {humanize(item.itemType)}
                        </span>
                        <span className="mt-1 block break-words text-sm font-semibold leading-5">
                          {item.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <div className="min-w-0" aria-live="polite">
          {selectedItem ? (
            <>
              <div className="border border-rule bg-white p-5 sm:p-6">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-signal">
                  {selectedItem.itemKey} · {humanize(selectedItem.itemType)}
                </p>
                <h2 className="mt-1 break-words text-xl font-semibold tracking-[-0.035em] text-ink sm:text-2xl">
                  {selectedItem.title}
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Status: <span className="font-semibold text-ink">{humanize(selectedItem.status)}</span>
                </p>
              </div>

              <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
                <section aria-labelledby="depends-on-heading" className="min-w-0">
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <h3 className="text-lg font-semibold text-ink" id="depends-on-heading">
                      Depends on
                    </h3>
                    <span className="font-mono text-xs text-muted">{dependsOn.length}</span>
                  </div>
                  {dependsOn.length === 0 ? (
                    <p className="border border-dashed border-rule bg-white p-4 text-sm leading-6 text-muted">
                      No upstream prerequisites are recorded for this item.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {dependsOn.map((dependency) => (
                        <RelationshipCard
                          canEdit={canEdit}
                          dependency={dependency}
                          dependent={selectedItem}
                          key={dependency.id}
                          onResult={setActionResult}
                          projectId={projectId}
                          upstream={itemsById.get(dependency.toItemId)}
                        />
                      ))}
                    </div>
                  )}
                </section>

                <section aria-labelledby="affects-heading" className="min-w-0">
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <h3 className="text-lg font-semibold text-ink" id="affects-heading">
                      Affects
                    </h3>
                    <span className="font-mono text-xs text-muted">{affects.length}</span>
                  </div>
                  {affects.length === 0 ? (
                    <p className="border border-dashed border-rule bg-white p-4 text-sm leading-6 text-muted">
                      No downstream items currently rely on this item.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {affects.map((dependency) => (
                        <RelationshipCard
                          canEdit={canEdit}
                          dependency={dependency}
                          dependent={itemsById.get(dependency.fromItemId)}
                          key={dependency.id}
                          onResult={setActionResult}
                          projectId={projectId}
                          upstream={selectedItem}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <section aria-labelledby="all-relationships-heading" className="mt-5 border border-rule bg-white">
        <div className="border-b border-rule px-5 py-4 sm:px-6">
          <h2 className="text-xl font-semibold tracking-[-0.035em] text-ink" id="all-relationships-heading">
            All relationships
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            A text-first graph of every explicit edge in this project. Direction and meaning remain available without color or a visual diagram.
          </p>
        </div>
        {dependencies.length === 0 ? (
          <div className="p-5 sm:p-6">
            <p className="border border-dashed border-rule bg-paper p-4 text-sm leading-6 text-muted">
              No dependency relationships have been recorded.
            </p>
          </div>
        ) : (
          <ol aria-label="Dependency graph" className="divide-y divide-rule">
            {dependencies.map((dependency, index) => {
              const dependent = itemsById.get(dependency.fromItemId);
              const upstream = itemsById.get(dependency.toItemId);
              return (
                <li className="grid gap-3 px-5 py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:px-6" key={dependency.id}>
                  <span className="font-mono text-xs text-muted" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold leading-6 text-ink">
                      {sentenceName(dependent)} depends on {sentenceName(upstream)}
                    </p>
                    <p className="mt-1 break-words text-xs text-muted">
                      {itemName(dependent)} → {itemName(upstream)}
                    </p>
                    <RelationshipDetails dependency={dependency} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {dialogOpen ? (
        <AddRelationshipDialog
          initialDependentId={selectedItem?.id ?? ""}
          items={items}
          onClose={() => setDialogOpen(false)}
          onResult={setActionResult}
          projectId={projectId}
        />
      ) : null}
    </section>
  );
}

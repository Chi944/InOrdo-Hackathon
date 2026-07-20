"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  initialRecordActionState,
  restoreRecordMutationForm,
} from "@/app/app/project-record-action-state";
import { createProjectItemAction } from "@/app/app/project-record-actions";
import { createOperationIdempotencyKey } from "@/app/app/operation-idempotency";

export type ProjectItemType =
  | "task"
  | "milestone"
  | "decision"
  | "event"
  | "risk"
  | "artifact";

export type ProjectItemStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "at_risk"
  | "completed"
  | "cancelled";

export type ProjectItemPriority = "low" | "medium" | "high" | "critical";

export type ProjectMemberOption = {
  id: string;
  displayName: string;
};

export type ProjectItemsViewItem = {
  id: string;
  itemKey: string;
  itemType: ProjectItemType;
  title: string;
  description: string | null;
  status: ProjectItemStatus;
  priority: ProjectItemPriority;
  assignee: ProjectMemberOption | null;
  startDate: string | null;
  dueDate: string | null;
  eventDate: string | null;
};

export type ProjectItemsViewProps = {
  projectId: string;
  workflowGeneration: number;
  items: ProjectItemsViewItem[];
  memberOptions: ProjectMemberOption[];
  canEdit: boolean;
};

type FilterValue = "all" | string;

const itemTypes: ProjectItemType[] = [
  "task",
  "milestone",
  "decision",
  "event",
  "risk",
  "artifact",
];

const itemStatuses: ProjectItemStatus[] = [
  "not_started",
  "in_progress",
  "blocked",
  "at_risk",
  "completed",
  "cancelled",
];

const itemPriorities: ProjectItemPriority[] = [
  "low",
  "medium",
  "high",
  "critical",
];

const statusStyles: Record<ProjectItemStatus, string> = {
  not_started: "border-rule bg-paper text-muted",
  in_progress: "border-signal/30 bg-[#eef1ff] text-signal",
  blocked: "border-red-300 bg-red-50 text-red-800",
  at_risk: "border-caution/40 bg-caution-soft text-caution",
  completed: "border-emerald-300 bg-emerald-50 text-emerald-800",
  cancelled: "border-rule bg-white text-muted line-through",
};

const statusMarks: Record<ProjectItemStatus, string> = {
  not_started: "○",
  in_progress: "◐",
  blocked: "!",
  at_risk: "△",
  completed: "✓",
  cancelled: "×",
};

const priorityStyles: Record<ProjectItemPriority, string> = {
  low: "border-rule bg-white text-muted",
  medium: "border-rule bg-paper text-ink",
  high: "border-caution/40 bg-caution-soft text-caution",
  critical: "border-red-300 bg-red-50 text-red-800",
};

const fieldClass =
  "mt-2 min-h-11 w-full rounded-none border border-rule bg-white px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

const filterClass =
  "min-h-11 w-full rounded-none border border-rule bg-white px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-signal disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center border border-rule bg-white px-4 text-sm font-semibold text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

function sentenceCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "No due date";

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function StatusBadge({ status }: { status: ProjectItemStatus }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 border px-2 py-1 text-xs font-medium ${statusStyles[status]}`}
    >
      <span aria-hidden="true" className="font-mono font-bold">
        {statusMarks[status]}
      </span>
      <span>{sentenceCase(status)}</span>
    </span>
  );
}

function PriorityBadge({ priority }: { priority: ProjectItemPriority }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 border px-2 py-1 text-xs font-medium ${priorityStyles[priority]}`}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      <span>{sentenceCase(priority)}</span>
    </span>
  );
}

function useMutationIdempotencyKey(
  scope: string,
  state: typeof initialRecordActionState,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rotateKey = useCallback(() => {
    const key = createOperationIdempotencyKey(scope);
    if (inputRef.current) inputRef.current.value = key;
  }, [scope]);

  useEffect(() => {
    rotateKey();
  }, [rotateKey]);

  useEffect(() => {
    if (state.idempotencyKeyDisposition === "rotate") rotateKey();
  }, [rotateKey, state]);

  return { inputRef, rotateKey };
}

function CreateItemDialog({
  projectId,
  memberOptions,
  workflowGeneration,
}: {
  projectId: string;
  memberOptions: ProjectMemberOption[];
  workflowGeneration: number;
}) {
  const prefix = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedFormRef = useRef<FormData | null>(null);
  const router = useRouter();
  const [state, action, isPending] = useActionState(
    createProjectItemAction,
    initialRecordActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      submittedFormRef.current = null;
      router.refresh();
      firstFieldRef.current?.focus();
    }
  }, [router, state.status]);
  const { inputRef: idempotencyKeyInputRef, rotateKey } =
    useMutationIdempotencyKey(
      `create-item:${projectId}:${workflowGeneration}`,
      state,
    );

  useEffect(() => {
    if (
      (state.status === "error" || state.status === "conflict") &&
      formRef.current &&
      submittedFormRef.current
    ) {
      restoreRecordMutationForm(
        formRef.current,
        submittedFormRef.current,
        state.idempotencyKeyDisposition === "retain",
      );
    }
  }, [state]);

  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    firstFieldRef.current?.focus();
  }

  function closeDialog() {
    if (isPending) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
    openButtonRef.current?.focus();
  }

  return (
    <>
      <button
        className={primaryButtonClass}
        onClick={openDialog}
        ref={openButtonRef}
        type="button"
      >
        Create item
      </button>

      <dialog
        aria-describedby={`${prefix}-description`}
        aria-labelledby={`${prefix}-title`}
        className="m-auto max-h-[calc(100%-2rem)] w-[min(44rem,calc(100%-2rem))] overflow-y-auto border border-rule bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/55"
        onCancel={(event) => {
          event.preventDefault();
          if (!isPending) closeDialog();
        }}
        onClose={() => openButtonRef.current?.focus()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (!isPending) closeDialog();
          }
        }}
        ref={dialogRef}
      >
        <div className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
              Native project record
            </p>
            <h2
              className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-ink"
              id={`${prefix}-title`}
            >
              Create project item
            </h2>
            <p
              className="mt-2 max-w-xl text-sm leading-6 text-muted"
              id={`${prefix}-description`}
            >
              Add a canonical record. The server validates every field before
              saving it to the project.
            </p>
          </div>
          <button
            aria-label="Close create item dialog"
            className="inline-flex size-11 shrink-0 items-center justify-center border border-rule bg-white text-xl text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            disabled={isPending}
            onClick={closeDialog}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form
          action={action}
          aria-busy={isPending}
          className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6"
          onChange={rotateKey}
          onSubmit={(event) => {
            submittedFormRef.current = new FormData(event.currentTarget);
          }}
          ref={formRef}
        >
          <input name="projectId" type="hidden" value={projectId} />
          <input
            name="expectedWorkflowGeneration"
            type="hidden"
            value={workflowGeneration}
          />
          <input name="idempotencyKey" ref={idempotencyKeyInputRef} type="hidden" />

          <label
            className="text-sm font-medium text-ink"
            htmlFor={`${prefix}-key`}
          >
            Item key
            <input
              autoComplete="off"
              className={fieldClass}
              disabled={isPending}
              id={`${prefix}-key`}
              maxLength={64}
              name="itemKey"
              pattern="[A-Z][A-Z0-9]*-[0-9]{2,}"
              placeholder="EVENT-12"
              ref={firstFieldRef}
              required
            />
            <span className="mt-1.5 block text-xs font-normal text-muted">
              Use an uppercase prefix and at least two digits.
            </span>
          </label>

          <label
            className="text-sm font-medium text-ink"
            htmlFor={`${prefix}-title-field`}
          >
            Title
            <input
              className={fieldClass}
              disabled={isPending}
              id={`${prefix}-title-field`}
              maxLength={240}
              name="title"
              required
            />
          </label>

          <label
            className="text-sm font-medium text-ink"
            htmlFor={`${prefix}-type`}
          >
            Type
            <select
              className={fieldClass}
              defaultValue="task"
              disabled={isPending}
              id={`${prefix}-type`}
              name="itemType"
            >
              {itemTypes.map((value) => (
                <option key={value} value={value}>
                  {sentenceCase(value)}
                </option>
              ))}
            </select>
          </label>

          <label
            className="text-sm font-medium text-ink"
            htmlFor={`${prefix}-status`}
          >
            Status
            <select
              className={fieldClass}
              defaultValue="not_started"
              disabled={isPending}
              id={`${prefix}-status`}
              name="status"
            >
              {itemStatuses.map((value) => (
                <option key={value} value={value}>
                  {sentenceCase(value)}
                </option>
              ))}
            </select>
          </label>

          <label
            className="text-sm font-medium text-ink"
            htmlFor={`${prefix}-priority`}
          >
            Priority
            <select
              className={fieldClass}
              defaultValue="medium"
              disabled={isPending}
              id={`${prefix}-priority`}
              name="priority"
            >
              {itemPriorities.map((value) => (
                <option key={value} value={value}>
                  {sentenceCase(value)}
                </option>
              ))}
            </select>
          </label>

          <label
            className="text-sm font-medium text-ink"
            htmlFor={`${prefix}-assignee`}
          >
            Assignee
            <select
              className={fieldClass}
              defaultValue=""
              disabled={isPending}
              id={`${prefix}-assignee`}
              name="ownerId"
            >
              <option value="">Unassigned</option>
              {memberOptions.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </label>

          <label
            className="text-sm font-medium text-ink sm:col-span-2"
            htmlFor={`${prefix}-description-field`}
          >
            Description <span className="font-normal text-muted">(optional)</span>
            <textarea
              className={`${fieldClass} min-h-28 py-3`}
              disabled={isPending}
              id={`${prefix}-description-field`}
              maxLength={10000}
              name="description"
              rows={4}
            />
          </label>

          <label
            className="text-sm font-medium text-ink"
            htmlFor={`${prefix}-start-date`}
          >
            Start date <span className="font-normal text-muted">(optional)</span>
            <input
              className={fieldClass}
              disabled={isPending}
              id={`${prefix}-start-date`}
              name="startDate"
              type="date"
            />
          </label>

          <label
            className="text-sm font-medium text-ink"
            htmlFor={`${prefix}-due-date`}
          >
            Due date <span className="font-normal text-muted">(optional)</span>
            <input
              className={fieldClass}
              disabled={isPending}
              id={`${prefix}-due-date`}
              name="dueDate"
              type="date"
            />
          </label>

          <label
            className="text-sm font-medium text-ink sm:col-span-2"
            htmlFor={`${prefix}-event-date`}
          >
            Event date <span className="font-normal text-muted">(events only)</span>
            <input
              className={fieldClass}
              disabled={isPending}
              id={`${prefix}-event-date`}
              name="eventDate"
              type="date"
            />
          </label>

          <div className="border-t border-rule pt-5 sm:col-span-2">
            {state.status !== "idle" ? (
              <p
                className={`mb-4 border px-3 py-2 text-sm leading-6 ${
                  state.status === "error" || state.status === "conflict"
                    ? "border-red-300 bg-red-50 text-red-800"
                    : "border-emerald-300 bg-emerald-50 text-emerald-800"
                }`}
                role={
                  state.status === "error" || state.status === "conflict"
                    ? "alert"
                    : "status"
                }
              >
                <span aria-hidden="true" className="mr-2 font-bold">
                  {state.status === "error" || state.status === "conflict"
                    ? "!"
                    : "✓"}
                </span>
                {state.message}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className={secondaryButtonClass}
                disabled={isPending}
                onClick={closeDialog}
                type="button"
              >
                Cancel
              </button>
              <button
                className={primaryButtonClass}
                disabled={isPending}
                type="submit"
              >
                {isPending ? "Creating item…" : "Create item"}
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}

function ItemTable({ items }: { items: ProjectItemsViewItem[] }) {
  return (
    <div className="hidden lg:block">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <caption className="sr-only">
          Project items with type, status, priority, assignee, and due date
        </caption>
        <thead className="bg-paper font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted">
          <tr>
            <th className="w-[31%] border-b border-rule px-5 py-3 font-medium" scope="col">
              Item
            </th>
            <th className="w-[12%] border-b border-rule px-3 py-3 font-medium" scope="col">
              Type
            </th>
            <th className="w-[15%] border-b border-rule px-3 py-3 font-medium" scope="col">
              Status
            </th>
            <th className="w-[13%] border-b border-rule px-3 py-3 font-medium" scope="col">
              Priority
            </th>
            <th className="w-[16%] border-b border-rule px-3 py-3 font-medium" scope="col">
              Assignee
            </th>
            <th className="w-[13%] border-b border-rule px-3 py-3 font-medium" scope="col">
              Due date
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr className="border-b border-rule last:border-b-0" key={item.id}>
              <th className="px-5 py-4 font-medium" scope="row">
                <Link
                  className="group block min-w-0 break-words text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
                  href={`/app/items/${item.id}`}
                >
                  <span className="block font-mono text-[0.65rem] uppercase tracking-[0.08em] text-signal">
                    {item.itemKey}
                  </span>
                  <span className="mt-1 block leading-5 underline-offset-4 group-hover:underline">
                    {item.title}
                  </span>
                </Link>
              </th>
              <td className="break-words px-3 py-4 text-muted">
                {sentenceCase(item.itemType)}
              </td>
              <td className="px-3 py-4">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-3 py-4">
                <PriorityBadge priority={item.priority} />
              </td>
              <td className="break-words px-3 py-4 text-muted">
                {item.assignee?.displayName ?? "Unassigned"}
              </td>
              <td className="break-words px-3 py-4 text-muted">
                {formatDate(item.dueDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ItemCards({ items }: { items: ProjectItemsViewItem[] }) {
  return (
    <ul aria-label="Project items" className="divide-y divide-rule lg:hidden">
      {items.map((item) => (
        <li className="min-w-0 p-4 sm:p-5" key={item.id}>
          <article>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <Link
                className="group min-w-0 break-words focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
                href={`/app/items/${item.id}`}
              >
                <span className="block font-mono text-[0.65rem] uppercase tracking-[0.08em] text-signal">
                  {item.itemKey} · {sentenceCase(item.itemType)}
                </span>
                <span className="mt-1 block text-base font-semibold leading-6 text-ink underline-offset-4 group-hover:underline">
                  {item.title}
                </span>
              </Link>
              <StatusBadge status={item.status} />
            </div>

            <dl className="mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div className="min-w-0">
                <dt className="text-xs text-muted">Priority</dt>
                <dd className="mt-1">
                  <PriorityBadge priority={item.priority} />
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted">Due date</dt>
                <dd className="mt-1 break-words text-ink">{formatDate(item.dueDate)}</dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-xs text-muted">Assignee</dt>
                <dd className="mt-1 break-words text-ink">
                  {item.assignee?.displayName ?? "Unassigned"}
                </dd>
              </div>
            </dl>
          </article>
        </li>
      ))}
    </ul>
  );
}

export function ProjectItemsView({
  projectId,
  workflowGeneration,
  items,
  memberOptions,
  canEdit,
}: ProjectItemsViewProps) {
  const filterPrefix = useId();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterValue>("all");
  const [statusFilter, setStatusFilter] = useState<FilterValue>("all");
  const [priorityFilter, setPriorityFilter] = useState<FilterValue>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<FilterValue>("all");

  const availableAssignees = useMemo(() => {
    const options = new Map(
      memberOptions.map((member) => [member.id, member] as const),
    );
    for (const item of items) {
      if (item.assignee) options.set(item.assignee.id, item.assignee);
    }
    return [...options.values()].sort((left, right) =>
      left.displayName.localeCompare(right.displayName),
    );
  }, [items, memberOptions]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        query.length === 0 ||
        [
          item.itemKey,
          item.title,
          item.description ?? "",
          item.assignee?.displayName ?? "",
        ].some((value) => value.toLocaleLowerCase().includes(query));
      const matchesType = typeFilter === "all" || item.itemType === typeFilter;
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      const matchesPriority =
        priorityFilter === "all" || item.priority === priorityFilter;
      const matchesAssignee =
        assigneeFilter === "all" ||
        (assigneeFilter === "unassigned"
          ? item.assignee === null
          : item.assignee?.id === assigneeFilter);

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus &&
        matchesPriority &&
        matchesAssignee
      );
    });
  }, [assigneeFilter, items, priorityFilter, search, statusFilter, typeFilter]);

  const hasActiveFilters =
    search !== "" ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    assigneeFilter !== "all";

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setAssigneeFilter("all");
  }

  return (
    <section aria-labelledby="project-items-heading" className="border border-rule bg-white">
      <div className="flex flex-col gap-4 border-b border-rule px-4 py-5 sm:px-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
            Canonical project records
          </p>
          <h2
            className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-ink"
            id="project-items-heading"
          >
            All project items
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Find the tasks, milestones, decisions, events, risks, and artifacts
            that make up this project.
          </p>
        </div>
        {canEdit ? (
          <CreateItemDialog
            memberOptions={memberOptions}
            projectId={projectId}
            workflowGeneration={workflowGeneration}
          />
        ) : (
          <p className="border border-rule bg-paper px-3 py-2 text-sm text-muted">
            Viewer access · Read only
          </p>
        )}
      </div>

      <div className="border-b border-rule bg-paper/60 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label
            className="text-xs font-medium text-muted sm:col-span-2 lg:col-span-1"
            htmlFor={`${filterPrefix}-search`}
          >
            Search items
            <input
              className={filterClass}
              id={`${filterPrefix}-search`}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Key, title, description, or assignee"
              type="search"
              value={search}
            />
          </label>

          <label
            className="text-xs font-medium text-muted"
            htmlFor={`${filterPrefix}-type`}
          >
            Filter by type
            <select
              className={filterClass}
              id={`${filterPrefix}-type`}
              onChange={(event) => setTypeFilter(event.target.value)}
              value={typeFilter}
            >
              <option value="all">All types</option>
              {itemTypes.map((value) => (
                <option key={value} value={value}>
                  {sentenceCase(value)}
                </option>
              ))}
            </select>
          </label>

          <label
            className="text-xs font-medium text-muted"
            htmlFor={`${filterPrefix}-status`}
          >
            Filter by status
            <select
              className={filterClass}
              id={`${filterPrefix}-status`}
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="all">All statuses</option>
              {itemStatuses.map((value) => (
                <option key={value} value={value}>
                  {sentenceCase(value)}
                </option>
              ))}
            </select>
          </label>

          <label
            className="text-xs font-medium text-muted"
            htmlFor={`${filterPrefix}-priority`}
          >
            Filter by priority
            <select
              className={filterClass}
              id={`${filterPrefix}-priority`}
              onChange={(event) => setPriorityFilter(event.target.value)}
              value={priorityFilter}
            >
              <option value="all">All priorities</option>
              {itemPriorities.map((value) => (
                <option key={value} value={value}>
                  {sentenceCase(value)}
                </option>
              ))}
            </select>
          </label>

          <label
            className="text-xs font-medium text-muted"
            htmlFor={`${filterPrefix}-assignee`}
          >
            Filter by assignee
            <select
              className={filterClass}
              id={`${filterPrefix}-assignee`}
              onChange={(event) => setAssigneeFilter(event.target.value)}
              value={assigneeFilter}
            >
              <option value="all">All assignees</option>
              <option value="unassigned">Unassigned</option>
              {availableAssignees.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p aria-atomic="true" aria-live="polite" className="text-sm text-muted" role="status">
            Showing {filteredItems.length} of {items.length} project {items.length === 1 ? "item" : "items"}
          </p>
          <button
            className="min-h-11 self-start px-1 text-sm font-semibold text-signal underline decoration-signal/30 underline-offset-4 hover:decoration-signal disabled:text-muted disabled:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal sm:self-auto"
            disabled={!hasActiveFilters}
            onClick={clearFilters}
            type="button"
          >
            Clear filters
          </button>
        </div>
      </div>

      {filteredItems.length > 0 ? (
        <>
          <ItemTable items={filteredItems} />
          <ItemCards items={filteredItems} />
        </>
      ) : (
        <div className="px-5 py-14 text-center">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-signal">
            {items.length === 0 ? "Project baseline" : "No filter matches"}
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-ink">
            {items.length === 0
              ? "No project items yet"
              : "No items match these filters"}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            {items.length === 0
              ? canEdit
                ? "Create the first canonical record to begin mapping this project."
                : "This project does not have any visible records."
              : "Try a broader search or clear the filters to return to the full project list."}
          </p>
          {items.length > 0 ? (
            <button
              className={`${secondaryButtonClass} mt-5`}
              onClick={clearFilters}
              type="button"
            >
              Reset filters
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

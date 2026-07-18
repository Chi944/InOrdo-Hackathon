"use client";

import { useActionState, useId, useState } from "react";

import { initialRecordActionState } from "@/app/app/project-record-action-state";
import {
  createDependencyAction,
  createProjectItemAction,
  removeDependencyAction,
  updateProjectItemAction,
} from "@/app/app/project-record-actions";

type ControlItem = {
  id: string;
  itemKey: string;
  title: string;
  status:
    | "not_started"
    | "in_progress"
    | "blocked"
    | "at_risk"
    | "completed"
    | "cancelled";
  version: number;
};

type ControlDependency = {
  id: string;
  fromItemId: string;
  toItemId: string;
  relationship: "depends_on" | "requires" | "informs" | "scheduled_by";
};

type ProjectRecordControlsProps = {
  projectId: string;
  items: ControlItem[];
  dependencies: ControlDependency[];
  canEdit: boolean;
};

const fieldClass =
  "mt-2 min-h-11 w-full border border-rule bg-white px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";
const buttonClass =
  "inline-flex min-h-11 items-center justify-center bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-signal disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

function ActionFeedback({
  state,
}: {
  state: typeof initialRecordActionState;
}) {
  if (state.status === "idle") return null;
  const isProblem = state.status === "error" || state.status === "conflict";
  return (
    <p
      className={`mt-3 text-sm ${isProblem ? "text-red-700" : "text-green-700"}`}
      role={isProblem ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}

function CreateItemForm({ projectId }: { projectId: string }) {
  const prefix = useId();
  const [state, action, pending] = useActionState(
    createProjectItemAction,
    initialRecordActionState,
  );

  return (
    <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
      <input name="projectId" type="hidden" value={projectId} />
      <label className="text-sm font-medium text-ink" htmlFor={`${prefix}-key`}>
        Item key
        <input className={fieldClass} id={`${prefix}-key`} name="itemKey" placeholder="OPS-24" required />
      </label>
      <label className="text-sm font-medium text-ink" htmlFor={`${prefix}-title`}>
        Title
        <input className={fieldClass} id={`${prefix}-title`} maxLength={240} name="title" required />
      </label>
      <label className="text-sm font-medium text-ink" htmlFor={`${prefix}-type`}>
        Type
        <select className={fieldClass} defaultValue="task" id={`${prefix}-type`} name="itemType">
          {['task', 'milestone', 'decision', 'event', 'risk', 'artifact'].map((value) => (
            <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-ink" htmlFor={`${prefix}-status`}>
        Status
        <select className={fieldClass} defaultValue="not_started" id={`${prefix}-status`} name="status">
          {['not_started', 'in_progress', 'blocked', 'at_risk', 'completed', 'cancelled'].map((value) => (
            <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-ink" htmlFor={`${prefix}-priority`}>
        Priority
        <select className={fieldClass} defaultValue="medium" id={`${prefix}-priority`} name="priority">
          {['low', 'medium', 'high', 'critical'].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-ink" htmlFor={`${prefix}-due`}>
        Due date (optional)
        <input className={fieldClass} id={`${prefix}-due`} name="dueDate" type="date" />
      </label>
      <div className="sm:col-span-2">
        <button className={buttonClass} disabled={pending} type="submit">
          {pending ? "Creating…" : "Create item"}
        </button>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}

function UpdateItemForm({
  projectId,
  items,
}: {
  projectId: string;
  items: ControlItem[];
}) {
  const prefix = useId();
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const [state, action, pending] = useActionState(
    updateProjectItemAction,
    initialRecordActionState,
  );

  return (
    <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
      <input name="projectId" type="hidden" value={projectId} />
      <input name="expectedVersion" type="hidden" value={selected?.version ?? 0} />
      <label className="text-sm font-medium text-ink" htmlFor={`${prefix}-item`}>
        Item
        <select
          className={fieldClass}
          id={`${prefix}-item`}
          name="itemId"
          onChange={(event) => setSelectedId(event.target.value)}
          value={selected?.id ?? ""}
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.itemKey} — {item.title}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-ink" htmlFor={`${prefix}-status`}>
        Status
        <select
          className={fieldClass}
          defaultValue={selected?.status}
          id={`${prefix}-status`}
          key={`${selected?.id}:${selected?.version}`}
          name="status"
        >
          {['not_started', 'in_progress', 'blocked', 'at_risk', 'completed', 'cancelled'].map((value) => (
            <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-2">
        <button className={buttonClass} disabled={pending || !selected} type="submit">
          {pending ? "Updating…" : "Update item"}
        </button>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}

function AddDependencyForm({
  projectId,
  items,
}: {
  projectId: string;
  items: ControlItem[];
}) {
  const prefix = useId();
  const [state, action, pending] = useActionState(
    createDependencyAction,
    initialRecordActionState,
  );

  return (
    <form action={action} className="mt-4 grid gap-4 sm:grid-cols-3">
      <input name="projectId" type="hidden" value={projectId} />
      <label className="text-sm font-medium text-ink" htmlFor={`${prefix}-dependent`}>
        Dependent item
        <select className={fieldClass} id={`${prefix}-dependent`} name="fromItemId">
          {items.map((item) => <option key={item.id} value={item.id}>{item.itemKey}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium text-ink" htmlFor={`${prefix}-relation`}>
        Relationship
        <select className={fieldClass} defaultValue="requires" id={`${prefix}-relation`} name="relationship">
          {['depends_on', 'requires', 'informs', 'scheduled_by'].map((value) => (
            <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-ink" htmlFor={`${prefix}-upstream`}>
        Upstream item
        <select
          className={fieldClass}
          defaultValue={items[1]?.id ?? items[0]?.id}
          id={`${prefix}-upstream`}
          name="toItemId"
        >
          {items.map((item) => <option key={item.id} value={item.id}>{item.itemKey}</option>)}
        </select>
      </label>
      <div className="sm:col-span-3">
        <button className={buttonClass} disabled={pending || items.length < 2} type="submit">
          {pending ? "Adding…" : "Add dependency"}
        </button>
        {items.length < 2 && <p className="mt-2 text-sm text-muted">Create at least two items first.</p>}
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}

function RemoveDependencyForm({
  dependency,
  label,
  projectId,
}: {
  dependency: ControlDependency;
  label: string;
  projectId: string;
}) {
  const [state, action, pending] = useActionState(
    removeDependencyAction,
    initialRecordActionState,
  );
  return (
    <form action={action} className="flex flex-wrap items-center justify-between gap-3 border-t border-rule py-3 first:border-t-0">
      <input name="projectId" type="hidden" value={projectId} />
      <input name="dependencyId" type="hidden" value={dependency.id} />
      <span className="text-sm text-muted">{label}</span>
      <button
        aria-label={`Remove ${label}`}
        className="min-h-9 border border-rule px-3 text-xs font-semibold text-ink hover:border-ink disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}

export function ProjectRecordControls({
  projectId,
  items,
  dependencies,
  canEdit,
}: ProjectRecordControlsProps) {
  const itemKeys = new Map(items.map((item) => [item.id, item.itemKey]));

  if (!canEdit) {
    return (
      <section className="mt-5 border border-rule bg-white p-5" aria-labelledby="record-controls-heading">
        <h2 className="text-lg font-semibold text-ink" id="record-controls-heading">Record controls</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Viewer access is read-only. An owner, admin, or member can change project records.</p>
      </section>
    );
  }

  return (
    <section className="mt-5 border border-rule bg-white" aria-labelledby="record-controls-heading">
      <div className="border-b border-rule px-5 py-4">
        <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">Authorized operations</p>
        <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em] text-ink" id="record-controls-heading">Project record controls</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Changes are validated on the server and refreshed from Supabase. Stale item versions are rejected.</p>
      </div>
      <div className="divide-y divide-rule px-5">
        <details className="py-4">
          <summary className="cursor-pointer font-semibold text-ink">Create a project item</summary>
          <CreateItemForm projectId={projectId} />
        </details>
        <details className="py-4">
          <summary className="cursor-pointer font-semibold text-ink">Update an item status</summary>
          <UpdateItemForm items={items} projectId={projectId} />
        </details>
        <details className="py-4">
          <summary className="cursor-pointer font-semibold text-ink">Manage dependencies</summary>
          <AddDependencyForm items={items} projectId={projectId} />
          <div className="mt-5" aria-label="Current dependencies">
            {dependencies.length === 0 ? (
              <p className="text-sm text-muted">No dependency records are available.</p>
            ) : (
              dependencies.map((dependency) => {
                const label = `${itemKeys.get(dependency.fromItemId) ?? "Unknown item"} ${dependency.relationship.replaceAll("_", " ")} ${itemKeys.get(dependency.toItemId) ?? "Unknown item"}`;
                return (
                  <RemoveDependencyForm
                    dependency={dependency}
                    key={dependency.id}
                    label={label}
                    projectId={projectId}
                  />
                );
              })
            )}
          </div>
        </details>
      </div>
    </section>
  );
}

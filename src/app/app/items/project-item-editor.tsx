"use client";

import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { createOperationIdempotencyKey } from "@/app/app/operation-idempotency";
import { updateProjectItemAction } from "@/app/app/project-record-actions";
import {
  initialRecordActionState,
  restoreRecordMutationForm,
} from "@/app/app/project-record-action-state";

type EditableItem = {
  id: string;
  itemKey: string;
  itemType: "task" | "milestone" | "decision" | "event" | "risk" | "artifact";
  title: string;
  description: string | null;
  status:
    | "not_started"
    | "in_progress"
    | "blocked"
    | "at_risk"
    | "completed"
    | "cancelled";
  priority: "low" | "medium" | "high" | "critical";
  ownerId: string | null;
  startDate: string | null;
  dueDate: string | null;
  eventDate: string | null;
  version: number;
};

type MemberOption = { id: string; name: string };

const fieldClass =
  "mt-2 min-h-11 w-full rounded-sm border border-rule bg-white px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

function Feedback({ state }: { state: typeof initialRecordActionState }) {
  if (state.status === "idle") return null;
  const isProblem = state.status === "error" || state.status === "conflict";
  return (
    <div
      className={`mt-4 border px-4 py-3 text-sm ${
        isProblem
          ? "border-caution bg-caution-soft text-ink"
          : "border-emerald-700/30 bg-emerald-50 text-emerald-900"
      }`}
      role={isProblem ? "alert" : "status"}
    >
      <strong className="mr-2">
        {state.status === "conflict"
          ? "Refresh required."
          : state.status === "error"
            ? "Could not save."
            : "Saved."}
      </strong>
      {state.message}
    </div>
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

export function ProjectItemEditor({
  canEdit,
  item,
  memberOptions,
  projectId,
  workflowGeneration,
}: {
  canEdit: boolean;
  item: EditableItem;
  memberOptions: MemberOption[];
  projectId: string;
  workflowGeneration: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedFormRef = useRef<FormData | null>(null);
  const prefix = useId();
  const router = useRouter();
  const [itemType, setItemType] = useState(item.itemType);
  const [state, action, pending] = useActionState(
    updateProjectItemAction,
    initialRecordActionState,
  );

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status]);
  const { inputRef: idempotencyKeyInputRef, rotateKey } =
    useMutationIdempotencyKey(
      `update-item:${projectId}:${item.id}:${workflowGeneration}`,
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
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    if (pending) return;
    dialogRef.current?.close();
  }

  if (!canEdit) {
    return (
      <p className="border border-rule bg-paper px-4 py-3 text-sm text-muted">
        Viewer access is read-only. Item details and relationships remain available.
      </p>
    );
  }

  return (
    <>
      <button
        className="inline-flex min-h-11 items-center justify-center rounded-sm bg-ink px-5 text-sm font-semibold text-white transition hover:bg-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        onClick={openDialog}
        ref={triggerRef}
        type="button"
      >
        Edit item
      </button>
      <dialog
        aria-labelledby={`${prefix}-title`}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(48rem,calc(100%-2rem))] overflow-y-auto rounded-sm border border-rule bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/55"
        onCancel={(event) => {
          event.preventDefault();
          if (!pending) closeDialog();
        }}
        onClose={() => triggerRef.current?.focus()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (!pending) closeDialog();
          }
        }}
        ref={dialogRef}
      >
        <form
          action={action}
          aria-busy={pending}
          className="p-5 sm:p-7"
          onChange={rotateKey}
          onSubmit={(event) => {
            submittedFormRef.current = new FormData(event.currentTarget);
          }}
          ref={formRef}
        >
          <input name="projectId" type="hidden" value={projectId} />
          <input name="itemId" type="hidden" value={item.id} />
          <input name="expectedVersion" type="hidden" value={item.version} />
          <input
            name="expectedWorkflowGeneration"
            type="hidden"
            value={workflowGeneration}
          />
          <input name="idempotencyKey" ref={idempotencyKeyInputRef} type="hidden" />
          <div className="flex items-start justify-between gap-5 border-b border-rule pb-5">
            <div>
              <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
                Version {item.version} · validated server update
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]" id={`${prefix}-title`}>
                Edit {item.itemKey}
              </h2>
            </div>
            <button
              aria-label="Close edit item dialog"
              className="grid size-11 shrink-0 place-items-center rounded-sm border border-rule text-xl hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              disabled={pending}
              onClick={closeDialog}
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold" htmlFor={`${prefix}-key`}>
              Item key
              <input className={fieldClass} defaultValue={item.itemKey} disabled={pending} id={`${prefix}-key`} name="itemKey" pattern="[A-Z][A-Z0-9]*-[0-9]{2,}" required />
            </label>
            <label className="text-sm font-semibold" htmlFor={`${prefix}-type`}>
              Type
              <select className={fieldClass} disabled={pending} id={`${prefix}-type`} name="itemType" onChange={(event) => setItemType(event.target.value as EditableItem["itemType"])} value={itemType}>
                {[
                  "task",
                  "milestone",
                  "decision",
                  "event",
                  "risk",
                  "artifact",
                ].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold sm:col-span-2" htmlFor={`${prefix}-name`}>
              Title
              <input autoFocus className={fieldClass} defaultValue={item.title} disabled={pending} id={`${prefix}-name`} maxLength={240} name="title" required />
            </label>
            <label className="text-sm font-semibold sm:col-span-2" htmlFor={`${prefix}-description`}>
              Description or rationale
              <textarea className={`${fieldClass} min-h-28 py-3`} defaultValue={item.description ?? ""} disabled={pending} id={`${prefix}-description`} maxLength={10000} name="description" />
            </label>
            <label className="text-sm font-semibold" htmlFor={`${prefix}-status`}>
              Status
              <select className={fieldClass} defaultValue={item.status} disabled={pending} id={`${prefix}-status`} name="status">
                {[
                  "not_started",
                  "in_progress",
                  "blocked",
                  "at_risk",
                  "completed",
                  "cancelled",
                ].map((value) => (
                  <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold" htmlFor={`${prefix}-priority`}>
              Priority
              <select className={fieldClass} defaultValue={item.priority} disabled={pending} id={`${prefix}-priority`} name="priority">
                {["low", "medium", "high", "critical"].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold" htmlFor={`${prefix}-owner`}>
              Assignee
              <select className={fieldClass} defaultValue={item.ownerId ?? ""} disabled={pending} id={`${prefix}-owner`} name="ownerId">
                <option value="">Unassigned</option>
                {memberOptions.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold" htmlFor={`${prefix}-start`}>
              Start date
              <input className={fieldClass} defaultValue={item.startDate ?? ""} disabled={pending} id={`${prefix}-start`} name="startDate" type="date" />
            </label>
            <label className="text-sm font-semibold" htmlFor={`${prefix}-due`}>
              Due date
              <input className={fieldClass} defaultValue={item.dueDate ?? ""} disabled={pending} id={`${prefix}-due`} name="dueDate" type="date" />
            </label>
            {itemType === "event" ? (
              <label className="text-sm font-semibold" htmlFor={`${prefix}-event`}>
                Event date
                <input className={fieldClass} defaultValue={item.eventDate ?? ""} disabled={pending} id={`${prefix}-event`} name="eventDate" type="date" />
              </label>
            ) : (
              <input name="eventDate" type="hidden" value="" />
            )}
          </div>

          <Feedback state={state} />
          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-rule pt-5 sm:flex-row sm:justify-end">
            <button className="min-h-11 rounded-sm border border-rule px-5 text-sm font-semibold hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" disabled={pending} onClick={closeDialog} type="button">
              Cancel
            </button>
            <button className="min-h-11 rounded-sm bg-ink px-5 text-sm font-semibold text-white hover:bg-signal disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" disabled={pending} type="submit">
              {pending ? "Saving item…" : "Save item"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

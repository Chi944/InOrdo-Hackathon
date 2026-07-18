"use client";

import { LoaderCircle, RotateCcw, X } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";

import {
  createOperationIdempotencyKey,
  shouldRotateOperationIdempotencyKey,
} from "@/app/app/operation-idempotency";

type DemoResetControlProps = {
  projectId: string;
  canReset: boolean;
  onResetFinished(operationId: string): void;
};

function safeResponseMessage(body: unknown, fallback: string) {
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

export function DemoResetControl({
  projectId,
  canReset,
  onResetFinished,
}: DemoResetControlProps) {
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const resetLock = useRef(false);
  const idempotencyKey = useRef<string | null>(null);

  function openDialog() {
    if (!canReset || resetting) return;
    setError(null);
    setMessage(null);
    const dialog = dialogRef.current;
    if (typeof dialog?.showModal === "function") dialog.showModal();
    else dialog?.setAttribute("open", "");
    requestAnimationFrame(() => cancelRef.current?.focus());
  }

  function closeDialog() {
    const dialog = dialogRef.current;
    if (typeof dialog?.close === "function") dialog.close();
    else dialog?.removeAttribute("open");
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  async function resetDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReset || resetting || resetLock.current) return;

    resetLock.current = true;
    setResetting(true);
    setError(null);
    setMessage(null);
    idempotencyKey.current ??= createOperationIdempotencyKey(
      `reset:${projectId}`,
    );

    try {
      const response = await fetch(`/api/projects/${projectId}/demo/reset`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirmed: true,
          idempotencyKey: idempotencyKey.current,
        }),
      });
      const body = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        if (shouldRotateOperationIdempotencyKey(response.status)) {
          idempotencyKey.current = null;
        }
        throw new Error(
          safeResponseMessage(
            body,
            response.status === 409
              ? "Reset is temporarily unavailable. Wait, refresh, and try again once."
              : "The demo workspace could not be reset safely.",
          ),
        );
      }
      const record =
        typeof body === "object" && body !== null
          ? (body as Record<string, unknown>)
          : null;
      if (!record || typeof record.operationId !== "string") {
        throw new Error(
          "The reset response was incomplete. Refresh before trying again.",
        );
      }

      idempotencyKey.current = null;
      const duplicate = record.duplicate === true;
      setMessage(
        duplicate
          ? "This reset was already recorded. The canonical baseline is unchanged."
          : "Demo reset completed. The canonical 24-item, 26-dependency baseline is restored and prior workflow history remains archived.",
      );
      closeDialog();
      onResetFinished(record.operationId);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The demo workspace could not be reset safely.",
      );
      closeDialog();
    } finally {
      resetLock.current = false;
      setResetting(false);
      requestAnimationFrame(() => resultRef.current?.focus());
    }
  }

  return (
    <section
      aria-labelledby="demo-reset-heading"
      className="border border-rule bg-white"
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between lg:p-6">
        <div>
          <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
            Demo maintenance
          </p>
          <h2
            className="mt-1 text-xl font-semibold tracking-[-0.035em] text-ink"
            id="demo-reset-heading"
          >
            Restore the synthetic baseline
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Reset restores the 24 canonical records and 26 dependencies. It
            retires temporary records and preserves prior evidence and
            operations as archived history.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-rule bg-paper px-4 text-sm font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50"
          disabled={!canReset || resetting}
          onClick={openDialog}
          ref={triggerRef}
          type="button"
        >
          {resetting ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
          ) : (
            <RotateCcw aria-hidden="true" className="size-4" />
          )}
          {resetting ? "Resetting…" : "Reset demo workspace"}
        </button>
      </div>

      {!canReset ? (
        <p className="border-t border-rule bg-paper px-5 py-3 text-sm text-muted lg:px-6">
          Only a workspace owner or admin can reset the synthetic project.
        </p>
      ) : null}

      <div className="outline-none" ref={resultRef} tabIndex={-1}>
        {error ? (
          <p
            className="border-t border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800 lg:px-6"
            role="alert"
          >
            {error}
          </p>
        ) : message ? (
          <p
            className="border-t border-green-200 bg-green-50 px-5 py-3 text-sm text-green-800 lg:px-6"
            role="status"
          >
            {message}
          </p>
        ) : null}
      </div>

      <dialog
        aria-labelledby="demo-reset-dialog-title"
        aria-describedby="demo-reset-dialog-description"
        className="m-auto w-[min(34rem,calc(100%-2rem))] max-h-[calc(100dvh-2rem)] overflow-auto border border-rule bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/45"
        onClose={() => triggerRef.current?.focus()}
        ref={dialogRef}
      >
        <form className="p-5 sm:p-6" onSubmit={resetDemo}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
                Explicit confirmation
              </p>
              <h3
                className="mt-1 text-2xl font-semibold tracking-[-0.04em]"
                id="demo-reset-dialog-title"
              >
                Reset this demo workspace?
              </h3>
            </div>
            <button
              aria-label="Close reset confirmation"
              className="grid size-10 shrink-0 place-items-center border border-rule hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              disabled={resetting}
              onClick={closeDialog}
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <p
            className="mt-3 text-sm leading-6 text-muted"
            id="demo-reset-dialog-description"
          >
            Current demo work will be replaced by the canonical baseline.
            Temporary records are retired, not deleted, and audit history is
            preserved. Reset has no built-in undo.
          </p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="inline-flex min-h-11 items-center justify-center border border-rule bg-white px-4 text-sm font-semibold hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              disabled={resetting}
              onClick={closeDialog}
              ref={cancelRef}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center bg-ink px-4 text-sm font-semibold text-white hover:bg-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50"
              disabled={resetting}
              type="submit"
            >
              {resetting ? "Resetting demo…" : "Confirm reset to baseline"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}

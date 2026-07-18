"use client";

import { FilePlus2, LoaderCircle, ShieldCheck } from "lucide-react";
import {
  type FormEvent,
  type RefObject,
  useId,
  useRef,
  useState,
} from "react";

export const maximumSourceLength = 12_000;

export const seededDemoSource = {
  title: "Venue update — summit date",
  sourceType: "pasted_update" as const,
  author: "Synthetic venue team",
  occurredAt: "",
  text: "Venue update — 20 July 2026: The campus convention hall is unavailable on 12 September 2026. The venue team has offered 26 September 2026 instead. All other venue terms remain unchanged.",
};

type SourceFields = {
  title: string;
  sourceType: "pasted_update" | "manual_note";
  author: string;
  occurredAt: string;
  text: string;
};

type FieldErrors = Partial<Record<keyof SourceFields, string>>;

export type AnalysisSubmitResult =
  | {
      kind: "completed";
      analysisRequestId: string;
      proposalId: string | null;
      duplicate: boolean;
    }
  | {
      kind: "processing";
      analysisRequestId: string;
    };

type SourceUpdateFormProps = {
  projectId: string;
  canAnalyze: boolean;
  onAnalysisFinished(result: AnalysisSubmitResult): void;
};

const inputClass =
  "mt-2 min-h-11 w-full border border-rule bg-white px-3 text-sm text-ink shadow-[inset_0_1px_0_rgba(23,35,31,0.03)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:bg-paper disabled:text-muted";

function fieldDescriptionId(id: string, error?: string) {
  return error ? `${id}-help ${id}-error` : `${id}-help`;
}

function validate(fields: SourceFields): FieldErrors {
  const errors: FieldErrors = {};
  if (!fields.title.trim()) errors.title = "Enter a short source title.";
  else if (fields.title.trim().length > 240) {
    errors.title = "Keep the source title to 240 characters or fewer.";
  }
  if (!fields.author.trim()) errors.author = "Identify the source author or team.";
  else if (fields.author.trim().length > 120) {
    errors.author = "Keep the author label to 120 characters or fewer.";
  }
  if (!fields.text.trim()) errors.text = "Paste the source update to analyze.";
  else if (fields.text.length > maximumSourceLength) {
    errors.text = `Keep the source update to ${maximumSourceLength.toLocaleString("en-US")} characters or fewer.`;
  }
  if (
    fields.occurredAt &&
    Number.isNaN(new Date(fields.occurredAt).getTime())
  ) {
    errors.occurredAt = "Enter a valid date and time, or leave it blank.";
  }
  return errors;
}

function firstInvalidRef(
  errors: FieldErrors,
  refs: Record<keyof SourceFields, RefObject<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>>,
) {
  const order: Array<keyof SourceFields> = [
    "title",
    "sourceType",
    "author",
    "occurredAt",
    "text",
  ];
  return order.find((field) => errors[field])
    ? refs[order.find((field) => errors[field]) as keyof SourceFields]
    : null;
}

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

function responseId(body: unknown, key: string) {
  if (
    typeof body === "object" &&
    body !== null &&
    key in body &&
    typeof (body as Record<string, unknown>)[key] === "string"
  ) {
    return (body as Record<string, string>)[key];
  }
  return null;
}

export function SourceUpdateForm({
  projectId,
  canAnalyze,
  onAnalysisFinished,
}: SourceUpdateFormProps) {
  const prefix = useId();
  const [fields, setFields] = useState<SourceFields>({
    title: "",
    sourceType: "pasted_update",
    author: "",
    occurredAt: "",
    text: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitLock = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const sourceTypeRef = useRef<HTMLSelectElement>(null);
  const authorRef = useRef<HTMLInputElement>(null);
  const occurredAtRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const refs = {
    title: titleRef,
    sourceType: sourceTypeRef,
    author: authorRef,
    occurredAt: occurredAtRef,
    text: textRef,
  };

  function updateField<Key extends keyof SourceFields>(
    key: Key,
    value: SourceFields[Key],
  ) {
    setFields((current) => ({ ...current, [key]: value }));
    if (errors[key]) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  }

  function insertSeededUpdate() {
    setFields(seededDemoSource);
    setErrors({});
    setSubmitError(null);
    setNotice("Seeded synthetic source inserted. Review it before analysis.");
    requestAnimationFrame(() => textRef.current?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || submitting || !canAnalyze) return;

    const nextErrors = validate(fields);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setSubmitError("Review the highlighted source fields before continuing.");
      setNotice(null);
      requestAnimationFrame(() => firstInvalidRef(nextErrors, refs)?.current?.focus());
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: {
            title: fields.title.trim(),
            type: fields.sourceType,
            author: fields.author.trim(),
            timestamp: fields.occurredAt
              ? new Date(fields.occurredAt).toISOString()
              : null,
            text: fields.text,
          },
          maxDepth: 5,
        }),
      });
      const body = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        throw new Error(
          safeResponseMessage(
            body,
            response.status === 413
              ? "This source is too large for analysis. Shorten it and try again."
              : "The update could not be analyzed. Try again safely.",
          ),
        );
      }

      const analysisRequestId = responseId(body, "analysisRequestId");
      if (!analysisRequestId) {
        throw new Error("The analysis response was incomplete. Refresh before retrying.");
      }

      if (response.status === 202) {
        setNotice(
          "This exact source is already being analyzed. Refresh the review shortly; no second model request was started.",
        );
        onAnalysisFinished({ kind: "processing", analysisRequestId });
      } else {
        const proposalId = responseId(body, "proposalId");
        const duplicate =
          typeof body === "object" &&
          body !== null &&
          "duplicate" in body &&
          body.duplicate === true;
        setNotice(
          duplicate
            ? "The existing analysis is ready for review."
            : "Analysis complete. The evidence-backed review is ready.",
        );
        onAnalysisFinished({
          kind: "completed",
          analysisRequestId,
          proposalId,
          duplicate,
        });
      }
      requestAnimationFrame(() => noticeRef.current?.focus());
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "The update could not be analyzed. Try again safely.",
      );
      requestAnimationFrame(() => noticeRef.current?.focus());
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby={`${prefix}-heading`}
      className="border border-rule bg-white"
    >
      <div className="flex flex-col gap-4 border-b border-rule px-5 py-5 sm:flex-row sm:items-start sm:justify-between lg:px-6">
        <div>
          <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
            01 · Evidence intake
          </p>
          <h2
            className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-ink"
            id={`${prefix}-heading`}
          >
            What changed?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Preserve the update first. InOrdo will draft an interpretation, not a decision.
          </p>
        </div>
        <button
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 border border-rule bg-paper px-3 text-sm font-semibold text-ink transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50"
          disabled={submitting || !canAnalyze}
          onClick={insertSeededUpdate}
          type="button"
        >
          <FilePlus2 aria-hidden="true" className="size-4" />
          Insert seeded demo update
        </button>
      </div>

      <form className="grid gap-5 p-5 lg:p-6" noValidate onSubmit={submit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold text-ink" htmlFor={`${prefix}-title`}>
            Source title
            <input
              aria-label="Source title"
              aria-describedby={fieldDescriptionId(`${prefix}-title`, errors.title)}
              aria-invalid={Boolean(errors.title)}
              autoComplete="off"
              className={inputClass}
              disabled={submitting || !canAnalyze}
              id={`${prefix}-title`}
              maxLength={240}
              onChange={(event) => updateField("title", event.target.value)}
              ref={titleRef}
              value={fields.title}
            />
            <span className="mt-1 block text-xs font-normal text-muted" id={`${prefix}-title-help`}>
              A recognizable label for the preserved update.
            </span>
            {errors.title ? (
              <span className="mt-1 block text-xs font-normal text-red-700" id={`${prefix}-title-error`}>
                {errors.title}
              </span>
            ) : null}
          </label>

          <label className="text-sm font-semibold text-ink" htmlFor={`${prefix}-source-type`}>
            Source type
            <select
              aria-label="Source type"
              aria-describedby={`${prefix}-source-type-help`}
              className={inputClass}
              disabled={submitting || !canAnalyze}
              id={`${prefix}-source-type`}
              onChange={(event) =>
                updateField(
                  "sourceType",
                  event.target.value as SourceFields["sourceType"],
                )
              }
              ref={sourceTypeRef}
              value={fields.sourceType}
            >
              <option value="pasted_update">Pasted update</option>
              <option value="manual_note">Manual note</option>
            </select>
            <span className="mt-1 block text-xs font-normal text-muted" id={`${prefix}-source-type-help`}>
              Choose how this source entered the workspace.
            </span>
          </label>

          <label className="text-sm font-semibold text-ink" htmlFor={`${prefix}-author`}>
            Author label
            <input
              aria-label="Author label"
              aria-describedby={fieldDescriptionId(`${prefix}-author`, errors.author)}
              aria-invalid={Boolean(errors.author)}
              autoComplete="off"
              className={inputClass}
              disabled={submitting || !canAnalyze}
              id={`${prefix}-author`}
              maxLength={120}
              onChange={(event) => updateField("author", event.target.value)}
              ref={authorRef}
              value={fields.author}
            />
            <span className="mt-1 block text-xs font-normal text-muted" id={`${prefix}-author-help`}>
              A person, team, or system label—not an account identity.
            </span>
            {errors.author ? (
              <span className="mt-1 block text-xs font-normal text-red-700" id={`${prefix}-author-error`}>
                {errors.author}
              </span>
            ) : null}
          </label>

          <label className="text-sm font-semibold text-ink" htmlFor={`${prefix}-occurred-at`}>
            Occurred at <span className="font-normal text-muted">(optional)</span>
            <input
              aria-label="Occurred at (optional)"
              aria-describedby={fieldDescriptionId(`${prefix}-occurred-at`, errors.occurredAt)}
              aria-invalid={Boolean(errors.occurredAt)}
              className={inputClass}
              disabled={submitting || !canAnalyze}
              id={`${prefix}-occurred-at`}
              onChange={(event) => updateField("occurredAt", event.target.value)}
              ref={occurredAtRef}
              type="datetime-local"
              value={fields.occurredAt}
            />
            <span className="mt-1 block text-xs font-normal text-muted" id={`${prefix}-occurred-at-help`}>
              Stored with timezone; leave blank when the source gives no precise time.
            </span>
            {errors.occurredAt ? (
              <span className="mt-1 block text-xs font-normal text-red-700" id={`${prefix}-occurred-at-error`}>
                {errors.occurredAt}
              </span>
            ) : null}
          </label>
        </div>

        <label className="text-sm font-semibold text-ink" htmlFor={`${prefix}-text`}>
          Source text
          <textarea
            aria-label="Source text"
            aria-describedby={fieldDescriptionId(`${prefix}-text`, errors.text)}
            aria-invalid={Boolean(errors.text)}
            className={`${inputClass} min-h-40 resize-y py-3 leading-6`}
            disabled={submitting || !canAnalyze}
            id={`${prefix}-text`}
            maxLength={maximumSourceLength}
            onChange={(event) => updateField("text", event.target.value)}
            ref={textRef}
            value={fields.text}
          />
          <span
            className="mt-1 flex flex-col gap-1 text-xs font-normal text-muted sm:flex-row sm:items-center sm:justify-between"
            id={`${prefix}-text-help`}
          >
            <span>Include the exact statement and enough context to interpret it. Do not add conclusions.</span>
            <span className="shrink-0 font-mono tabular-nums">
              {fields.text.length.toLocaleString("en-US")} / {maximumSourceLength.toLocaleString("en-US")} characters
            </span>
          </span>
          {errors.text ? (
            <span className="mt-1 block text-xs font-normal text-red-700" id={`${prefix}-text-error`}>
              {errors.text}
            </span>
          ) : null}
        </label>

        <div className="border-l-2 border-signal bg-[#f4f6ff] px-4 py-3 text-sm leading-6 text-muted">
          <p className="flex items-start gap-2 font-semibold text-ink">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-signal" />
            Synthetic workspace and privacy
          </p>
          <p className="mt-1">
            This demo workspace is synthetic. Source text is preserved and sent server-side to GPT-5.6 with provider storage disabled. Do not paste secrets, personal data, or customer content.
          </p>
        </div>

        {!canAnalyze ? (
          <p className="border border-rule bg-paper px-4 py-3 text-sm leading-6 text-muted">
            Viewer access is read-only. A workspace owner, admin, or member can analyze a source update.
          </p>
        ) : null}

        {submitting ? (
          <div
            aria-live="polite"
            className="border border-signal/25 bg-[#f4f6ff] p-4"
            role="status"
          >
            <p className="flex items-center gap-2 font-semibold text-ink">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none text-signal" />
              Analysis in progress
            </p>
            <p className="mt-1 text-sm leading-6 text-muted">
              The backend returns one result after the complete pipeline. It does not emit live stage telemetry, so no individual stage is marked complete yet.
            </p>
            <ul className="mt-3 grid gap-2 text-sm text-ink sm:grid-cols-2">
              <li>Saving source</li>
              <li>Extracting change with GPT-5.6</li>
              <li>Traversing dependencies</li>
              <li>Preparing recovery proposal</li>
            </ul>
          </div>
        ) : null}

        <div
          className="outline-none"
          ref={noticeRef}
          tabIndex={-1}
        >
          {submitError ? (
            <p className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {submitError}
            </p>
          ) : notice ? (
            <p className="border-l-2 border-green-700 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
              {notice}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-white transition hover:bg-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50"
            disabled={submitting || !canAnalyze}
            type="submit"
          >
            {submitting ? (
              <>
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                Analyzing change…
              </>
            ) : (
              "Analyze change"
            )}
          </button>
          <p className="text-xs leading-5 text-muted">
            Analysis drafts review records only. It does not mutate project items.
          </p>
        </div>
      </form>
    </section>
  );
}

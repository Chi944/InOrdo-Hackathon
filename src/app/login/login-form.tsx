"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { loginAction } from "@/app/login/actions";

const initialLoginState: { error: string | null } = { error: null };

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialLoginState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <input name="next" type="hidden" value={nextPath} />

      <div>
        <label className="text-sm font-semibold text-ink" htmlFor="email">
          Email
        </label>
        <input
          autoComplete="email"
          className="mt-2 min-h-12 w-full border border-rule bg-white px-3 text-ink outline-none transition focus:border-signal focus:ring-2 focus:ring-signal/20"
          id="email"
          name="email"
          required
          type="email"
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-ink" htmlFor="password">
          Password
        </label>
        <input
          autoComplete="current-password"
          className="mt-2 min-h-12 w-full border border-rule bg-white px-3 text-ink outline-none transition focus:border-signal focus:ring-2 focus:ring-signal/20"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>

      <div aria-live="polite" className="min-h-6">
        {state.error ? (
          <p className="text-sm font-medium text-caution" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>

      <button
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-white transition hover:bg-signal disabled:cursor-wait disabled:opacity-65"
        disabled={isPending}
        type="submit"
      >
        {isPending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight className="size-4" aria-hidden="true" />
        )}
        {isPending ? "Signing in…" : "Sign in to demo"}
      </button>
    </form>
  );
}

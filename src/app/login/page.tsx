import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";

import { LoginForm } from "@/app/login/login-form";
import { getSafeRedirect } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Sign in · InOrdo",
  description: "Sign in to the isolated InOrdo demonstration workspace.",
};

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const requestedNext = Array.isArray(query.next) ? query.next[0] : query.next;
  const nextPath = getSafeRedirect(requestedNext);

  return (
    <main
      className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-[90rem] place-items-center px-5 py-12 sm:px-8"
      id="main-content"
    >
      <section className="grid w-full max-w-4xl border border-rule bg-white shadow-[0_30px_80px_rgba(23,35,31,0.1)] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="bg-ink p-8 text-paper sm:p-10">
          <div className="grid size-10 place-items-center border border-white/25 font-mono text-xs tracking-[0.08em]">
            IO
          </div>
          <p className="mt-12 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-[#AEBEFF]">
            Isolated demo access
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em]">
            Review real seeded project data.
          </h1>
          <p className="mt-5 text-sm leading-7 text-[#C9D0CD]">
            Authentication and RLS protect this preview. Evidence extraction,
            recovery actions, mutations, and undo are still being built.
          </p>
          <div className="mt-10 flex items-start gap-3 border-t border-white/15 pt-5 text-sm text-[#DCE1DF]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#AEBEFF]" aria-hidden="true" />
            <p>The demo password is provisioned outside source control.</p>
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.15em] text-signal">
                Authentication
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-ink">
                Sign in
              </h2>
            </div>
            <LockKeyhole className="size-5 text-muted" aria-hidden="true" />
          </div>

          <LoginForm nextPath={nextPath} />

          <p className="mt-7 text-sm leading-6 text-muted">
            Need access? Ask the demo operator to provision an account. No
            public sign-up is enabled.
          </p>
          <Link
            className="mt-5 inline-flex rounded-sm text-sm font-semibold text-signal underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
            href="/"
          >
            Return to the landing page
          </Link>
        </div>
      </section>
    </main>
  );
}

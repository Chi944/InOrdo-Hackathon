import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { logoutAction } from "@/app/login/actions";
import { ProjectNavigation } from "@/app/app/project-navigation";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireUser, type AuthenticatedUser } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let user: AuthenticatedUser | null = null;
  let authenticationRequired = false;

  try {
    const client = await createServerSupabaseClient();
    user = await requireUser(client);
  } catch (error) {
    if (
      error instanceof AuthorizationError &&
      error.code === "unauthenticated"
    ) {
      authenticationRequired = true;
    } else {
      throw error;
    }
  }

  if (authenticationRequired || !user) {
    redirect("/login?next=/app");
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-rule bg-white">
        <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:px-12">
          <Link
            className="inline-flex items-center gap-3 rounded-sm font-semibold tracking-[-0.04em] text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
            href="/"
          >
            <span
              className="grid size-9 place-items-center bg-ink font-mono text-[0.65rem] tracking-[0.08em] text-paper"
              aria-hidden="true"
            >
              IO
            </span>
            InOrdo
          </Link>

          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <span className="inline-flex border border-signal/25 bg-[#eef1ff] px-2 py-2 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-signal sm:px-3 sm:text-[0.62rem] sm:tracking-[0.1em]">
              <span className="sm:hidden">Synthetic</span>
              <span className="hidden sm:inline">Synthetic demo</span>
            </span>
            <p className="hidden max-w-56 truncate text-sm text-muted sm:block">
              Authenticated session
            </p>
            <form action={logoutAction}>
              <button
                className="inline-flex min-h-10 items-center gap-2 border border-rule bg-white px-3 text-sm font-semibold text-ink transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                type="submit"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </div>
        <ProjectNavigation />
      </header>
      {children}
    </div>
  );
}

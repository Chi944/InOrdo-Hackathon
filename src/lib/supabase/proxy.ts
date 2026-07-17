import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/env/public";
import type { Database } from "@/types/database";

function copySessionState(
  source: NextResponse,
  target: NextResponse,
  responseHeaders: Readonly<Record<string, string>>,
) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }

  for (const [name, value] of Object.entries(responseHeaders)) {
    target.headers.set(name, value);
  }

  return target;
}

export async function updateSupabaseSession(request: NextRequest) {
  const env = getPublicEnv();
  let responseHeaders: Record<string, string> = {};
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = NextResponse.next({ request });

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }

          responseHeaders = headers;
          for (const [name, value] of Object.entries(headers)) {
            response.headers.set(name, value);
          }
        },
      },
    },
  );

  // Keep this validation immediately after client construction. It refreshes
  // the session when needed and verifies the JWT signature for server use.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );

    return copySessionState(
      response,
      NextResponse.redirect(loginUrl),
      responseHeaders,
    );
  }

  return response;
}

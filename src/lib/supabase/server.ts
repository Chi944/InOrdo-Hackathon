import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/env/public";
import type { Database } from "@/types/database";

declare const requestScopedClientCapability: unique symbol;

/** Cookie-backed, user-scoped client. Its nominal brand prevents privileged substitution. */
export type ServerSupabaseClient = SupabaseClient<Database> & {
  readonly [requestScopedClientCapability]: "request-scoped";
};

type CreateServerSupabaseClientOptions = {
  /** Route Handlers must apply this same Headers object to their response. */
  responseHeaders?: Headers;
};

export async function createServerSupabaseClient(
  options: CreateServerSupabaseClientOptions = {},
): Promise<ServerSupabaseClient> {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet, responseHeaders) {
          for (const [name, value] of Object.entries(responseHeaders)) {
            options.responseHeaders?.set(name, value);
          }

          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set response cookies. The request proxy
            // refreshes them; Server Actions can write through this same client.
          }
        },
      },
    },
  ) as ServerSupabaseClient;
}

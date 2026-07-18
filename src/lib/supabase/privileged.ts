import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getPrivilegedSupabaseEnv } from "@/lib/env/server";
import type { Database } from "@/types/database";

declare const privilegedClientCapability: unique symbol;

/** RLS-bypassing capability that must never satisfy a request-scoped client API. */
export type PrivilegedSupabaseClient = SupabaseClient<Database> & {
  readonly [privilegedClientCapability]: "privileged";
};

/** RLS-bypassing client for narrowly reviewed administrative workflows only. */
export function createPrivilegedSupabaseClient(): PrivilegedSupabaseClient {
  const env = getPrivilegedSupabaseEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  ) as PrivilegedSupabaseClient;
}

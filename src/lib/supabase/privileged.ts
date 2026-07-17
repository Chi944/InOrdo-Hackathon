import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPrivilegedSupabaseEnv } from "@/lib/env/server";
import type { Database } from "@/types/database";

/** RLS-bypassing client for narrowly reviewed administrative workflows only. */
export function createPrivilegedSupabaseClient() {
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
  );
}

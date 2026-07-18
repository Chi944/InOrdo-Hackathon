import { describe, expect, it } from "vitest";

import type { PrivilegedSupabaseClient } from "@/lib/supabase/privileged";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

type IsAssignable<Source, Target> = Source extends Target ? true : false;

describe("Supabase client capabilities", () => {
  it("keeps privileged clients nominally distinct from request-scoped clients", () => {
    const privilegedIsRequestScoped: IsAssignable<
      PrivilegedSupabaseClient,
      ServerSupabaseClient
    > = false;
    const requestScopedIsPrivileged: IsAssignable<
      ServerSupabaseClient,
      PrivilegedSupabaseClient
    > = false;

    expect(privilegedIsRequestScoped).toBe(false);
    expect(requestScopedIsPrivileged).toBe(false);
  });
});

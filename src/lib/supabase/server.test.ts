import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { describe, expect, it, vi } from "vitest";

import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/env/public", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://project.example.test",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-value",
  }),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));

describe("request-scoped Supabase client", () => {
  it("captures response-safety headers for a Route Handler response", async () => {
    const cookieStore = { getAll: vi.fn(() => []), set: vi.fn() };
    vi.mocked(cookies).mockResolvedValue(
      cookieStore as unknown as Awaited<ReturnType<typeof cookies>>,
    );
    vi.mocked(createServerClient).mockReturnValue({} as ReturnType<typeof createServerClient>);
    const responseHeaders = new Headers();

    await createServerSupabaseClient({ responseHeaders });

    const options = vi.mocked(createServerClient).mock.calls[0]?.[2];
    expect(options).toBeDefined();
    options?.cookies?.setAll?.(
      [
        {
          name: "sb-session",
          value: "refreshed",
          options: { httpOnly: true, path: "/" },
        },
      ],
      { "cache-control": "private, no-store" },
    );

    expect(cookieStore.set).toHaveBeenCalledWith(
      "sb-session",
      "refreshed",
      expect.objectContaining({ httpOnly: true, path: "/" }),
    );
    expect(responseHeaders.get("cache-control")).toBe("private, no-store");
  });
});

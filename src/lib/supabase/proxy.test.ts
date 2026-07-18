import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateSupabaseSession } from "@/lib/supabase/proxy";

vi.mock("@/lib/env/public", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://project.example.test",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-value",
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

const mockedCreateServerClient = vi.mocked(createServerClient);

function mockClaims(
  claims: Record<string, unknown> | null,
  refresh = true,
) {
  mockedCreateServerClient.mockImplementation((...arguments_) => {
    const options = arguments_[2] as {
      cookies: {
        setAll: (
          cookies: Array<{
            name: string;
            value: string;
            options?: { httpOnly?: boolean; path?: string };
          }>,
          headers: Record<string, string>,
        ) => void;
      };
    };

    return {
      auth: {
        getClaims: async () => {
          if (refresh) {
            options.cookies.setAll(
              [
                {
                  name: "sb-session",
                  value: "refreshed",
                  options: { httpOnly: true, path: "/" },
                },
              ],
              { "cache-control": "private, no-store" },
            );
          }

          return { data: { claims } };
        },
      },
    } as ReturnType<typeof createServerClient>;
  });
}

describe("Supabase session proxy", () => {
  beforeEach(() => {
    mockedCreateServerClient.mockReset();
  });

  it("preserves refreshed cookies and cache headers on an authenticated response", async () => {
    mockClaims({ sub: "user-id" });

    const response = await updateSupabaseSession(
      new NextRequest("https://inordo.test/app?view=items"),
    );

    expect(response.status).toBe(200);
    expect(response.cookies.get("sb-session")?.value).toBe("refreshed");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("preserves refreshed state and uses a local next path when redirecting", async () => {
    mockClaims(null);

    const response = await updateSupabaseSession(
      new NextRequest("https://inordo.test/app?view=items"),
    );

    const location = new URL(response.headers.get("location") ?? "");
    expect(response.status).toBe(307);
    expect(location.origin).toBe("https://inordo.test");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/app?view=items");
    expect(response.cookies.get("sb-session")?.value).toBe("refreshed");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});

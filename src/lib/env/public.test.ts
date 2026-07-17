import { describe, expect, it } from "vitest";

import {
  EnvironmentConfigurationError,
  parsePublicEnv,
} from "@/lib/env/public";

describe("public environment validation", () => {
  it("accepts a valid public Supabase configuration", () => {
    expect(
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-key",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-key",
    });
  });

  it("names invalid variables without echoing their values", () => {
    const invalidUrl = "not-a-project-url";

    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: invalidUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      }),
    ).toThrow(EnvironmentConfigurationError);

    try {
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: invalidUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentConfigurationError);
      expect((error as Error).message).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect((error as Error).message).toContain(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      );
      expect((error as Error).message).not.toContain(invalidUrl);
    }
  });
});

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

  it.each([
    "ftp://example.supabase.co",
    "javascript:alert(1)",
    "http://example.supabase.co",
    "https://username@example.supabase.co",
    "https://username:password@example.supabase.co",
    " https://example.supabase.co",
    "https://example.supabase.co ",
  ])("rejects an unsafe or padded Supabase URL: %s", (url) => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: url,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-key",
      }),
    ).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });

  it.each([
    "http://localhost:54321",
    "http://127.0.0.1:54321",
    "http://[::1]:54321",
  ])("allows plaintext HTTP only for a loopback Supabase URL: %s", (url) => {
    expect(
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: url,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-key",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-key",
    });
  });

  it.each(["   ", "\t", " public-test-key", "public-test-key "])(
    "rejects a blank or padded public key",
    (key) => {
      expect(() =>
        parsePublicEnv({
          NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: key,
        }),
      ).toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    },
  );
});

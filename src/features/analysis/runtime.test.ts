import { describe, expect, it, vi } from "vitest";

import { createProjectAnalysisRuntime } from "@/features/analysis/runtime";
import { getOpenAIEnv } from "@/lib/env/server";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/env/server", () => ({
  getOpenAIEnv: vi.fn(),
}));

describe("project analysis runtime", () => {
  it("does not read model secrets while constructing the request runtime", () => {
    createProjectAnalysisRuntime({} as ServerSupabaseClient);

    expect(getOpenAIEnv).not.toHaveBeenCalled();
  });
});

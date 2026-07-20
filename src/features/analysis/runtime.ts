import "server-only";

import OpenAI from "openai";

import { AnalysisError } from "@/features/analysis/errors";
import { createGatewayAnalysisAdapter } from "@/features/analysis/gateway-adapter";
import {
  createOpenAIAnalysisAdapter,
} from "@/features/analysis/openai-adapter";
import { createProjectAnalysisService } from "@/features/analysis/service";
import {
  createPrivilegedSupabaseAnalysisRpcExecutor,
  createSupabaseAnalysisPersistence,
  type AnalysisRpcExecutor,
} from "@/features/analysis/supabase-persistence";
import { getAnalysisRuntimeEnv } from "@/lib/env/server";
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

export function createProjectAnalysisRuntime(client: ServerSupabaseClient) {
  let initializedPersistenceRpc: AnalysisRpcExecutor | null = null;
  const persistenceRpc: AnalysisRpcExecutor = {
    execute(functionName, args) {
      initializedPersistenceRpc ??=
        createPrivilegedSupabaseAnalysisRpcExecutor(
          createPrivilegedSupabaseClient(),
        );
      return initializedPersistenceRpc.execute(functionName, args);
    },
  };
  const persistence = createSupabaseAnalysisPersistence(persistenceRpc);

  return createProjectAnalysisService({
    client,
    persistence,
    resolveProviderPolicy: () => getAnalysisRuntimeEnv().policy,
    resolveModel: (route) => {
      const environment = getAnalysisRuntimeEnv();
      if (
        route === "openai_recording" &&
        environment.mode === "recording" &&
        environment.credential
      ) {
        const openai = new OpenAI({
          apiKey: environment.credential.apiKey,
          maxRetries: 0,
        });
        return createOpenAIAnalysisAdapter(openai.responses, {
          model: environment.credential.model,
        });
      }
      if (
        route === "gateway_fallback" &&
        environment.mode === "auto" &&
        environment.credential
      ) {
        return createGatewayAnalysisAdapter(
          environment.credential.apiKey,
          environment.credential.model,
        );
      }
      throw new AnalysisError("analysis_disabled");
    },
  });
}

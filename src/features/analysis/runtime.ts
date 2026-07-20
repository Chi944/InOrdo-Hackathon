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
    resolveModel: (claim) => {
      const environment = getAnalysisRuntimeEnv();
      if (
        claim.providerRoute === "openai_recording" &&
        claim.modelName === "gpt-5.6-luna" &&
        environment.mode === "recording" &&
        environment.credential?.model === claim.modelName
      ) {
        const openai = new OpenAI({
          apiKey: environment.credential.apiKey,
          maxRetries: 0,
        });
        return createOpenAIAnalysisAdapter(openai.responses, {
          model: claim.modelName,
        });
      }
      if (
        claim.providerRoute === "gateway_fallback" &&
        claim.modelName === "openai/gpt-oss-20b" &&
        environment.mode === "auto" &&
        environment.credential?.model === claim.modelName
      ) {
        return createGatewayAnalysisAdapter(
          environment.credential.apiKey,
          claim.modelName,
        );
      }
      throw new AnalysisError("model_unavailable");
    },
  });
}

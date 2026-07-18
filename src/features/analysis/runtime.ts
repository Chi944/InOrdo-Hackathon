import "server-only";

import OpenAI from "openai";

import {
  createOpenAIAnalysisAdapter,
  type OpenAIAnalysisAdapter,
} from "@/features/analysis/openai-adapter";
import { createProjectAnalysisService } from "@/features/analysis/service";
import {
  createPrivilegedSupabaseAnalysisRpcExecutor,
  createSupabaseAnalysisPersistence,
  type AnalysisRpcExecutor,
} from "@/features/analysis/supabase-persistence";
import { getOpenAIEnv, getOpenAIModel } from "@/lib/env/server";
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

export function createProjectAnalysisRuntime(client: ServerSupabaseClient) {
  const modelName = getOpenAIModel();
  let initializedModel: OpenAIAnalysisAdapter | null = null;
  const getModel = () => {
    if (initializedModel) return initializedModel;
    const environment = getOpenAIEnv();
    const openai = new OpenAI({
      apiKey: environment.OPENAI_API_KEY,
      maxRetries: 0,
    });
    initializedModel = createOpenAIAnalysisAdapter(openai.responses, {
      model: modelName,
    });
    return initializedModel;
  };
  const model: OpenAIAnalysisAdapter = {
    extractChange: (call) => getModel().extractChange(call),
    draftProposal: (call) => getModel().draftProposal(call),
  };
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
    model,
    modelName,
  });
}

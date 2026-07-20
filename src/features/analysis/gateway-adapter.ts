import "server-only";

import OpenAI from "openai";

import {
  createOpenAIAnalysisAdapter,
  type AnalysisModelAdapter,
} from "@/features/analysis/openai-adapter";
import type { GatewayModel } from "@/features/analysis/provider-policy";

const gatewayBaseURL = "https://ai-gateway.vercel.sh/v1";

export function createGatewayAnalysisAdapter(
  apiKey: string,
  model: GatewayModel,
): AnalysisModelAdapter {
  const client = new OpenAI({
    apiKey,
    baseURL: gatewayBaseURL,
    maxRetries: 0,
  });

  return createOpenAIAnalysisAdapter(client.responses, { model });
}

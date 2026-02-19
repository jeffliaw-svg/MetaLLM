import OpenAI from "openai";
import { LENGTH_PRESETS, MODEL_MAP, type Length, type Speed } from "../config";
import type { ProviderResponse } from "./types";

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) _client = new OpenAI();
  return _client;
}

export async function queryChatGPT(
  prompt: string,
  speed: Speed,
  length: Length,
  { webSearch = true, systemOverride }: { webSearch?: boolean; systemOverride?: string } = {}
): Promise<ProviderResponse> {
  const model = MODEL_MAP.chatgpt[speed];
  const preset = LENGTH_PRESETS[length];

  // When web search is enabled the model needs headroom for internal search
  // tool calls + the final answer.  Floor at 4096 (same approach as Claude).
  const maxOutputTokens = webSearch
    ? Math.max(preset.maxTokens, 4096)
    : preset.maxTokens;

  const instructions = systemOverride
    ? systemOverride
    : webSearch
      ? `${preset.systemInstruction}\n\nYou have access to a web search tool. ALWAYS use it to find current, up-to-date information before answering. Do not rely on your training data for facts that may have changed.`
      : preset.systemInstruction;

  const t0 = performance.now();
  const response = await getClient().responses.create({
    model,
    instructions,
    input: prompt,
    ...(webSearch && {
      tools: [{ type: "web_search_preview" as const }],
      // Force the model to use web search rather than letting it decide
      tool_choice: { type: "web_search_preview" as const },
    }),
    max_output_tokens: maxOutputTokens,
  });
  const latency = (performance.now() - t0) / 1000;

  return {
    engine: "chatgpt",
    model,
    text: response.output_text ?? "",
    latencySeconds: Math.round(latency * 100) / 100,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}

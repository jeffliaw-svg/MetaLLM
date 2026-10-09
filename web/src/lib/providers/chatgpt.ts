import OpenAI from "openai";
import { LENGTH_PRESETS, MODEL_MAP, type Length, type Speed } from "../config";
import type { ProviderResponse } from "./types";

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) _client = new OpenAI();
  return _client;
}

const REASONING_HEADROOM = 8192;

export async function queryChatGPT(
  prompt: string,
  speed: Speed,
  length: Length,
  { webSearch = true, systemOverride }: { webSearch?: boolean; systemOverride?: string } = {}
): Promise<ProviderResponse> {
  const model = MODEL_MAP.chatgpt[speed];
  const preset = LENGTH_PRESETS[length];

  // GPT-5 models spend output tokens on reasoning and search tool calls
  // before the answer, so reserve headroom on top of the length preset.
  const maxOutputTokens = preset.maxTokens + REASONING_HEADROOM;

  const instructions = systemOverride
    ? systemOverride
    : webSearch
      ? `${preset.systemInstruction}\n\nYou have access to a web search tool. ALWAYS use it to find current, up-to-date information before answering. Do not rely on your training data for facts that may have changed.`
      : preset.systemInstruction;

  const t0 = performance.now();
  const response = await getClient().responses.create({
    model,
    instructions,
    input: webSearch
      ? `Search the web for current information, then answer this query:\n\n${prompt}`
      : prompt,
    ...(webSearch && {
      tools: [{ type: "web_search_preview" as const }],
    }),
    max_output_tokens: maxOutputTokens,
    ...(speed === "fast" && { reasoning: { effort: "low" as const } }),
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

import OpenAI from "openai";
import { LENGTH_PRESETS, MODEL_MAP, type Length, type Speed } from "../config";
import type { ProviderResponse } from "./types";

const client = new OpenAI();

export async function queryChatGPT(
  prompt: string,
  speed: Speed,
  length: Length,
  { webSearch = true }: { webSearch?: boolean } = {}
): Promise<ProviderResponse> {
  const model = MODEL_MAP.chatgpt[speed];
  const preset = LENGTH_PRESETS[length];

  // When web search is enabled the model needs headroom for internal search
  // tool calls + the final answer.  Floor at 4096 (same approach as Claude).
  const maxOutputTokens = webSearch
    ? Math.max(preset.maxTokens, 4096)
    : preset.maxTokens;

  const instructions = webSearch
    ? `${preset.systemInstruction}\n\nYou have access to a web search tool. ALWAYS use it to find current, up-to-date information before answering. Do not rely on your training data for facts that may have changed.`
    : preset.systemInstruction;

  const t0 = performance.now();
  const response = await client.responses.create({
    model,
    instructions,
    input: prompt,
    ...(webSearch && { tools: [{ type: "web_search_preview" as const }] }),
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

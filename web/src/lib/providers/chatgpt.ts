import OpenAI from "openai";
import { LENGTH_PRESETS, MODEL_MAP, type Length, type Speed } from "../config";
import type { ProviderResponse } from "./types";

const client = new OpenAI();

export async function queryChatGPT(
  prompt: string,
  speed: Speed,
  length: Length
): Promise<ProviderResponse> {
  const model = MODEL_MAP.chatgpt[speed];
  const preset = LENGTH_PRESETS[length];

  const t0 = performance.now();
  const response = await client.responses.create({
    model,
    instructions: preset.systemInstruction,
    input: prompt,
    tools: [{ type: "web_search_preview" }],
    max_output_tokens: preset.maxTokens,
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

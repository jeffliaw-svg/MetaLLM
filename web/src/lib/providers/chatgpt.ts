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
  const response = await client.chat.completions.create({
    model,
    max_completion_tokens: preset.maxTokens,
    messages: [
      { role: "system", content: preset.systemInstruction },
      { role: "user", content: prompt },
    ],
  });
  const latency = (performance.now() - t0) / 1000;

  const choice = response.choices[0];
  const usage = response.usage;

  return {
    engine: "chatgpt",
    model,
    text: choice?.message?.content ?? "",
    latencySeconds: Math.round(latency * 100) / 100,
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
  };
}

import OpenAI from "openai";
import { LENGTH_PRESETS, MODEL_MAP, type Length, type Speed } from "../config";
import type { ProviderResponse } from "./types";

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) _client = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY ?? "",
    baseURL: "https://api.perplexity.ai",
  });
  return _client;
}

export async function queryPerplexity(
  prompt: string,
  speed: Speed,
  length: Length,
  { systemOverride }: { webSearch?: boolean; systemOverride?: string } = {}
): Promise<ProviderResponse> {
  const model = MODEL_MAP.perplexity[speed];
  const preset = LENGTH_PRESETS[length];
  const systemInstruction = systemOverride ?? preset.systemInstruction;

  const t0 = performance.now();
  const response = await getClient().chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: prompt },
    ],
    max_tokens: Math.max(preset.maxTokens, 4096),
  });
  const latency = (performance.now() - t0) / 1000;

  const text = response.choices[0]?.message?.content ?? "";
  const citations: string[] = (response as any).citations ?? [];
  const sourcesText = citations.length > 0
    ? "\n\n**Sources:**\n" + citations.map((url: string, i: number) => `- [${i + 1}](${url})`).join("\n")
    : "";

  return {
    engine: "perplexity",
    model,
    text: text + sourcesText,
    latencySeconds: Math.round(latency * 100) / 100,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}

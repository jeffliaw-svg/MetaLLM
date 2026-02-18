import Anthropic from "@anthropic-ai/sdk";
import { LENGTH_PRESETS, MODEL_MAP, type Length, type Speed } from "../config";
import type { ProviderResponse } from "./types";

const client = new Anthropic();

export async function queryClaude(
  prompt: string,
  speed: Speed,
  length: Length,
  { webSearch = true }: { webSearch?: boolean } = {}
): Promise<ProviderResponse> {
  const model = MODEL_MAP.claude[speed];
  const preset = LENGTH_PRESETS[length];

  // When web search is enabled the model's tool_use blocks count toward
  // max_tokens.  Anthropic recommends ≥ 4096 so the model has headroom
  // for search calls + the final text response.  The system instruction
  // still controls actual response length.
  const maxTokens = webSearch ? Math.max(preset.maxTokens, 4096) : preset.maxTokens;

  const t0 = performance.now();
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: preset.systemInstruction,
    messages: [{ role: "user", content: prompt }],
    ...(webSearch && { tools: [{ type: "web_search_20250305" as const, name: "web_search" }] }),
  });
  const latency = (performance.now() - t0) / 1000;

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  return {
    engine: "claude",
    model,
    text,
    latencySeconds: Math.round(latency * 100) / 100,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}

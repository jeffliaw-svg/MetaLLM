import Anthropic from "@anthropic-ai/sdk";
import { LENGTH_PRESETS, MODEL_MAP, type Length, type Speed } from "../config";
import type { ProviderResponse } from "./types";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

export async function queryClaude(
  prompt: string,
  speed: Speed,
  length: Length,
  { webSearch = true }: { webSearch?: boolean } = {}
): Promise<ProviderResponse> {
  const model = MODEL_MAP.claude[speed];
  const preset = LENGTH_PRESETS[length];

  const maxTokens = webSearch ? Math.max(preset.maxTokens, 4096) : preset.maxTokens;

  const systemInstruction = webSearch
    ? `${preset.systemInstruction}\n\nYou have access to a web search tool. ALWAYS use it to find current, up-to-date information before answering. Do not rely on your training data for facts that may have changed.`
    : preset.systemInstruction;

  const t0 = performance.now();
  const message = await getClient().messages.create({
    model,
    max_tokens: maxTokens,
    system: systemInstruction,
    messages: [{ role: "user", content: prompt }],
    ...(webSearch && { tools: [{ type: "web_search_20250305" as const, name: "web_search" }] }),
  });
  const latency = (performance.now() - t0) / 1000;

  const textBlocks = message.content.filter((b) => b.type === "text");
  const text = textBlocks.map((b: any) => b.text).join("");

  // Extract web search citations and append as sources
  const citations: Array<{ url: string; title: string }> = [];
  for (const block of textBlocks) {
    const b = block as any;
    if (b.citations) {
      for (const cite of b.citations) {
        if (cite.type === "web_search_result_location" && cite.url) {
          citations.push({ url: cite.url, title: cite.title ?? "" });
        }
      }
    }
  }
  const uniqueCitations = [...new Map(citations.map((c) => [c.url, c])).values()];
  const finalText =
    uniqueCitations.length > 0
      ? text + "\n\n**Sources:**\n" + uniqueCitations.map((c) => `- [${c.title}](${c.url})`).join("\n")
      : text;

  return {
    engine: "claude",
    model,
    text: finalText,
    latencySeconds: Math.round(latency * 100) / 100,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}

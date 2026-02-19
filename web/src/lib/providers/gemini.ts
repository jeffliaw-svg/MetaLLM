import { GoogleGenAI } from "@google/genai";
import { LENGTH_PRESETS, MODEL_MAP, type Length, type Speed } from "../config";
import type { ProviderResponse } from "./types";

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? "" });
  return _ai;
}

/** Minimum thinking budget for gemini-2.5-pro (thinking can't be disabled). */
const THINKING_BUDGET = 128;
/** Higher thinking budget when web search is enabled — the model needs more
 *  reasoning tokens to process grounding results. */
const THINKING_BUDGET_WITH_SEARCH = 1024;

export async function queryGemini(
  prompt: string,
  speed: Speed,
  length: Length,
  { webSearch = true, systemOverride }: { webSearch?: boolean; systemOverride?: string } = {}
): Promise<ProviderResponse> {
  const modelName = MODEL_MAP.gemini[speed];
  const preset = LENGTH_PRESETS[length];
  const isThinkingModel = modelName.includes("2.5");

  const thinkingBudget = webSearch ? THINKING_BUDGET_WITH_SEARCH : THINKING_BUDGET;
  const baseTokens = webSearch
    ? Math.max(preset.maxTokens, 4096)
    : preset.maxTokens;
  const maxOutputTokens = isThinkingModel
    ? baseTokens + thinkingBudget
    : baseTokens;

  const systemInstruction = systemOverride
    ? systemOverride
    : webSearch
      ? `${preset.systemInstruction}\n\nYou have access to Google Search. ALWAYS use it to find current, up-to-date information before answering. Do not rely on your training data for facts that may have changed.`
      : preset.systemInstruction;

  const t0 = performance.now();
  const result = await getAI().models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      maxOutputTokens,
      systemInstruction,
      ...(isThinkingModel && {
        thinkingConfig: { thinkingBudget },
      }),
      ...(webSearch && { tools: [{ googleSearch: {} }] }),
    },
  });
  const latency = (performance.now() - t0) / 1000;

  const text = result.text ?? "";
  const usage = result.usageMetadata;

  return {
    engine: "gemini",
    model: modelName,
    text,
    latencySeconds: Math.round(latency * 100) / 100,
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
  };
}

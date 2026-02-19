import { GoogleGenAI } from "@google/genai";
import { LENGTH_PRESETS, MODEL_MAP, type Length, type Speed } from "../config";
import type { ProviderResponse } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? "" });

/** Minimum thinking budget for gemini-2.5-pro (thinking can't be disabled). */
const THINKING_BUDGET = 128;

export async function queryGemini(
  prompt: string,
  speed: Speed,
  length: Length,
  { webSearch = true }: { webSearch?: boolean } = {}
): Promise<ProviderResponse> {
  const modelName = MODEL_MAP.gemini[speed];
  const preset = LENGTH_PRESETS[length];
  const isThinkingModel = modelName.includes("2.5");

  // When web search (Google Search grounding) is enabled the model needs
  // enough output-token headroom for grounding chunks + the answer itself.
  // Mirror the Claude approach: floor at 4096 when search is on.
  const baseTokens = webSearch
    ? Math.max(preset.maxTokens, 4096)
    : preset.maxTokens;
  const maxOutputTokens = isThinkingModel
    ? baseTokens + THINKING_BUDGET
    : baseTokens;

  const t0 = performance.now();
  const result = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      maxOutputTokens,
      systemInstruction: preset.systemInstruction,
      ...(isThinkingModel && {
        thinkingConfig: { thinkingBudget: THINKING_BUDGET },
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

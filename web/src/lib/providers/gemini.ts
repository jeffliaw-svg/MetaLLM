import { GoogleGenAI } from "@google/genai";
import { LENGTH_PRESETS, MODEL_MAP, type Length, type Speed } from "../config";
import type { ProviderResponse } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? "" });

/** Minimum thinking budget for gemini-2.5-pro (thinking can't be disabled). */
const THINKING_BUDGET = 128;

export async function queryGemini(
  prompt: string,
  speed: Speed,
  length: Length
): Promise<ProviderResponse> {
  const modelName = MODEL_MAP.gemini[speed];
  const preset = LENGTH_PRESETS[length];
  const isThinkingModel = modelName.includes("2.5");

  const t0 = performance.now();
  const result = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      maxOutputTokens: isThinkingModel
        ? preset.maxTokens + THINKING_BUDGET
        : preset.maxTokens,
      systemInstruction: preset.systemInstruction,
      ...(isThinkingModel && {
        thinkingConfig: { thinkingBudget: THINKING_BUDGET },
      }),
      tools: [{ googleSearch: {} }],
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

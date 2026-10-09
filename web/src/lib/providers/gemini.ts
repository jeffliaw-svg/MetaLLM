import { GoogleGenAI } from "@google/genai";
import { LENGTH_PRESETS, MODEL_MAP, type Length, type Speed } from "../config";
import type { ProviderResponse } from "./types";

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? "" });
  return _ai;
}

/** Gemini 3 models think by default and thinking tokens count against
 *  maxOutputTokens, so reserve headroom on top of the answer budget. */
const THINKING_HEADROOM = 4096;

export async function queryGemini(
  prompt: string,
  speed: Speed,
  length: Length,
  { webSearch = true, systemOverride }: { webSearch?: boolean; systemOverride?: string } = {}
): Promise<ProviderResponse> {
  const modelName = MODEL_MAP.gemini[speed];
  const preset = LENGTH_PRESETS[length];
  const baseTokens = webSearch
    ? Math.max(preset.maxTokens, 4096)
    : preset.maxTokens;
  const maxOutputTokens = baseTokens + THINKING_HEADROOM;

  const systemInstruction = systemOverride
    ? systemOverride
    : webSearch
      ? `${preset.systemInstruction}\n\nYou have access to Google Search. ALWAYS use it to find current, up-to-date information before answering. Do not rely on your training data for facts that may have changed.`
      : preset.systemInstruction;

  const t0 = performance.now();
  const result = await getAI().models.generateContent({
    model: modelName,
    contents: webSearch
      ? `Search the web for current information, then answer this query:\n\n${prompt}`
      : prompt,
    config: {
      maxOutputTokens,
      systemInstruction,
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

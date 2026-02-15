import { GoogleGenerativeAI } from "@google/generative-ai";
import { LENGTH_PRESETS, MODEL_MAP, type Length, type Speed } from "../config";
import type { ProviderResponse } from "./types";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY ?? "");

export async function queryGemini(
  prompt: string,
  speed: Speed,
  length: Length
): Promise<ProviderResponse> {
  const modelName = MODEL_MAP.gemini[speed];
  const preset = LENGTH_PRESETS[length];

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: preset.systemInstruction,
    generationConfig: { maxOutputTokens: preset.maxTokens },
  });

  const t0 = performance.now();
  const result = await model.generateContent(prompt);
  const latency = (performance.now() - t0) / 1000;

  const response = result.response;
  const text = response.text();
  const usage = response.usageMetadata;

  return {
    engine: "gemini",
    model: modelName,
    text,
    latencySeconds: Math.round(latency * 100) / 100,
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
  };
}

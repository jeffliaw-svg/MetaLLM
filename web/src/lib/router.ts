/** Router — a cheap model picks speed and length for a prompt. */

import type { Length, Speed } from "./config";
import { extractJson } from "./arbiter";
import { getQueryFn } from "./providers";

export interface RouteDecision {
  speed: Speed;
  length: Length;
  reason: string;
}

const SPEEDS: Speed[] = ["fast", "moderate", "research"];
const LENGTHS: Length[] = ["brief", "moderate", "detailed", "research"];
export const DEFAULT_ROUTE: RouteDecision = { speed: "moderate", length: "moderate", reason: "Default settings." };

const ROUTER_SYSTEM = `You route questions to AI models. Pick the cheapest settings that will still answer the question well.

speed: "fast" (simple facts, definitions, quick lookups), "moderate" (most questions, explanations, comparisons, advice), "research" (multi-step analysis, high-stakes decisions, complex technical or legal/medical/financial questions).
length: "brief" (1-2 sentences suffice), "moderate" (a few paragraphs), "detailed" (needs examples/structure), "research" (comprehensive report).

Return ONLY JSON: {"speed": "...", "length": "...", "reason": "<max 12 words, plain English>"}`;

export async function routePrompt(prompt: string): Promise<RouteDecision> {
  try {
    const reply = await getQueryFn("gemini")(prompt.slice(0, 4000), "fast", "brief", {
      webSearch: false,
      systemOverride: ROUTER_SYSTEM,
    });
    const data = extractJson(reply.text) as Record<string, string>;
    const speed = SPEEDS.includes(data.speed as Speed) ? (data.speed as Speed) : DEFAULT_ROUTE.speed;
    const length = LENGTHS.includes(data.length as Length) ? (data.length as Length) : DEFAULT_ROUTE.length;
    return { speed, length, reason: String(data.reason ?? "").slice(0, 120) };
  } catch (err) {
    console.error("Routing failed, using defaults:", err);
    return DEFAULT_ROUTE;
  }
}

/** Configuration: depth routing, speed/length presets, model mappings. */

export type Speed = "fast" | "moderate" | "research";
export type Length = "brief" | "moderate" | "detailed" | "research";
export type Engine = "claude" | "gemini" | "chatgpt" | "perplexity";

/**
 * How much effort a captured thought deserves. Triage assigns this.
 *
 * This is the main cost and latency lever: most captured thoughts are
 * "quick" and should come back in seconds from a single fast engine,
 * rather than queueing behind a four-engine research run.
 */
export type Depth = "quick" | "standard" | "research";

export interface LengthPreset {
  maxTokens: number;
  systemInstruction: string;
}

export interface DepthPreset {
  speed: Speed;
  length: Length;
  engines: Engine[];
  arbiter: Engine;
  /** Skip arbitration entirely when only one engine runs. */
  arbitrate: boolean;
}

export const MODEL_MAP: Record<Engine, Record<Speed, string>> = {
  claude: {
    fast: "claude-haiku-4-5-20251001",
    moderate: "claude-sonnet-4-5-20250929",
    research: "claude-opus-4-6",
  },
  gemini: {
    fast: "gemini-2.0-flash",
    moderate: "gemini-2.5-pro",
    research: "gemini-2.5-pro",
  },
  chatgpt: {
    fast: "gpt-4o-mini",
    moderate: "gpt-4o",
    research: "o3",
  },
  perplexity: {
    fast: "sonar",
    moderate: "sonar-pro",
    research: "sonar-reasoning-pro",
  },
};

export const LENGTH_PRESETS: Record<Length, LengthPreset> = {
  brief: {
    maxTokens: 200,
    systemInstruction: "Answer in 1-2 sentences. Be direct and concise.",
  },
  moderate: {
    maxTokens: 600,
    systemInstruction: "Provide a clear, concise answer in a few paragraphs.",
  },
  detailed: {
    maxTokens: 1500,
    systemInstruction:
      "Provide a thorough answer with examples and explanation.",
  },
  research: {
    maxTokens: 4000,
    systemInstruction:
      "Provide comprehensive analysis. Include evidence, multiple perspectives, and citations where possible.",
  },
};

export const DEPTH_PRESETS: Record<Depth, DepthPreset> = {
  // Factual lookups, quick recall, anything with one right answer.
  // Perplexity alone, because its search is always on and it is fast.
  quick: {
    speed: "fast",
    length: "brief",
    engines: ["perplexity"],
    arbiter: "claude",
    arbitrate: false,
  },

  // The default. Two engines with different failure modes, arbitrated.
  standard: {
    speed: "moderate",
    length: "moderate",
    engines: ["claude", "perplexity"],
    arbiter: "claude",
    arbitrate: true,
  },

  // Consequential, contested, or open-ended. Everything, at depth.
  research: {
    speed: "research",
    length: "research",
    engines: ["claude", "gemini", "chatgpt", "perplexity"],
    arbiter: "claude",
    arbitrate: true,
  },
};

export const ENGINES: Engine[] = ["claude", "gemini", "chatgpt", "perplexity"];

export const DEPTHS: Depth[] = ["quick", "standard", "research"];

export function isDepth(value: unknown): value is Depth {
  return typeof value === "string" && (DEPTHS as string[]).includes(value);
}

export function isEngine(value: unknown): value is Engine {
  return typeof value === "string" && (ENGINES as string[]).includes(value);
}

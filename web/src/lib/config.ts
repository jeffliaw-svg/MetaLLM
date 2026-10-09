/** Configuration: modes, speed/length presets, model mappings. */

export type Mode = "single" | "bakeoff";
export type Speed = "fast" | "moderate" | "research";
export type Length = "brief" | "moderate" | "detailed" | "research";
export type Engine = "claude" | "gemini" | "chatgpt" | "perplexity";

export interface LengthPreset {
  maxTokens: number;
  systemInstruction: string;
}

export const MODEL_MAP: Record<Engine, Record<Speed, string>> = {
  claude: {
    fast: "claude-haiku-4-5-20251001",
    moderate: "claude-sonnet-4-5-20250929",
    research: "claude-opus-4-6",
  },
  gemini: {
    fast: "gemini-3.1-flash-lite",
    moderate: "gemini-3.8-flash",
    research: "gemini-3.1-pro-preview",
  },
  chatgpt: {
    fast: "gpt-5-mini",
    moderate: "gpt-5.1",
    research: "gpt-5.2",
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

export const ENGINES: Engine[] = ["claude", "gemini", "chatgpt", "perplexity"];

export interface QueryRequest {
  prompt: string;
  mode: Mode;
  speed: Speed;
  length: Length;
  engine?: Engine;
  arbiter?: Engine;
}

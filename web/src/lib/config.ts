/** Configuration: modes, speed/length presets, model mappings. */

export type Mode = "single" | "bakeoff";
export type Speed = "fast" | "moderate" | "research";
export type Length = "brief" | "moderate" | "detailed" | "research";
export type Engine = "claude" | "gemini" | "chatgpt";

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
    fast: "gemini-2.0-flash",
    moderate: "gemini-2.5-pro",
    research: "gemini-2.5-pro",
  },
  chatgpt: {
    fast: "gpt-4o-mini",
    moderate: "gpt-4o",
    research: "o3",
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

export const ENGINES: Engine[] = ["claude", "gemini", "chatgpt"];

export interface QueryRequest {
  prompt: string;
  mode: Mode;
  speed: Speed;
  length: Length;
  engine?: Engine;
  arbiter?: Engine;
}

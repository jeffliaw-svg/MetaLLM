import type { Engine, Length, Speed } from "../config";
import { queryChatGPT } from "./chatgpt";
import { queryClaude } from "./claude";
import { queryGemini } from "./gemini";
import type { ProviderResponse } from "./types";

export type { ProviderResponse };

const QUERY_FNS: Record<
  Engine,
  (prompt: string, speed: Speed, length: Length) => Promise<ProviderResponse>
> = {
  claude: queryClaude,
  gemini: queryGemini,
  chatgpt: queryChatGPT,
};

export function getQueryFn(engine: Engine) {
  return QUERY_FNS[engine];
}

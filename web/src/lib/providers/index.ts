import type { Engine, Length, Speed } from "../config";
import { queryChatGPT } from "./chatgpt";
import { queryClaude } from "./claude";
import { queryGemini } from "./gemini";
import type { ProviderResponse } from "./types";

export type { ProviderResponse };

export type QueryOptions = { webSearch?: boolean };

type QueryFn = (
  prompt: string,
  speed: Speed,
  length: Length,
  options?: QueryOptions,
) => Promise<ProviderResponse>;

const QUERY_FNS: Record<Engine, QueryFn> = {
  claude: queryClaude,
  gemini: queryGemini,
  chatgpt: queryChatGPT,
};

export function getQueryFn(engine: Engine): QueryFn {
  return QUERY_FNS[engine];
}

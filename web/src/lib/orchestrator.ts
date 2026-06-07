/** Orchestrator — dispatches queries in single or bake-off mode. */

import { arbitrate, type ArbiterResult } from "./arbiter";
import { ENGINES, type Engine, type Length, type QueryRequest, type Speed } from "./config";
import { getQueryFn, type ProviderResponse } from "./providers";

export interface SingleResult {
  kind: "single";
  response: ProviderResponse;
}

export interface BakeoffResult {
  kind: "bakeoff";
  responses: ProviderResponse[];
  arbitration: ArbiterResult;
}

export type QueryResult = SingleResult | BakeoffResult;

export async function runQuery(req: QueryRequest): Promise<QueryResult> {
  if (req.mode === "single") {
    return runSingle(req.prompt, req.engine ?? "claude", req.speed, req.length);
  }
  return runBakeoff(
    req.prompt,
    req.speed,
    req.length,
    req.arbiter ?? "claude"
  );
}

async function runSingle(
  prompt: string,
  engine: Engine,
  speed: Speed,
  length: Length
): Promise<SingleResult> {
  const queryFn = getQueryFn(engine);
  const response = await queryFn(prompt, speed, length);
  return { kind: "single", response };
}

async function runBakeoff(
  prompt: string,
  speed: Speed,
  length: Length,
  arbiterEngine: Engine
): Promise<BakeoffResult> {
  // Fan out to all engines in parallel — tolerate individual failures.
  const settled = await Promise.allSettled(
    ENGINES.map((engine) => getQueryFn(engine)(prompt, speed, length))
  );

  const responses: ProviderResponse[] = [];
  const errors: string[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      responses.push(result.value);
    } else {
      errors.push(`${ENGINES[i]}: ${result.reason?.message ?? "unknown error"}`);
    }
  });

  if (responses.length < 2) {
    throw new Error(
      `Too few engines succeeded (${responses.length}/${ENGINES.length}). Failures: ${errors.join("; ")}`
    );
  }

  const arbitration = await arbitrate(prompt, responses, arbiterEngine);

  return { kind: "bakeoff", responses, arbitration };
}

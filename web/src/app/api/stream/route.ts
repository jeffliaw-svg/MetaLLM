import { arbitrate } from "@/lib/arbiter";
import { ENGINES, type Engine, type QueryRequest } from "@/lib/config";
import { getQueryFn } from "@/lib/providers";
import type { ProviderResponse } from "@/lib/providers";

export const maxDuration = 120;

/**
 * Streams newline-delimited JSON events:
 *   {type:"engine", response} | {type:"engine_error", engine, error}
 *   {type:"arbitrating"} | {type:"arbitration", arbitration, responses}
 *   {type:"error", error} | {type:"done"}
 */
export async function POST(request: Request) {
  const body: QueryRequest & { engines?: Engine[] } = await request.json();
  if (!body.prompt?.trim()) {
    return Response.json({ error: "Prompt is required." }, { status: 400 });
  }

  const engines =
    body.mode === "single"
      ? [body.engine ?? "claude"]
      : (body.engines?.filter((e) => ENGINES.includes(e)) ?? ENGINES);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      const responses: ProviderResponse[] = [];

      await Promise.all(
        engines.map(async (engine) => {
          try {
            const response = await getQueryFn(engine)(body.prompt, body.speed, body.length);
            responses.push(response);
            send({ type: "engine", response });
          } catch (err) {
            send({ type: "engine_error", engine, error: err instanceof Error ? err.message : "unknown error" });
          }
        })
      );

      if (body.mode !== "single") {
        if (responses.length < 2) {
          send({ type: "error", error: `Only ${responses.length} of ${engines.length} engines answered, so there's nothing to compare.` });
        } else {
          send({ type: "arbitrating" });
          try {
            const outcome = await arbitrate(body.prompt, responses, body.arbiter ?? "claude");
            send({ type: "arbitration", arbitration: outcome.arbitration, responses: outcome.responses });
          } catch (err) {
            send({ type: "error", error: err instanceof Error ? err.message : "Arbiter failed." });
          }
        }
      }
      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache, no-transform" },
  });
}

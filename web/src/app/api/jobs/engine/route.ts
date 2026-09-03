/**
 * Engine worker — runs exactly one engine for one thought.
 *
 * One engine per invocation is what keeps this inside the Vercel Hobby
 * duration limit. The last worker to finish claims the thought and enqueues
 * arbitration.
 */

import { NextResponse } from "next/server";
import { DEPTH_PRESETS, isEngine, type Engine } from "@/lib/config";
import { getQueryFn } from "@/lib/providers";
import { enqueue, verifyJobRequest } from "@/lib/queue";
import {
  claimForSynthesis,
  countResponses,
  getThought,
  recordResponse,
  setStatus,
} from "@/lib/thoughts";

export const maxDuration = 300;

export async function POST(req: Request) {
  const rawBody = await req.text();

  const verified = await verifyJobRequest(
    req.headers.get("upstash-signature"),
    rawBody
  );
  if (!verified) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let payload: { thoughtId?: string; engine?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { thoughtId } = payload;
  if (!thoughtId || !isEngine(payload.engine)) {
    return NextResponse.json(
      { error: "Requires 'thoughtId' and a valid 'engine'" },
      { status: 400 }
    );
  }
  const engine: Engine = payload.engine;

  const thought = await getThought(thoughtId);
  if (!thought) {
    // Return 200: the thought is gone, so retrying will never help.
    return NextResponse.json({ status: "skipped", reason: "not found" });
  }
  if (thought.status === "answered" || thought.status === "failed") {
    return NextResponse.json({ status: "skipped", reason: thought.status });
  }

  const preset = DEPTH_PRESETS[thought.depth];

  if (thought.status === "queued") {
    await setStatus(thoughtId, "running");
  }

  // Record the outcome either way. A failed engine still counts as reported,
  // otherwise a thought with one dead provider never reaches its expected
  // count and hangs forever.
  try {
    const response = await getQueryFn(engine)(
      thought.resolved_prompt,
      preset.speed,
      preset.length
    );

    await recordResponse({
      thoughtId,
      engine,
      model: response.model,
      text: response.text,
      status: "ok",
      latencySeconds: response.latencySeconds,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });
  } catch (err) {
    await recordResponse({
      thoughtId,
      engine,
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown provider error",
    });
  }

  const reported = await countResponses(thoughtId);
  if (reported < thought.engines_expected) {
    return NextResponse.json({
      status: "recorded",
      reported,
      expected: thought.engines_expected,
    });
  }

  // Every engine has reported. Exactly one worker wins this claim, so the
  // arbiter is enqueued once even though several workers may arrive here
  // at the same moment.
  const claimed = await claimForSynthesis(thoughtId);
  if (!claimed) {
    return NextResponse.json({ status: "recorded", synthesis: "claimed" });
  }

  await enqueue("/api/jobs/arbitrate", { thoughtId });

  return NextResponse.json({ status: "recorded", synthesis: "enqueued" });
}

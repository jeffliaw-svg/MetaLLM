/**
 * Arbiter worker — collapses the recorded engine responses into one answer.
 */

import { NextResponse } from "next/server";
import { arbitrate, passThrough } from "@/lib/arbiter";
import { DEPTH_PRESETS } from "@/lib/config";
import type { ProviderResponse } from "@/lib/providers";
import { verifyJobRequest } from "@/lib/queue";
import {
  getResponses,
  getThought,
  saveAnswer,
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

  let payload: { thoughtId?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { thoughtId } = payload;
  if (!thoughtId) {
    return NextResponse.json({ error: "Requires 'thoughtId'" }, { status: 400 });
  }

  const thought = await getThought(thoughtId);
  if (!thought) {
    return NextResponse.json({ status: "skipped", reason: "not found" });
  }
  if (thought.status === "answered") {
    return NextResponse.json({ status: "skipped", reason: "already answered" });
  }

  const rows = await getResponses(thoughtId);
  const succeeded: ProviderResponse[] = rows
    .filter((r) => r.status === "ok" && r.text)
    .map((r) => ({
      engine: r.engine,
      model: r.model ?? "",
      text: r.text ?? "",
      latencySeconds: Number(r.latency_seconds ?? 0),
      inputTokens: r.input_tokens ?? 0,
      outputTokens: r.output_tokens ?? 0,
    }));

  if (succeeded.length === 0) {
    const reasons = rows
      .filter((r) => r.status === "failed")
      .map((r) => `${r.engine}: ${r.error ?? "unknown"}`)
      .join("; ");

    await setStatus(
      thoughtId,
      "failed",
      `No engine returned an answer. ${reasons}`
    );
    return NextResponse.json({ status: "failed", reason: reasons });
  }

  const preset = DEPTH_PRESETS[thought.depth];

  // One response, or a depth that never wanted arbitration: the answer is
  // already the answer, so spending an arbiter call on it buys nothing.
  const shouldArbitrate = preset.arbitrate && succeeded.length > 1;

  try {
    const result = shouldArbitrate
      ? await arbitrate(
          thought.resolved_prompt,
          succeeded,
          thought.arbiter_engine ?? preset.arbiter
        )
      : passThrough(succeeded[0]);

    await saveAnswer(thoughtId, {
      synopsis: result.synopsis,
      synthesis: result.synthesis,
      disagreements: result.disagreements,
      bestEngine: result.bestEngine,
    });
  } catch (err) {
    // Arbitration blew up but we still hold good engine output. Ship that
    // rather than losing the work entirely.
    const fallback = succeeded.reduce((a, b) =>
      b.text.length > a.text.length ? b : a
    );
    const { deriveSynopsis } = await import("@/lib/arbiter");

    await saveAnswer(thoughtId, {
      synopsis: deriveSynopsis(fallback.text),
      synthesis: fallback.text,
      disagreements: [],
      bestEngine: fallback.engine,
    });

    return NextResponse.json({
      status: "answered",
      degraded: true,
      reason: err instanceof Error ? err.message : "arbitration failed",
    });
  }

  return NextResponse.json({ status: "answered", engines: succeeded.length });
}

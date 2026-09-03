/**
 * Capture — the endpoint the iOS Shortcut talks to.
 *
 * Must return fast. It triages, writes one row, enqueues the engine jobs and
 * returns; it never waits for an answer. The only case where it returns
 * without queueing is when triage decides one clarifying question would
 * materially change the answer, in which case the Shortcut asks it aloud and
 * posts again with the reply.
 */

import { NextResponse } from "next/server";
import { isAuthorisedCapture } from "@/lib/auth";
import { DEPTH_PRESETS } from "@/lib/config";
import { enqueueAll } from "@/lib/queue";
import { hasValidSession } from "@/lib/session";
import { createThought, setStatus, type ThoughtSource } from "@/lib/thoughts";
import { triage } from "@/lib/triage";

export const maxDuration = 30;

const SOURCES: ThoughtSource[] = ["siri", "sms", "web"];

export async function POST(req: Request) {
  // Two callers: the Shortcut with a bearer token, and the web composer
  // with an unlocked session cookie.
  const authorised =
    isAuthorisedCapture(req.headers.get("authorization")) || hasValidSession();

  if (!authorised) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: {
    text?: unknown;
    clarification?: unknown;
    source?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json(
      { error: "Missing 'text' in request body" },
      { status: 400 }
    );
  }

  const clarification =
    typeof body.clarification === "string" && body.clarification.trim()
      ? body.clarification.trim()
      : undefined;

  const source: ThoughtSource = SOURCES.includes(body.source as ThoughtSource)
    ? (body.source as ThoughtSource)
    : "siri";

  const result = await triage(text, clarification);

  // Ask now, while the user is still standing there with the Shortcut open.
  if (result.needsClarification && result.clarifyingQuestion) {
    return NextResponse.json({
      status: "needs_clarification",
      question: result.clarifyingQuestion,
      spoken: result.clarifyingQuestion,
    });
  }

  const preset = DEPTH_PRESETS[result.depth];

  const thought = await createThought({
    rawText: text,
    clarification: clarification ?? null,
    resolvedPrompt: result.resolvedPrompt,
    title: result.title,
    depth: result.depth,
    enginesExpected: result.engines.length,
    arbiterEngine: preset.arbitrate ? result.arbiter : null,
    source,
  });

  const { failures } = await enqueueAll(
    result.engines.map((engine) => ({
      path: "/api/jobs/engine" as const,
      body: { thoughtId: thought.id, engine },
    }))
  );

  // Nothing was queued, so nothing will ever run. Say so rather than leaving
  // a row that silently never completes.
  if (failures.length === result.engines.length) {
    await setStatus(
      thought.id,
      "failed",
      `Could not enqueue any engine job. ${failures.join("; ")}`
    );

    return NextResponse.json(
      {
        status: "failed",
        id: thought.id,
        error: "Could not queue the work.",
        spoken: "I couldn't start on that one. Try again in a moment.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    status: "queued",
    id: thought.id,
    title: result.title,
    depth: result.depth,
    engines: result.engines,
    spoken: confirmation(result.depth),
  });
}

/** What Siri says back. Sets an expectation about when to look. */
function confirmation(depth: string): string {
  switch (depth) {
    case "quick":
      return "Got it. That'll be ready in a few seconds.";
    case "research":
      return "Got it. I'll dig into that one properly and have it shortly.";
    default:
      return "Got it. I'll have an answer for you in a minute or two.";
  }
}

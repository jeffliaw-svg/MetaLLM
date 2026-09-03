import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/session";
import { listThoughts } from "@/lib/thoughts";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  const thoughts = await listThoughts();

  // The list view never renders full synthesis, so don't ship it.
  return NextResponse.json({
    thoughts: thoughts.map((t) => ({
      id: t.id,
      title: t.title,
      raw_text: t.raw_text,
      depth: t.depth,
      status: t.status,
      synopsis: t.synopsis,
      best_engine: t.best_engine,
      has_disagreements: (t.disagreements?.length ?? 0) > 0,
      created_at: t.created_at,
      answered_at: t.answered_at,
    })),
  });
}

import { NextResponse } from "next/server";
import type { QueryRequest } from "@/lib/config";
import { runQuery } from "@/lib/orchestrator";

export const maxDuration = 120; // Vercel serverless timeout (seconds)

export async function POST(request: Request) {
  try {
    const body: QueryRequest = await request.json();

    if (!body.prompt?.trim()) {
      return NextResponse.json(
        { error: "Prompt is required." },
        { status: 400 }
      );
    }

    const result = await runQuery(body);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    console.error("Query error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

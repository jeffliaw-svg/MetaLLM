import { NextResponse } from "next/server";
import { saveSearch } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const { prompt, mode, speed, length, engine, arbiter, result, thread } = await request.json();

    if (!prompt || (!result && !Array.isArray(thread))) {
      return NextResponse.json(
        { error: "prompt and result or thread are required." },
        { status: 400 }
      );
    }

    const id = await saveSearch({
      prompt,
      mode,
      speed,
      length,
      engine: engine ?? null,
      arbiter: arbiter ?? null,
      result: result ?? null,
      ...(Array.isArray(thread) ? { thread } : {}),
    });

    return NextResponse.json({ id });
  } catch (err: unknown) {
    console.error("Save search error:", err);
    return NextResponse.json({ error: "Failed to save search." }, { status: 500 });
  }
}

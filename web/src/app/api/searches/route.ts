import { NextResponse } from "next/server";
import { saveSearch } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const { prompt, mode, speed, length, engine, arbiter, result } = await request.json();

    if (!prompt || !result) {
      return NextResponse.json(
        { error: "prompt and result are required." },
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
      result,
    });

    return NextResponse.json({ id });
  } catch (err: unknown) {
    console.error("Save search error:", err);
    return NextResponse.json({ error: "Failed to save search." }, { status: 500 });
  }
}

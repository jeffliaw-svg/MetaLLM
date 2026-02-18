import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { prompt, mode, speed, length, engine, arbiter, result } = body;

    if (!prompt || !result) {
      return NextResponse.json(
        { error: "prompt and result are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("searches")
      .insert({
        prompt,
        mode,
        speed,
        length,
        engine: engine ?? null,
        arbiter: arbiter ?? null,
        result,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Failed to save search." },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: data.id });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    console.error("Save search error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { routePrompt } from "@/lib/router";

export const maxDuration = 30;

export async function POST(request: Request) {
  const { prompt } = await request.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }
  return NextResponse.json(await routePrompt(prompt));
}

import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/session";
import { getResponses, getThought } from "@/lib/thoughts";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  const thought = await getThought(params.id);
  if (!thought) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const responses = await getResponses(params.id);

  return NextResponse.json({ thought, responses });
}

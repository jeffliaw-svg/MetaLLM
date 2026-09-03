import { NextResponse } from "next/server";
import { appUrl } from "@/lib/queue";
import { hasValidSession } from "@/lib/session";
import { ensureShareToken } from "@/lib/thoughts";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!hasValidSession()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  const token = await ensureShareToken(params.id);

  return NextResponse.json({ token, url: `${appUrl()}/s/${token}` });
}

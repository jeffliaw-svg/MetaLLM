import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  checkSecret,
} from "@/lib/session";

export async function POST(req: Request) {
  let body: { secret?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const secret = typeof body.secret === "string" ? body.secret : "";
  const token = checkSecret(secret);

  if (!token) {
    return NextResponse.json({ error: "Incorrect key" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return response;
}

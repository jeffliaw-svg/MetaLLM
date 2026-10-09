import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, accessCode, accessToken, hasAccess } from "@/lib/access";

export async function GET() {
  return NextResponse.json({ unlocked: await hasAccess(cookies().get(ACCESS_COOKIE)?.value) });
}

export async function POST(request: Request) {
  const { code } = await request.json().catch(() => ({ code: "" }));
  const expected = accessCode();
  if (expected && (await accessToken(String(code ?? ""))) !== (await accessToken(expected))) {
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "Wrong code." }, { status: 401 });
  }
  const res = NextResponse.json({ unlocked: true });
  if (expected) {
    res.cookies.set(ACCESS_COOKIE, await accessToken(expected), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}

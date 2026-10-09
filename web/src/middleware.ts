import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, hasAccess } from "@/lib/access";

export async function middleware(request: NextRequest) {
  if (await hasAccess(request.cookies.get(ACCESS_COOKIE)?.value)) return NextResponse.next();
  return NextResponse.json({ error: "Enter the access code to ask questions." }, { status: 401 });
}

// Asking questions and saving shares need the code; reading shared links does not.
export const config = {
  matcher: ["/api/stream", "/api/route", "/api/query", "/api/chat", "/api/searches"],
};

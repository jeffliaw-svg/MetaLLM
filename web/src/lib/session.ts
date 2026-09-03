/**
 * Minimal session gate for the web UI.
 *
 * The app is single-user with no login, but it is on the public internet and
 * it holds a personal question history. One shared secret, entered once,
 * exchanged for an httpOnly cookie.
 *
 * This is not a general auth system and should be replaced the moment a
 * second person needs an account.
 */

import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "ml_session";
const SESSION_DAYS = 90;

/** Derive the cookie value so the raw secret is never stored client-side. */
function deriveToken(secret: string): string {
  return createHash("sha256").update(`metallm:v1:${secret}`).digest("hex");
}

export function expectedToken(): string | null {
  const secret = process.env.CAPTURE_SECRET;
  return secret ? deriveToken(secret) : null;
}

export function checkSecret(candidate: string): string | null {
  const secret = process.env.CAPTURE_SECRET;
  if (!secret) return null;

  const a = Buffer.from(candidate);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  return deriveToken(secret);
}

export function hasValidSession(): boolean {
  const expected = expectedToken();
  if (!expected) return false;

  const present = cookies().get(SESSION_COOKIE)?.value;
  if (!present) return false;

  const a = Buffer.from(present);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};

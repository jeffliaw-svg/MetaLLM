/**
 * Authorisation for the capture endpoint.
 *
 * The app is single-user, so there is no login. The iOS Shortcut carries a
 * bearer token and that is the whole authorisation model. Job routes are
 * protected separately by QStash signature verification.
 */

import { timingSafeEqual } from "crypto";

export function isAuthorisedCapture(header: string | null): boolean {
  const secret = process.env.CAPTURE_SECRET;

  // Refuse rather than fall open. An unset secret in production would
  // otherwise leave an endpoint that spends API credits wide open.
  if (!secret) return false;
  if (!header) return false;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return false;

  return constantTimeEquals(match[1], secret);
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

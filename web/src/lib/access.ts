export const ACCESS_COOKIE = "metallm_access";

/** Access is open when no ACCESS_CODE is configured. */
export function accessCode(): string | undefined {
  return process.env.ACCESS_CODE?.trim() || undefined;
}

/** Cookie token for a code; changing ACCESS_CODE invalidates old cookies. */
export async function accessToken(code: string): Promise<string> {
  const data = new TextEncoder().encode(`metallm:${code.trim().toLowerCase()}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hasAccess(cookie: string | undefined): Promise<boolean> {
  const code = accessCode();
  if (!code) return true;
  return !!cookie && cookie === (await accessToken(code));
}

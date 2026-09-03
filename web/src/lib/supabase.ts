import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _anon: SupabaseClient | null = null;
let _service: SupabaseClient | null = null;

/**
 * Anonymous client. Subject to RLS, which denies almost everything.
 * Only useful for reading rows that have been explicitly shared.
 */
export function getSupabase(): SupabaseClient {
  if (_anon) return _anon;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  _anon = createClient(url, key);
  return _anon;
}

/**
 * Service-role client. Bypasses RLS entirely — server-side only.
 *
 * Never import this into a client component. Every route handler in this app
 * uses it, because the app is single-user and authorisation happens at the
 * route boundary via CAPTURE_SECRET or a QStash signature.
 */
export function getServiceSupabase(): SupabaseClient {
  if (_service) return _service;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  _service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _service;
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  _client = createClient(url, key);
  return _client;
}

/**
 * SQL to create the searches table in Supabase:
 *
 * CREATE TABLE searches (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   prompt TEXT NOT NULL,
 *   mode TEXT NOT NULL,
 *   speed TEXT NOT NULL,
 *   length TEXT NOT NULL,
 *   engine TEXT,
 *   arbiter TEXT,
 *   result JSONB NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 *
 * -- Enable public read/insert access (anonymous sharing)
 * ALTER TABLE searches ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Anyone can read searches" ON searches FOR SELECT USING (true);
 * CREATE POLICY "Anyone can insert searches" ON searches FOR INSERT WITH CHECK (true);
 */

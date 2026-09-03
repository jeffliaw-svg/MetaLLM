/** Data layer over thoughts, thought_responses and deliveries. */

import { randomBytes } from "crypto";
import type { Depth, Engine } from "./config";
import type { Disagreement } from "./arbiter";
import { getServiceSupabase } from "./supabase";

export type ThoughtStatus =
  | "queued"
  | "running"
  | "synthesizing"
  | "answered"
  | "failed";

export type ThoughtSource = "siri" | "sms" | "web";

export interface Thought {
  id: string;
  raw_text: string;
  clarification: string | null;
  resolved_prompt: string;
  title: string | null;
  depth: Depth;
  engines_expected: number;
  arbiter_engine: Engine | null;
  status: ThoughtStatus;
  source: ThoughtSource;
  error: string | null;
  synopsis: string | null;
  synthesis: string | null;
  disagreements: Disagreement[] | null;
  best_engine: Engine | null;
  audio_url: string | null;
  share_token: string | null;
  created_at: string;
  answered_at: string | null;
}

export interface ThoughtResponse {
  id: string;
  thought_id: string;
  engine: Engine;
  model: string | null;
  text: string | null;
  status: "ok" | "failed";
  error: string | null;
  latency_seconds: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

/* ── Create ──────────────────────────────────────────────────────────── */

export interface CreateThoughtInput {
  rawText: string;
  clarification?: string | null;
  resolvedPrompt: string;
  title: string;
  depth: Depth;
  enginesExpected: number;
  arbiterEngine: Engine | null;
  source: ThoughtSource;
}

export async function createThought(
  input: CreateThoughtInput
): Promise<Thought> {
  const { data, error } = await getServiceSupabase()
    .from("thoughts")
    .insert({
      raw_text: input.rawText,
      clarification: input.clarification ?? null,
      resolved_prompt: input.resolvedPrompt,
      title: input.title,
      depth: input.depth,
      engines_expected: input.enginesExpected,
      arbiter_engine: input.arbiterEngine,
      source: input.source,
      status: "queued",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create thought: ${error.message}`);
  return data as Thought;
}

/* ── Read ────────────────────────────────────────────────────────────── */

export async function getThought(id: string): Promise<Thought | null> {
  const { data, error } = await getServiceSupabase()
    .from("thoughts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load thought: ${error.message}`);
  return (data as Thought) ?? null;
}

export async function getThoughtByShareToken(
  token: string
): Promise<Thought | null> {
  const { data, error } = await getServiceSupabase()
    .from("thoughts")
    .select("*")
    .eq("share_token", token)
    .maybeSingle();

  if (error) throw new Error(`Failed to load shared thought: ${error.message}`);
  return (data as Thought) ?? null;
}

export async function listThoughts(limit = 100): Promise<Thought[]> {
  const { data, error } = await getServiceSupabase()
    .from("thoughts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list thoughts: ${error.message}`);
  return (data ?? []) as Thought[];
}

export async function getResponses(
  thoughtId: string
): Promise<ThoughtResponse[]> {
  const { data, error } = await getServiceSupabase()
    .from("thought_responses")
    .select("*")
    .eq("thought_id", thoughtId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load responses: ${error.message}`);
  return (data ?? []) as ThoughtResponse[];
}

/* ── Write ───────────────────────────────────────────────────────────── */

export interface RecordResponseInput {
  thoughtId: string;
  engine: Engine;
  model?: string;
  text?: string;
  status: "ok" | "failed";
  error?: string;
  latencySeconds?: number;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Idempotent. QStash retries on any non-2xx, so a worker that completed its
 * engine call but failed afterwards must not produce a second row. The unique
 * constraint on (thought_id, engine) makes the upsert a no-op in that case.
 */
export async function recordResponse(
  input: RecordResponseInput
): Promise<void> {
  const { error } = await getServiceSupabase()
    .from("thought_responses")
    .upsert(
      {
        thought_id: input.thoughtId,
        engine: input.engine,
        model: input.model ?? null,
        text: input.text ?? null,
        status: input.status,
        error: input.error ?? null,
        latency_seconds: input.latencySeconds ?? null,
        input_tokens: input.inputTokens ?? null,
        output_tokens: input.outputTokens ?? null,
      },
      { onConflict: "thought_id,engine", ignoreDuplicates: true }
    );

  if (error) throw new Error(`Failed to record response: ${error.message}`);
}

/** How many engines have reported, successfully or not. */
export async function countResponses(thoughtId: string): Promise<number> {
  const { count, error } = await getServiceSupabase()
    .from("thought_responses")
    .select("*", { count: "exact", head: true })
    .eq("thought_id", thoughtId);

  if (error) throw new Error(`Failed to count responses: ${error.message}`);
  return count ?? 0;
}

export async function setStatus(
  id: string,
  status: ThoughtStatus,
  error?: string
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (error !== undefined) patch.error = error;

  const { error: dbError } = await getServiceSupabase()
    .from("thoughts")
    .update(patch)
    .eq("id", id);

  if (dbError) throw new Error(`Failed to set status: ${dbError.message}`);
}

/**
 * Move a thought to 'synthesizing', but only from 'queued' or 'running'.
 *
 * This is the concurrency guard. Engine workers finish in an arbitrary order
 * and two can observe "all responses in" simultaneously; the conditional
 * update means exactly one of them wins and enqueues the arbiter.
 */
export async function claimForSynthesis(id: string): Promise<boolean> {
  const { data, error } = await getServiceSupabase()
    .from("thoughts")
    .update({ status: "synthesizing" })
    .eq("id", id)
    .in("status", ["queued", "running"])
    .select("id");

  if (error) throw new Error(`Failed to claim thought: ${error.message}`);
  return (data ?? []).length > 0;
}

export interface AnswerInput {
  synopsis: string;
  synthesis: string;
  disagreements?: Disagreement[];
  bestEngine?: Engine | null;
}

export async function saveAnswer(
  id: string,
  answer: AnswerInput
): Promise<void> {
  const { error } = await getServiceSupabase()
    .from("thoughts")
    .update({
      synopsis: answer.synopsis,
      synthesis: answer.synthesis,
      disagreements: answer.disagreements ?? null,
      best_engine: answer.bestEngine ?? null,
      status: "answered",
      answered_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(`Failed to save answer: ${error.message}`);
}

/** Mint a share token on first share; reuse it thereafter. */
export async function ensureShareToken(id: string): Promise<string> {
  const existing = await getThought(id);
  if (!existing) throw new Error("Thought not found");
  if (existing.share_token) return existing.share_token;

  const token = randomBytes(16).toString("base64url");

  const { error } = await getServiceSupabase()
    .from("thoughts")
    .update({ share_token: token })
    .eq("id", id);

  if (error) throw new Error(`Failed to create share token: ${error.message}`);
  return token;
}

/**
 * Durable job queue on Upstash QStash.
 *
 * Every engine call is its own QStash message and therefore its own function
 * invocation. That keeps each invocation short enough for the Vercel Hobby
 * duration limit no matter how slow a single engine is, and gives us retries
 * for free.
 *
 * Without QSTASH_TOKEN configured, jobs are dispatched as fire-and-forget
 * HTTP requests instead. That makes local development work with no external
 * dependency, but has no retries or durability, so it is not for production.
 */

import { Client, Receiver } from "@upstash/qstash";

let _client: Client | null = null;
let _receiver: Receiver | null = null;

function getClient(): Client | null {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return null;
  if (!_client) _client = new Client({ token });
  return _client;
}

function getReceiver(): Receiver | null {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!current || !next) return null;
  if (!_receiver) {
    _receiver = new Receiver({
      currentSigningKey: current,
      nextSigningKey: next,
    });
  }
  return _receiver;
}

export function appUrl(): string {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

export type JobPath =
  | "/api/jobs/engine"
  | "/api/jobs/arbitrate"
  | "/api/jobs/deliver";

export interface EnqueueOptions {
  /** Seconds to wait before delivery. */
  delay?: number;
  retries?: number;
}

/**
 * Enqueue a job. Resolves once the job is accepted by QStash, not once it
 * runs — callers must not await the work itself.
 */
export async function enqueue(
  path: JobPath,
  body: unknown,
  options: EnqueueOptions = {}
): Promise<void> {
  const client = getClient();
  const url = `${appUrl()}${path}`;

  if (!client) {
    await dispatchDirect(url, body);
    return;
  }

  await client.publishJSON({
    url,
    body,
    retries: options.retries ?? 3,
    ...(options.delay ? { delay: options.delay } : {}),
  });
}

/** Enqueue several jobs concurrently, tolerating individual failures. */
export async function enqueueAll(
  jobs: { path: JobPath; body: unknown; options?: EnqueueOptions }[]
): Promise<{ enqueued: number; failures: string[] }> {
  const settled = await Promise.allSettled(
    jobs.map((j) => enqueue(j.path, j.body, j.options))
  );

  const failures: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === "rejected") {
      failures.push(
        `${jobs[i].path}: ${r.reason?.message ?? "unknown enqueue error"}`
      );
    }
  });

  return { enqueued: settled.length - failures.length, failures };
}

/**
 * Verify that a request genuinely came from QStash.
 *
 * Returns true when no signing keys are configured, which is the local
 * development path. In any deployed environment the keys must be set or these
 * routes are open to the internet.
 */
export async function verifyJobRequest(
  signature: string | null,
  rawBody: string
): Promise<boolean> {
  const receiver = getReceiver();
  if (!receiver) return true;
  if (!signature) return false;

  try {
    return await receiver.verify({ signature, body: rawBody });
  } catch {
    return false;
  }
}

/**
 * Local-development fallback: kick the job endpoint and do not wait for it.
 *
 * The abort is deliberate. We only need the request to reach the server; the
 * handler runs to completion independently of whether we read the response.
 */
async function dispatchDirect(url: string, body: unknown): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 250);

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    // Aborting is the expected outcome, not an error.
  } finally {
    clearTimeout(timer);
  }
}

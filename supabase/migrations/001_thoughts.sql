-- MetaLLM — voice-first async question capture.
--
-- Replaces the old public `searches` table, which had no ownership and
-- world-readable / world-writable RLS policies.

-- ── Enums ────────────────────────────────────────────────────────────────

do $$ begin
  create type thought_status as enum (
    'queued',        -- accepted, engines not started
    'running',       -- at least one engine in flight
    'synthesizing',  -- all engines done, arbiter running
    'answered',      -- synopsis + synthesis available
    'failed'         -- too few engines succeeded
  );
exception when duplicate_object then null;
end $$;

-- ── thoughts ─────────────────────────────────────────────────────────────

create table if not exists thoughts (
  id                uuid primary key default gen_random_uuid(),

  -- What was captured
  raw_text          text not null,          -- exactly what was dictated
  clarification     text,                   -- the follow-up answer, if asked
  resolved_prompt   text not null,          -- what actually goes to the engines
  title             text,                   -- short label for the thread list

  -- Routing
  depth             text not null,          -- quick | standard | research
  engines_expected  int  not null,
  arbiter_engine    text,

  -- Lifecycle
  status            thought_status not null default 'queued',
  source            text not null default 'siri',   -- siri | sms | web
  error             text,

  -- The answer
  synopsis          text,                   -- 2-3 sentences, SMS body + TTS input
  synthesis         text,                   -- full markdown answer
  disagreements     jsonb,                  -- only populated on genuine conflict
  best_engine       text,
  audio_url         text,                   -- lazily generated on first play

  -- Sharing: null until explicitly shared, then unguessable
  share_token       text unique,

  created_at        timestamptz not null default now(),
  answered_at       timestamptz
);

-- ── thought_responses ────────────────────────────────────────────────────

create table if not exists thought_responses (
  id               uuid primary key default gen_random_uuid(),
  thought_id       uuid not null references thoughts(id) on delete cascade,
  engine           text not null,
  model            text,
  text             text,
  status           text not null,           -- ok | failed
  error            text,
  latency_seconds  numeric,
  input_tokens     int,
  output_tokens    int,
  created_at       timestamptz not null default now(),

  -- Makes engine workers idempotent. QStash retries on any non-2xx, so a
  -- worker that succeeded but timed out on the response must not double-insert.
  unique (thought_id, engine)
);

-- ── deliveries ───────────────────────────────────────────────────────────

create table if not exists deliveries (
  id          uuid primary key default gen_random_uuid(),
  thought_id  uuid not null references thoughts(id) on delete cascade,
  channel     text not null,                -- sms | email | push
  status      text not null,                -- sent | failed | skipped
  error       text,
  sent_at     timestamptz not null default now(),

  unique (thought_id, channel)
);

-- ── Indexes ──────────────────────────────────────────────────────────────

create index if not exists thoughts_created_at_idx
  on thoughts (created_at desc);

create index if not exists thoughts_status_idx
  on thoughts (status)
  where status <> 'answered';

create index if not exists thought_responses_thought_idx
  on thought_responses (thought_id);

-- ── Row Level Security ───────────────────────────────────────────────────
--
-- Everything is denied to anon and authenticated. All application access
-- goes through Next.js route handlers using the service role key, which
-- bypasses RLS. The only exception is the public share view below.

alter table thoughts          enable row level security;
alter table thought_responses enable row level security;
alter table deliveries        enable row level security;

-- Deliberately no permissive policies on thought_responses or deliveries.

drop policy if exists "shared thoughts are readable" on thoughts;
create policy "shared thoughts are readable"
  on thoughts
  for select
  using (share_token is not null);

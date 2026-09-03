# MetaLLM

Capture a question the moment it occurs. Answers find you later.

Speak a thought into Siri and forget about it. Several AI engines work it in
the background, an arbiter collapses their answers into one, and the result is
waiting when you next look. The multi-engine bake-off is a quality mechanism,
not something you have to read.

---

## How it works

```
Siri ──► /api/capture
           │  triage on Haiku decides depth, and whether one clarifying
           │  question would materially change the answer
           │
           ├─ needs clarification? Siri asks it aloud, you answer, it re-posts
           │
           └─ otherwise: write one row, enqueue one job per engine, return

QStash ──► /api/jobs/engine      one engine per invocation
QStash ──► /api/jobs/arbitrate   synopsis + synthesis + real disagreements
```

Nothing runs inside a web request, so nothing can time out on you and there is
no spinner to sit through.

### Depth routing

Triage assigns each thought a depth, which is the main cost and latency lever.

| Depth | Engines | For |
|---|---|---|
| `quick` | Perplexity | Factual lookups with one right answer |
| `standard` | Claude + Perplexity | Explanation and judgement |
| `research` | All four | Consequential, contested, open-ended |

A quick thought comes back in seconds instead of queueing behind a deep one.

---

## Setup

### 1. Supabase

Create a project and run `supabase/migrations/001_thoughts.sql` in the SQL
editor. It creates `thoughts`, `thought_responses` and `deliveries`, and locks
all three down with row level security — every application read and write goes
through a route handler using the service role key.

### 2. Environment

Copy `web/.env.example` to `web/.env.local` and fill it in. Generate the
access key with:

```bash
openssl rand -base64 32
```

That one value is both the Shortcut's bearer token and the web UI's access key.

### 3. QStash

Create an Upstash account and copy the token plus both signing keys into your
environment. The free tier covers 500 messages a day, which is well beyond
this workload.

Locally you can leave `QSTASH_TOKEN` unset. Jobs then dispatch as direct
fire-and-forget HTTP calls, which works for development but has no retries.

### 4. Run

```bash
cd web
npm install
npm run dev
```

---

## The iOS Shortcut

Build this once in the Shortcuts app. Name it **Ask Meta**, which makes the
trigger phrase "Hey Siri, ask Meta".

1. **Dictate Text** — set *Stop Listening* to *After Pause*.
2. **Get Contents of URL**
   - URL: `https://YOUR-APP.vercel.app/api/capture`
   - Method: `POST`
   - Headers: `Authorization` → `Bearer YOUR_CAPTURE_SECRET`
   - Request Body: `JSON`
     - `text` → Dictated Text
     - `source` → `siri`
3. **Get Dictionary Value** — key `status`.
4. **If** it equals `needs_clarification`:
   - **Speak Text** — the `question` value from the response
   - **Dictate Text** again
   - **Get Contents of URL** again, same headers, with `text` → the original
     Dictated Text and `clarification` → the new Dictated Text
5. **Otherwise / afterwards**: **Speak Text** with the `spoken` value.

Add it to your Home Screen and Apple Watch. It works from AirPods and CarPlay
with the phone locked, which is the entire point.

---

## Repository layout

```
supabase/migrations/     schema
web/src/lib/
  config.ts              depth presets, model map, length presets
  triage.ts              Haiku classifier
  queue.ts               QStash publish + signature verification
  thoughts.ts            data layer
  arbiter.ts             synopsis + synthesis + disagreements
  providers/             four engine integrations with web search
web/src/app/
  api/capture/           the Shortcut endpoint
  api/jobs/              queue workers
  page.tsx               thread list
  t/[id]/                thread detail
  s/[token]/             public share view
```

---

## Not built yet

SMS, email and push delivery. Spoken synopsis. The daily digest. Search across
the archive. Follow-up threading. See the phasing section of the plan.

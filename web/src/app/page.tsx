"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Lock } from "@/components/Icons";
import {
  DEPTH_LABEL,
  clockTime,
  groupByDay,
  isInFlight,
  statusLabel,
} from "@/lib/format";

interface ThoughtRow {
  id: string;
  title: string | null;
  raw_text: string;
  depth: string;
  status: string;
  synopsis: string | null;
  best_engine: string | null;
  has_disagreements: boolean;
  created_at: string;
  answered_at: string | null;
}

const POLL_MS = 4000;

export default function Home() {
  const [locked, setLocked] = useState<boolean | null>(null);
  const [thoughts, setThoughts] = useState<ThoughtRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/thoughts", { cache: "no-store" });

    if (res.status === 401) {
      setLocked(true);
      setLoaded(true);
      return;
    }

    const data = await res.json();
    setLocked(false);
    setThoughts(data.thoughts ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll only while something is actually in flight.
  const anyPending = thoughts.some((t) => isInFlight(t.status));

  useEffect(() => {
    if (locked || !anyPending) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [locked, anyPending, load]);

  if (locked === null || !loaded) {
    return <div className="center-stage" />;
  }

  if (locked) {
    return <UnlockScreen onUnlocked={load} />;
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="wordmark">MetaLLM</span>
          <span className="faint" style={{ fontSize: 13, marginLeft: "auto" }}>
            {thoughts.length > 0
              ? `${thoughts.length} thought${thoughts.length === 1 ? "" : "s"}`
              : null}
          </span>
        </div>
      </header>

      <main className="shell" style={{ paddingBottom: 96 }}>
        <div style={{ paddingTop: 28 }}>
          <Composer onCaptured={load} />
        </div>

        {thoughts.length === 0 ? (
          <EmptyState />
        ) : (
          groupByDay(thoughts).map((group) => (
            <section key={group.day}>
              <h2 className="day-heading">{group.day}</h2>
              {group.items.map((t) => (
                <ThreadRow key={t.id} thought={t} />
              ))}
            </section>
          ))
        )}
      </main>
    </>
  );
}

/* ── Composer ────────────────────────────────────────────────────────── */

function Composer({ onCaptured }: { onCaptured: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [clarifying, setClarifying] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  function autoGrow() {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }

  async function submit(clarification?: string) {
    const body = text.trim();
    if (!body || busy) return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body, clarification, source: "web" }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Couldn't capture that.");

      if (data.status === "needs_clarification") {
        setClarifying(data.question);
        return;
      }

      setText("");
      setReply("");
      setClarifying(null);
      if (areaRef.current) areaRef.current.style.height = "auto";
      onCaptured();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (clarifying) {
    return (
      <div className="composer rise" style={{ padding: "18px 20px 16px" }}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>
          One quick thing
        </p>
        <p style={{ margin: "0 0 14px", fontSize: 16 }}>{clarifying}</p>
        <input
          className="field"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && reply.trim()) submit(reply.trim());
          }}
          placeholder="Your answer"
          autoFocus
        />
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 12,
          }}
        >
          <button
            className="btn btn-ghost"
            onClick={() => submit()}
            disabled={busy}
          >
            Skip
          </button>
          <button
            className="btn btn-primary"
            onClick={() => submit(reply.trim())}
            disabled={busy || !reply.trim()}
          >
            {busy ? <span className="spinner" /> : null}
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="composer">
        <textarea
          ref={areaRef}
          value={text}
          rows={1}
          placeholder="What's on your mind?"
          onChange={(e) => {
            setText(e.target.value);
            autoGrow();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        <div className="composer-foot">
          <span className="faint" style={{ fontSize: 12.5 }}>
            Answers arrive on their own
          </span>
          <button
            className="btn btn-primary"
            onClick={() => submit()}
            disabled={busy || !text.trim()}
          >
            {busy ? <span className="spinner" /> : null}
            Capture
          </button>
        </div>
      </div>
      {error ? (
        <p style={{ color: "var(--red)", fontSize: 13.5, marginTop: 10 }}>
          {error}
        </p>
      ) : null}
    </>
  );
}

/* ── Rows ────────────────────────────────────────────────────────────── */

function ThreadRow({ thought }: { thought: ThoughtRow }) {
  const pending = isInFlight(thought.status);
  const failed = thought.status === "failed";

  return (
    <Link href={`/t/${thought.id}`} className="thread">
      <p className="thread-title">
        {pending ? <span className="pip pip-working" /> : null}
        {failed ? <span className="pip pip-failed" /> : null}
        <span>{thought.title ?? thought.raw_text.slice(0, 60)}</span>
      </p>

      <p className="thread-synopsis">
        {thought.synopsis ??
          (pending ? statusLabel(thought.status) : thought.raw_text)}
      </p>

      <p className="thread-meta">
        <span>{clockTime(thought.created_at)}</span>
        <span className="dot-sep">
          {DEPTH_LABEL[thought.depth] ?? thought.depth}
        </span>
        {thought.has_disagreements ? (
          <span className="dot-sep">Engines disagreed</span>
        ) : null}
      </p>
    </Link>
  );
}

function EmptyState() {
  return (
    <div style={{ padding: "64px 8px", textAlign: "center" }}>
      <p className="h2" style={{ marginBottom: 6 }}>
        Nothing captured yet
      </p>
      <p className="muted" style={{ fontSize: 14.5, margin: 0 }}>
        Type a thought above, or say &ldquo;Hey Siri, ask Meta&rdquo; on your
        phone.
      </p>
    </div>
  );
}

/* ── Unlock ──────────────────────────────────────────────────────────── */

function UnlockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function unlock() {
    if (!secret.trim() || busy) return;
    setBusy(true);
    setError(false);

    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: secret.trim() }),
    });

    setBusy(false);

    if (res.ok) onUnlocked();
    else setError(true);
  }

  return (
    <div className="center-stage">
      <div className="lock-card rise">
        <div style={{ color: "var(--text-faint)", marginBottom: 14 }}>
          <Lock size={22} />
        </div>
        <p className="h2" style={{ marginBottom: 20 }}>
          MetaLLM
        </p>
        <input
          className="field"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && unlock()}
          placeholder="Access key"
          autoFocus
        />
        {error ? (
          <p style={{ color: "var(--red)", fontSize: 13.5, marginTop: 10 }}>
            That key didn&rsquo;t work.
          </p>
        ) : null}
        <button
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 12 }}
          onClick={unlock}
          disabled={busy || !secret.trim()}
        >
          {busy ? <span className="spinner" /> : null}
          Unlock
        </button>
      </div>
    </div>
  );
}

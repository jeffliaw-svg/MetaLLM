"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ENGINE_META, EngineLogo } from "@/components/EngineLogo";
import { ArrowLeft, Check, ChevronRight, Link as LinkIcon } from "@/components/Icons";
import { Markdown } from "@/components/Markdown";
import { DEPTH_LABEL, clockTime, isInFlight, statusLabel } from "@/lib/format";

interface Disagreement {
  topic: string;
  positions: Record<string, string>;
  assessment: string;
}

interface Thought {
  id: string;
  raw_text: string;
  clarification: string | null;
  resolved_prompt: string;
  title: string | null;
  depth: string;
  status: string;
  error: string | null;
  synopsis: string | null;
  synthesis: string | null;
  disagreements: Disagreement[] | null;
  best_engine: string | null;
  engines_expected: number;
  created_at: string;
}

interface Response {
  id: string;
  engine: string;
  model: string | null;
  text: string | null;
  status: string;
  error: string | null;
  latency_seconds: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
}

const POLL_MS = 3000;

export default function ThoughtPage() {
  const { id } = useParams<{ id: string }>();
  const [thought, setThought] = useState<Thought | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/thoughts/${id}`, { cache: "no-store" });
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    if (!res.ok) return;

    const data = await res.json();
    setThought(data.thought);
    setResponses(data.responses ?? []);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const pending = thought ? isInFlight(thought.status) : false;

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [pending, load]);

  if (notFound) {
    return (
      <div className="center-stage">
        <div style={{ textAlign: "center" }}>
          <p className="h2">Not found</p>
          <Link href="/" className="btn btn-ghost" style={{ marginTop: 16 }}>
            Back
          </Link>
        </div>
      </div>
    );
  }

  if (!thought) return <div className="center-stage" />;

  const succeeded = responses.filter((r) => r.status === "ok");
  const failed = responses.filter((r) => r.status === "failed");

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link
            href="/"
            className="btn btn-bare"
            style={{ marginLeft: -8, gap: 6 }}
          >
            <ArrowLeft size={15} />
            All thoughts
          </Link>
          <div style={{ marginLeft: "auto" }}>
            <ShareButton id={thought.id} />
          </div>
        </div>
      </header>

      <main className="shell rise" style={{ paddingTop: 32, paddingBottom: 96 }}>
        {/* The question */}
        <p className="eyebrow" style={{ marginBottom: 10 }}>
          {clockTime(thought.created_at)} ·{" "}
          {DEPTH_LABEL[thought.depth] ?? thought.depth}
        </p>
        <h1 className="h1">{thought.resolved_prompt}</h1>

        {thought.clarification ? (
          <p className="muted" style={{ fontSize: 14.5, marginTop: 10 }}>
            You added: {thought.clarification}
          </p>
        ) : null}

        {/* The answer */}
        {thought.status === "failed" ? (
          <div
            className="synopsis-card"
            style={{ marginTop: 26, color: "var(--red)" }}
          >
            Couldn&rsquo;t answer this one.
            {thought.error ? (
              <span className="muted" style={{ display: "block", fontSize: 14, marginTop: 8 }}>
                {thought.error}
              </span>
            ) : null}
          </div>
        ) : pending ? (
          <WorkingCard
            status={thought.status}
            done={responses.length}
            total={thought.engines_expected}
          />
        ) : (
          <>
            {thought.synopsis ? (
              <div className="synopsis-card" style={{ marginTop: 26 }}>
                {thought.synopsis}
              </div>
            ) : null}

            {thought.synthesis &&
            thought.synthesis.trim() !== thought.synopsis?.trim() ? (
              <div style={{ marginTop: 32 }}>
                <Markdown>{thought.synthesis}</Markdown>
              </div>
            ) : null}
          </>
        )}

        {/* Disagreements — only when engines genuinely conflicted */}
        {thought.disagreements && thought.disagreements.length > 0 ? (
          <section style={{ marginTop: 40 }}>
            <p className="eyebrow" style={{ marginBottom: 14 }}>
              Where the engines disagreed
            </p>
            {thought.disagreements.map((d, i) => (
              <div
                key={i}
                className="panel"
                style={{ padding: "18px 20px", marginBottom: 12 }}
              >
                <p className="h2" style={{ marginBottom: 12 }}>
                  {d.topic}
                </p>
                {Object.entries(d.positions).map(([label, position]) => (
                  <p
                    key={label}
                    className="muted"
                    style={{ fontSize: 14.5, margin: "0 0 8px" }}
                  >
                    <strong style={{ color: "var(--text)" }}>{label}:</strong>{" "}
                    {position}
                  </p>
                ))}
                {d.assessment ? (
                  <p
                    style={{
                      fontSize: 14.5,
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    {d.assessment}
                  </p>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}

        {/* Per-engine detail, tucked away */}
        {succeeded.length > 0 ? (
          <section style={{ marginTop: 40 }}>
            <p className="eyebrow" style={{ marginBottom: 6 }}>
              {succeeded.length} engine{succeeded.length === 1 ? "" : "s"}{" "}
              answered
              {failed.length > 0 ? `, ${failed.length} failed` : ""}
            </p>
            {succeeded.map((r) => (
              <EngineDisclosure
                key={r.id}
                response={r}
                isBest={r.engine === thought.best_engine}
              />
            ))}
          </section>
        ) : null}
      </main>
    </>
  );
}

/* ── Pieces ──────────────────────────────────────────────────────────── */

function WorkingCard({
  status,
  done,
  total,
}: {
  status: string;
  done: number;
  total: number;
}) {
  return (
    <div
      className="synopsis-card"
      style={{
        marginTop: 26,
        display: "flex",
        alignItems: "center",
        gap: 12,
        color: "var(--text-muted)",
        fontSize: 16,
      }}
    >
      <span className="spinner" />
      <span>
        {statusLabel(status)}
        {status === "running" && total > 1 ? ` · ${done} of ${total}` : ""}
      </span>
    </div>
  );
}

function EngineDisclosure({
  response,
  isBest,
}: {
  response: Response;
  isBest: boolean;
}) {
  const [open, setOpen] = useState(false);
  const meta = ENGINE_META[response.engine as keyof typeof ENGINE_META];

  return (
    <div className="disclosure">
      <button className="disclosure-trigger" onClick={() => setOpen(!open)}>
        <EngineLogo engine={response.engine} size={17} idSuffix={response.id} />
        <span style={{ fontWeight: 550 }}>{meta?.label ?? response.engine}</span>
        {isBest ? (
          <span className="faint" style={{ fontSize: 12.5 }}>
            strongest
          </span>
        ) : null}
        <span className="faint" style={{ fontSize: 12.5, marginLeft: 4 }}>
          {response.latency_seconds ? `${response.latency_seconds}s` : null}
        </span>
        <span className={`chevron ${open ? "chevron-open" : ""}`}>
          <ChevronRight size={15} />
        </span>
      </button>
      {open && response.text ? (
        <div style={{ padding: "4px 4px 22px" }}>
          <Markdown>{response.text}</Markdown>
        </div>
      ) : null}
    </div>
  );
}

function ShareButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function share() {
    if (busy) return;
    setBusy(true);

    try {
      const res = await fetch(`/api/thoughts/${id}/share`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await navigator.clipboard.writeText(data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard can be blocked; the token still exists either way.
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn btn-bare" onClick={share} disabled={busy}>
      {copied ? <Check size={15} /> : <LinkIcon size={15} />}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}

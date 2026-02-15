"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type {
  Engine,
  Length,
  Mode,
  QueryRequest,
  Speed,
} from "@/lib/config";

/* ── Type mirrors of the API response ───────────────────────────────── */

interface ProviderResponse {
  engine: Engine;
  model: string;
  text: string;
  latencySeconds: number;
  inputTokens: number;
  outputTokens: number;
}

interface Disagreement {
  topic: string;
  positions: Record<string, string>;
  assessment: string;
}

interface ArbiterResult {
  bestLabel: string;
  bestEngine: Engine;
  bestRationale: string;
  consensus: string[];
  disagreements: Disagreement[];
  synthesis: string;
}

interface SingleResult {
  kind: "single";
  response: ProviderResponse;
}

interface BakeoffResult {
  kind: "bakeoff";
  responses: ProviderResponse[];
  arbitration: ArbiterResult;
}

type QueryResult = SingleResult | BakeoffResult;

/* ── Constants ──────────────────────────────────────────────────────── */

const ENGINE_META: Record<Engine, { label: string; color: string; icon: string }> = {
  claude: { label: "Claude", color: "#a78bfa", icon: "C" },
  gemini: { label: "Gemini", color: "#34d399", icon: "G" },
  chatgpt: { label: "ChatGPT", color: "#f5a623", icon: "O" },
};

const RESPONSE_LABELS = ["A", "B", "C"];
const LABEL_COLORS = ["#4f7df5", "#34d399", "#f5a623"];

/* ── Page ───────────────────────────────────────────────────────────── */

export default function Home() {
  const [mode, setMode] = useState<Mode>("bakeoff");
  const [speed, setSpeed] = useState<Speed>("moderate");
  const [length, setLength] = useState<Length>("moderate");
  const [engine, setEngine] = useState<Engine>("claude");
  const [arbiter, setArbiter] = useState<Engine>("claude");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);

    const body: QueryRequest = {
      prompt: prompt.trim(),
      mode,
      speed,
      length,
      ...(mode === "single" ? { engine } : { arbiter }),
    };

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="pt-12 pb-6 px-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight" style={{ letterSpacing: "-0.03em" }}>
          Meta<span style={{ color: "var(--accent-blue)" }}>LLM</span>
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-tertiary)" }}>
          Multi-AI arbitration engine
        </p>
      </header>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 pb-16">

        {/* ── Controls ────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit}>
          <div className="glass p-6 mb-6">

            {/* Mode toggle */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                Mode
              </span>
              <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setMode("single")}
                  className="px-4 py-2 text-sm font-medium"
                  style={{
                    background: mode === "single" ? "var(--accent-blue)" : "transparent",
                    color: mode === "single" ? "#fff" : "var(--text-secondary)",
                  }}
                >
                  Single Engine
                </button>
                <button
                  type="button"
                  onClick={() => setMode("bakeoff")}
                  className="px-4 py-2 text-sm font-medium"
                  style={{
                    background: mode === "bakeoff" ? "var(--accent-blue)" : "transparent",
                    color: mode === "bakeoff" ? "#fff" : "var(--text-secondary)",
                    borderLeft: "1px solid var(--border)",
                  }}
                >
                  Bake-off
                </button>
              </div>
            </div>

            {/* Settings row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              <SettingSelect
                label="Speed"
                value={speed}
                onChange={(v) => setSpeed(v as Speed)}
                options={[
                  { value: "fast", label: "Fast" },
                  { value: "moderate", label: "Moderate" },
                  { value: "research", label: "Research" },
                ]}
              />
              <SettingSelect
                label="Length"
                value={length}
                onChange={(v) => setLength(v as Length)}
                options={[
                  { value: "quick", label: "Quick" },
                  { value: "moderate", label: "Moderate" },
                  { value: "detailed", label: "Detailed" },
                  { value: "research", label: "Research" },
                  { value: "memo", label: "Memo" },
                ]}
              />
              {mode === "single" ? (
                <SettingSelect
                  label="Engine"
                  value={engine}
                  onChange={(v) => setEngine(v as Engine)}
                  options={[
                    { value: "claude", label: "Claude" },
                    { value: "gemini", label: "Gemini" },
                    { value: "chatgpt", label: "ChatGPT" },
                  ]}
                />
              ) : (
                <SettingSelect
                  label="Arbiter"
                  value={arbiter}
                  onChange={(v) => setArbiter(v as Engine)}
                  options={[
                    { value: "claude", label: "Claude" },
                    { value: "gemini", label: "Gemini" },
                    { value: "chatgpt", label: "ChatGPT" },
                  ]}
                />
              )}
            </div>

            {/* Prompt input */}
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask anything..."
                rows={3}
                className="w-full rounded-xl px-5 py-4 text-sm leading-relaxed"
                style={{
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleSubmit(e);
                  }
                }}
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {mode === "bakeoff"
                    ? `Querying all 3 engines \u00b7 ${arbiter} arbitrates`
                    : `Querying ${engine}`}
                  {" \u00b7 "}
                  {speed} speed \u00b7 {length} length
                </span>
                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2"
                  style={{
                    background: loading || !prompt.trim() ? "var(--border)" : "var(--accent-blue)",
                    color: loading || !prompt.trim() ? "var(--text-tertiary)" : "#fff",
                    cursor: loading || !prompt.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? (
                    <>
                      <span className="spinner" />
                      {mode === "bakeoff" ? "Querying 3 engines..." : "Querying..."}
                    </>
                  ) : (
                    <>
                      Run
                      <span style={{ opacity: 0.5, fontSize: "0.75rem" }}>\u2318\u23CE</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* ── Loading state ─────────────────────────────────────── */}
        {loading && (
          <div className="glass p-8 flex flex-col items-center justify-center gap-4 fade-in-up">
            <div className="flex gap-2">
              <div className="pulse-dot" style={{ background: "var(--accent-blue)" }} />
              <div className="pulse-dot" style={{ background: "var(--accent-green)" }} />
              <div className="pulse-dot" style={{ background: "var(--accent-amber)" }} />
            </div>
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
              {mode === "bakeoff"
                ? "Querying Claude, Gemini & ChatGPT in parallel..."
                : `Querying ${ENGINE_META[engine].label}...`}
            </p>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────── */}
        {error && (
          <div
            className="glass p-5 fade-in-up"
            style={{ borderColor: "var(--accent-rose)" }}
          >
            <p className="text-sm" style={{ color: "var(--accent-rose)" }}>
              {error}
            </p>
          </div>
        )}

        {/* ── Results ───────────────────────────────────────────── */}
        {result && !loading && (
          <div className="stagger">
            {result.kind === "single" ? (
              <ResponseCard response={result.response} />
            ) : (
              <BakeoffResults result={result} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/* ── Setting Select ─────────────────────────────────────────────────── */

function SettingSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label
        className="block text-xs font-medium uppercase tracking-wider mb-2"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2.5 text-sm"
        style={{
          background: "rgba(0,0,0,0.25)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ── Response Card (used in single mode and bake-off) ───────────────── */

function ResponseCard({
  response,
  label,
  labelColor,
}: {
  response: ProviderResponse;
  label?: string;
  labelColor?: string;
}) {
  const meta = ENGINE_META[response.engine];
  return (
    <div className="glass p-6 mb-4">
      <div className="flex items-center gap-3 mb-4">
        {label && (
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: labelColor, color: "#fff" }}
          >
            {label}
          </span>
        )}
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: meta.color, color: "#0a0a0f" }}
        >
          {meta.icon}
        </span>
        <span className="text-sm font-medium">{meta.label}</span>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {response.model}
        </span>
        <span className="ml-auto text-xs" style={{ color: "var(--text-tertiary)" }}>
          {response.latencySeconds}s &middot;{" "}
          {response.inputTokens + response.outputTokens} tokens
        </span>
      </div>
      <div className="prose-response text-sm leading-relaxed">
        <ReactMarkdown>{response.text}</ReactMarkdown>
      </div>
    </div>
  );
}

/* ── Bake-off Results ───────────────────────────────────────────────── */

function BakeoffResults({ result }: { result: BakeoffResult }) {
  const arb = result.arbitration;

  return (
    <>
      {/* Individual responses */}
      <div className="mb-2">
        <SectionLabel>Responses</SectionLabel>
      </div>
      {result.responses.map((r, i) => (
        <ResponseCard
          key={r.engine}
          response={r}
          label={RESPONSE_LABELS[i]}
          labelColor={LABEL_COLORS[i]}
        />
      ))}

      {/* Verdict */}
      <div className="mt-8 mb-2">
        <SectionLabel>Arbiter Verdict</SectionLabel>
      </div>
      <div className="glass p-6 mb-4" style={{ borderColor: "var(--accent-green)" }}>
        <div className="flex items-center gap-3 mb-3">
          <span
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: "var(--accent-green)", color: "#0a0a0f" }}
          >
            Best: {arb.bestLabel}
          </span>
          <span className="text-sm font-medium">
            {ENGINE_META[arb.bestEngine].label}
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {arb.bestRationale}
        </p>
      </div>

      {/* Consensus */}
      {arb.consensus.length > 0 && (
        <>
          <div className="mt-8 mb-2">
            <SectionLabel>Consensus</SectionLabel>
          </div>
          <div className="glass p-6 mb-4">
            <ul className="space-y-2">
              {arb.consensus.map((point, i) => (
                <li key={i} className="flex gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <span style={{ color: "var(--accent-green)" }}>&#10003;</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Disagreements */}
      {arb.disagreements.length > 0 && (
        <>
          <div className="mt-8 mb-2">
            <SectionLabel>Disagreements</SectionLabel>
          </div>
          {arb.disagreements.map((d, i) => (
            <div key={i} className="glass p-6 mb-4">
              <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--accent-amber)" }}>
                {d.topic}
              </h4>
              <div className="space-y-2 mb-4">
                {Object.entries(d.positions).map(([lbl, pos]) => (
                  <div key={lbl} className="flex gap-3 text-sm">
                    <span
                      className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                      style={{
                        background: LABEL_COLORS[RESPONSE_LABELS.indexOf(lbl)] ?? "var(--border)",
                        color: "#fff",
                      }}
                    >
                      {lbl}
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>{pos}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm italic" style={{ color: "var(--text-tertiary)" }}>
                {d.assessment}
              </p>
            </div>
          ))}
        </>
      )}

      {/* Synthesis */}
      {arb.synthesis && (
        <>
          <div className="mt-8 mb-2">
            <SectionLabel>Synthesised Answer</SectionLabel>
          </div>
          <div className="glass p-6 mb-4" style={{ borderColor: "var(--accent-purple)" }}>
            <div className="prose-response text-sm leading-relaxed">
              <ReactMarkdown>{arb.synthesis}</ReactMarkdown>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ── Section Label ──────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-tertiary)" }}
      >
        {children}
      </span>
      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
    </div>
  );
}

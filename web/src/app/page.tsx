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
  claude: { label: "Claude", color: "#af52de", icon: "C" },
  gemini: { label: "Gemini", color: "#34c759", icon: "G" },
  chatgpt: { label: "ChatGPT", color: "#ff9f0a", icon: "O" },
};

const RESPONSE_LABELS = ["A", "B", "C"];

/** Map arbiter's anonymous A/B/C label to the actual engine's icon & color. */
function engineIconForLabel(
  label: string,
  responses: ProviderResponse[]
): { icon: string; color: string } {
  const idx = RESPONSE_LABELS.indexOf(label);
  if (idx >= 0 && idx < responses.length) {
    return ENGINE_META[responses[idx].engine];
  }
  return { icon: label, color: "var(--border)" };
}

/* ── Trophy icon ────────────────────────────────────────────────────── */

function TrophyIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

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

  // Share / copy state
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Collapsible individual responses
  const [expandedEngines, setExpandedEngines] = useState<Set<string>>(new Set());

  function toggleEngine(eng: string) {
    setExpandedEngines((prev) => {
      const next = new Set(prev);
      if (next.has(eng)) next.delete(eng);
      else next.add(eng);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setShareUrl(null);
    setExpandedEngines(new Set());

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

      // Auto-save to Supabase
      saveSearch(body, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSearch(req: QueryRequest, queryResult: QueryResult) {
    setSaving(true);
    try {
      const res = await fetch("/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: req.prompt,
          mode: req.mode,
          speed: req.speed,
          length: req.length,
          engine: req.engine ?? null,
          arbiter: req.arbiter ?? null,
          result: queryResult,
        }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        setShareUrl(`${window.location.origin}/share/${data.id}`);
      }
    } catch {
      // Save is best-effort — don't block the user
    } finally {
      setSaving(false);
    }
  }

  function buildCopyText(): string {
    if (!result) return "";
    const lines: string[] = [`# MetaLLM Analysis`, "", `**Prompt:** ${prompt}`, ""];

    if (result.kind === "single") {
      const meta = ENGINE_META[result.response.engine];
      lines.push(`## ${meta.label}`, "", result.response.text);
    } else {
      const arb = result.arbitration;
      if (arb.synthesis) {
        lines.push("## Synthesised Answer", "", arb.synthesis, "");
      }
      const bestMeta = ENGINE_META[arb.bestEngine];
      lines.push(`## Bake-Off Winner`, "", `**Best: ${bestMeta.label}** — ${arb.bestRationale}`, "");
      if (arb.consensus.length > 0) {
        lines.push("## Consensus", "");
        arb.consensus.forEach((p) => lines.push(`- ${p}`));
        lines.push("");
      }
      if (arb.disagreements.length > 0) {
        lines.push("## Disagreements", "");
        arb.disagreements.forEach((d) => {
          lines.push(`### ${d.topic}`, "");
          Object.entries(d.positions).forEach(([lbl, pos]) => {
            const em = engineIconForLabel(lbl, result.responses);
            lines.push(`- **${em.icon}:** ${pos}`);
          });
          lines.push("", `*${d.assessment}*`, "");
        });
      }
      // Only include expanded individual responses
      result.responses.forEach((resp) => {
        if (expandedEngines.has(resp.engine)) {
          const meta = ENGINE_META[resp.engine];
          lines.push(`## ${meta.label} Response`, "", resp.text, "");
        }
      });
    }
    return lines.join("\n");
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(buildCopyText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyShareUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="pt-14 pb-8 px-6 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight" style={{ letterSpacing: "-0.04em" }}>
          Meta<span style={{ color: "var(--accent-blue)" }}>LLM</span>
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-tertiary)" }}>
          Multi-AI arbitration engine
        </p>
      </header>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 pb-24">

        {/* ── Controls ────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit}>
          <div className="glass p-6 mb-6">

            {/* Mode toggle */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                Mode
              </span>
              <div className="flex rounded-lg" style={{ background: "var(--bg-input)", padding: "3px" }}>
                <button
                  type="button"
                  onClick={() => setMode("single")}
                  className="px-4 py-1.5 text-sm font-medium"
                  style={{
                    background: mode === "single" ? "var(--accent-blue)" : "transparent",
                    color: mode === "single" ? "#fff" : "var(--text-secondary)",
                    borderRadius: "6px",
                  }}
                >
                  Single Engine
                </button>
                <button
                  type="button"
                  onClick={() => setMode("bakeoff")}
                  className="px-4 py-1.5 text-sm font-medium"
                  style={{
                    background: mode === "bakeoff" ? "var(--accent-blue)" : "transparent",
                    color: mode === "bakeoff" ? "#fff" : "var(--text-secondary)",
                    borderRadius: "6px",
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
                  background: "var(--bg-input)",
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
                  {speed} speed &middot; {length} length
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
                      <span style={{ opacity: 0.5, fontSize: "0.75rem" }}>&thinsp;&#8984;&#9166;</span>
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
            className="glass card-accent p-5 fade-in-up"
            style={{ borderLeftColor: "var(--accent-rose)" }}
          >
            <p className="text-sm" style={{ color: "var(--accent-rose)" }}>
              {error}
            </p>
          </div>
        )}

        {/* ── Results ───────────────────────────────────────────── */}
        {result && !loading && (
          <>
            <div className="stagger">
              {result.kind === "single" ? (
                <ResponseCard response={result.response} />
              ) : (
                <BakeoffResults
                  result={result}
                  expandedEngines={expandedEngines}
                  onToggle={toggleEngine}
                />
              )}
            </div>

            {/* Floating action bar — outside all cards */}
            <div className="flex justify-center mt-8 fade-in-up">
              <div className="action-bar flex items-center gap-2 px-4 py-2">
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2"
                  style={{
                    background: copied && !shareUrl ? "var(--accent-green)" : "transparent",
                    color: copied && !shareUrl ? "#fff" : "var(--text-secondary)",
                  }}
                >
                  {copied && !shareUrl ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      Copy results
                    </>
                  )}
                </button>
                {saving && (
                  <span className="text-xs px-2" style={{ color: "var(--text-tertiary)" }}>
                    Saving...
                  </span>
                )}
                {shareUrl && (
                  <>
                    <div className="w-px h-5" style={{ background: "var(--border)" }} />
                    <button
                      onClick={handleCopyShareUrl}
                      className="px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2"
                      style={{
                        background: copied ? "var(--accent-green)" : "var(--accent-blue)",
                        color: "#fff",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      {copied ? "Link copied!" : "Share link"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
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
          background: "var(--bg-input)",
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

/* ── Response Card (single mode) ─────────────────────────────────────── */

function ResponseCard({ response }: { response: ProviderResponse }) {
  const meta = ENGINE_META[response.engine];
  return (
    <div
      className="glass card-accent p-6 mb-4"
      style={{
        borderLeftColor: meta.color,
        background: `linear-gradient(135deg, ${meta.color}06 0%, var(--bg-card) 40%)`,
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: meta.color, color: "#fff" }}
        >
          {meta.icon}
        </span>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{meta.label}</span>
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

function BakeoffResults({
  result,
  expandedEngines,
  onToggle,
}: {
  result: BakeoffResult;
  expandedEngines: Set<string>;
  onToggle: (engine: string) => void;
}) {
  const arb = result.arbitration;
  const winnerMeta = ENGINE_META[arb.bestEngine];

  function iconForLabel(label: string) {
    return engineIconForLabel(label, result.responses);
  }

  return (
    <>
      {/* Synthesis first */}
      {arb.synthesis && (
        <>
          <div className="mb-3">
            <SectionLabel>Synthesised Answer</SectionLabel>
          </div>
          <div
            className="glass card-accent p-6 mb-6"
            style={{
              borderLeftColor: "var(--accent-purple)",
              background: `linear-gradient(135deg, rgba(175, 82, 222, 0.04) 0%, var(--bg-card) 40%)`,
            }}
          >
            <div className="prose-response text-sm leading-relaxed">
              <ReactMarkdown>{arb.synthesis}</ReactMarkdown>
            </div>
          </div>
        </>
      )}

      {/* Bake-Off Winner */}
      <div className="mt-10 mb-3">
        <SectionLabel>Bake-Off Winner</SectionLabel>
      </div>
      <div
        className="glass card-accent p-6 mb-6"
        style={{
          borderLeftColor: winnerMeta.color,
          background: `linear-gradient(135deg, ${winnerMeta.color}08 0%, var(--bg-card) 50%)`,
          boxShadow: `0 2px 16px ${winnerMeta.color}12, 0 1px 3px rgba(0, 0, 0, 0.06)`,
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <span
            className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5"
            style={{ background: winnerMeta.color, color: "#fff" }}
          >
            <TrophyIcon size={13} color="#fff" />
            {winnerMeta.label}
          </span>
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: winnerMeta.color, color: "#fff" }}
          >
            {winnerMeta.icon}
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {arb.bestRationale}
        </p>
      </div>

      {/* Consensus */}
      {arb.consensus.length > 0 && (
        <>
          <div className="mt-10 mb-3">
            <SectionLabel>Consensus</SectionLabel>
          </div>
          <div
            className="glass card-accent p-6 mb-6"
            style={{
              borderLeftColor: "var(--accent-green)",
              background: `linear-gradient(135deg, rgba(52, 199, 89, 0.03) 0%, var(--bg-card) 40%)`,
            }}
          >
            <ul className="space-y-3">
              {arb.consensus.map((point, i) => (
                <li key={i} className="flex gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ background: "rgba(52, 199, 89, 0.12)", color: "var(--accent-green)" }}>
                    &#10003;
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Disagreements — engine icons instead of A/B/C circles */}
      {arb.disagreements.length > 0 && (
        <>
          <div className="mt-10 mb-3">
            <SectionLabel>Disagreements</SectionLabel>
          </div>
          {arb.disagreements.map((d, i) => (
            <div
              key={i}
              className="glass card-accent p-6 mb-4"
              style={{
                borderLeftColor: "var(--accent-amber)",
                background: `linear-gradient(135deg, rgba(255, 159, 10, 0.03) 0%, var(--bg-card) 40%)`,
              }}
            >
              <h4 className="text-sm font-bold mb-3" style={{ color: "var(--accent-amber)" }}>
                {d.topic}
              </h4>
              <div className="space-y-2.5 mb-4">
                {Object.entries(d.positions).map(([lbl, pos]) => {
                  const em = iconForLabel(lbl);
                  return (
                    <div key={lbl} className="flex gap-3 text-sm">
                      <span
                        className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                        style={{ background: em.color, color: "#fff" }}
                      >
                        {em.icon}
                      </span>
                      <span style={{ color: "var(--text-secondary)" }}>{pos}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-sm italic" style={{ color: "var(--text-tertiary)" }}>
                {d.assessment}
              </p>
            </div>
          ))}
        </>
      )}

      {/* Individual responses — collapsible, hidden by default */}
      <div className="mt-10 mb-3">
        <SectionLabel>Individual Responses</SectionLabel>
      </div>
      {result.responses.map((r) => {
        const meta = ENGINE_META[r.engine];
        const isOpen = expandedEngines.has(r.engine);
        return (
          <div key={r.engine} className="glass mb-4 overflow-hidden">
            <button
              onClick={() => onToggle(r.engine)}
              className="accordion-trigger w-full p-5 flex items-center gap-3 text-left"
              style={{ cursor: "pointer" }}
            >
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: meta.color, color: "#fff" }}
              >
                {meta.icon}
              </span>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{meta.label}</span>
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {r.model}
              </span>
              <span className="ml-auto text-xs" style={{ color: "var(--text-tertiary)" }}>
                {r.latencySeconds}s &middot; {r.inputTokens + r.outputTokens} tokens
              </span>
              <span
                className="ml-2 text-xs"
                style={{
                  color: "var(--text-tertiary)",
                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 0.15s ease",
                  display: "inline-block",
                }}
              >
                &#9654;
              </span>
            </button>
            {isOpen && (
              <div className="px-6 pb-6" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="prose-response text-sm leading-relaxed pt-4">
                  <ReactMarkdown>{r.text}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ── Section Label ──────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <h3
        className="text-base font-bold tracking-tight flex-shrink-0"
        style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
      >
        {children}
      </h3>
      <div
        className="flex-1 h-px"
        style={{ background: "linear-gradient(90deg, var(--border), transparent)" }}
      />
    </div>
  );
}

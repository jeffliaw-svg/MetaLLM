"use client";

import { useState, useRef } from "react";
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

const ENGINE_META: Record<Engine, { label: string; color: string }> = {
  claude: { label: "Claude", color: "#da7756" },
  gemini: { label: "Gemini", color: "#4285f4" },
  chatgpt: { label: "ChatGPT", color: "#10a37f" },
};

/* ── Brand Logo SVG Components ────────────────────────────────────── */

function ClaudeLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="#da7756">
      <path d="m3.127 10.604 3.135-1.76.053-.153-.053-.085H6.11l-.525-.032-1.791-.048-1.554-.065-1.505-.08-.38-.081L0 7.832l.036-.234.32-.214.455.04 1.009.069 1.513.105 1.097.064 1.626.17h.259l.036-.105-.089-.065-.068-.064-1.566-1.062-1.695-1.121-.887-.646-.48-.327-.243-.306-.104-.67.435-.48.585.04.15.04.593.456 1.267.981 1.654 1.218.242.202.097-.068.012-.049-.109-.181-.9-1.626-.96-1.655-.428-.686-.113-.411a2 2 0 0 1-.068-.484l.496-.674L4.446 0l.662.089.279.242.411.94.666 1.48 1.033 2.014.302.597.162.553.06.17h.105v-.097l.085-1.134.157-1.392.154-1.792.052-.504.25-.605.497-.327.387.186.319.456-.045.294-.19 1.23-.37 1.93-.243 1.29h.142l.161-.16.654-.868 1.097-1.372.484-.545.565-.601.363-.287h.686l.505.751-.226.775-.707.895-.585.759-.839 1.13-.524.904.048.072.125-.012 1.897-.403 1.024-.186 1.223-.21.553.258.06.263-.218.536-1.307.323-1.533.307-2.284.54-.028.02.032.04 1.029.098.44.024h1.077l2.005.15.525.346.315.424-.053.323-.807.411-3.631-.863-.872-.218h-.12v.073l.726.71 1.331 1.202 1.667 1.55.084.383-.214.302-.226-.032-1.464-1.101-.565-.497-1.28-1.077h-.084v.113l.295.432 1.557 2.34.08.718-.112.234-.404.141-.444-.08-.911-1.28-.94-1.44-.759-1.291-.093.053-.448 4.821-.21.246-.484.186-.403-.307-.214-.496.214-.98.258-1.28.21-1.016.19-1.263.112-.42-.008-.028-.092.012-.953 1.307-1.448 1.957-1.146 1.227-.274.109-.477-.247.045-.44.266-.39 1.586-2.018.956-1.25.617-.723-.004-.105h-.036l-4.212 2.736-.75.096-.324-.302.04-.496.154-.162 1.267-.871z"/>
    </svg>
  );
}

function GeminiLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M24 4C24 15.05 15.05 24 4 24c11.05 0 20 8.95 20 20 0-11.05 8.95-20 20-20-11.05 0-20-8.95-20-20z" fill="url(#gemini-grad)"/>
      <defs>
        <linearGradient id="gemini-grad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4285f4"/>
          <stop offset="0.5" stopColor="#9b72cb"/>
          <stop offset="1" stopColor="#d96570"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function OpenAILogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M41.2 20.3a10.7 10.7 0 00-.9-8.8 10.8 10.8 0 00-11.6-5.2A10.8 10.8 0 0020.6 2a10.7 10.7 0 00-10.2 7.4 10.7 10.7 0 00-7.2 5.2 10.8 10.8 0 001.3 12.6 10.7 10.7 0 00.9 8.8 10.8 10.8 0 0011.6 5.2A10.8 10.8 0 0027.4 46a10.7 10.7 0 0010.2-7.4 10.7 10.7 0 007.2-5.2 10.8 10.8 0 00-1.3-12.6l-2.3-.5zM27.4 43.4a8 8 0 01-5.2-1.9l.3-.1 8.5-4.9a1.4 1.4 0 00.7-1.2V22.7l3.6 2.1v12.6a8.1 8.1 0 01-7.9 6zM8.4 35.5a8 8 0 01-1-5.4l.3.2 8.5 4.9a1.4 1.4 0 001.4 0l10.4-6v4.1l-8.6 5a8.1 8.1 0 01-11-2.8zM6.2 16a8 8 0 014.2-3.5v10.1a1.4 1.4 0 00.7 1.2l10.4 6-3.6 2.1L9.4 27a8.1 8.1 0 01-3.2-11zm28.2 6.6L24 16.5l3.6-2.1 8.5 4.9a8.1 8.1 0 011.2 13.3V22.5a1.4 1.4 0 00-.7-1.2l-2.2.3zm3.5-5.5l-.3-.2-8.5-4.9a1.4 1.4 0 00-1.4 0l-10.4 6V14l8.6-5a8.1 8.1 0 0112 7.1zm-22.5 7.4l-3.6-2.1V10.9a8.1 8.1 0 0113.2-6.3l-.3.2-8.5 4.9a1.4 1.4 0 00-.7 1.2l-.1 12.6zm2-4.2l4.6-2.7 4.6 2.7v5.3l-4.6 2.7-4.6-2.7v-5.3z" fill="#10a37f"/>
    </svg>
  );
}

function EngineLogo({ engine, size = 24 }: { engine: Engine; size?: number }) {
  switch (engine) {
    case "claude": return <ClaudeLogo size={size} />;
    case "gemini": return <GeminiLogo size={size} />;
    case "chatgpt": return <OpenAILogo size={size} />;
  }
}

const ENGINES: Engine[] = ["claude", "gemini", "chatgpt"];

const SPEED_OPTIONS: { value: Speed; label: string }[] = [
  { value: "fast", label: "Fast" },
  { value: "moderate", label: "Moderate" },
  { value: "research", label: "Research" },
];

const LENGTH_OPTIONS: { value: Length; label: string }[] = [
  { value: "brief", label: "Brief" },
  { value: "moderate", label: "Moderate" },
  { value: "detailed", label: "Detailed" },
  { value: "research", label: "Research" },
];

const RESPONSE_LABELS = ["A", "B", "C"];

/** Map arbiter's anonymous A/B/C label to the actual engine key & color. */
function engineForLabel(
  label: string,
  responses: ProviderResponse[]
): { engine: Engine | null; color: string } {
  const idx = RESPONSE_LABELS.indexOf(label);
  if (idx >= 0 && idx < responses.length) {
    const eng = responses[idx].engine;
    return { engine: eng, color: ENGINE_META[eng].color };
  }
  return { engine: null, color: "var(--border)" };
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
    const lines: string[] = [`# LLM Showdown Analysis`, "", `**Prompt:** ${prompt}`, ""];

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
            const em = engineForLabel(lbl, result.responses);
            const name = em.engine ? ENGINE_META[em.engine].label : lbl;
            lines.push(`- **${name}:** ${pos}`);
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
      <header className="pt-12 pb-6 px-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight" style={{ letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
          LLM <span style={{ color: "var(--accent-blue)" }}>Showdown</span>
        </h1>
        <div className="mt-3 flex items-center justify-center gap-3">
          <EngineLogo engine="claude" size={22} />
          <span className="text-lg font-semibold" style={{ color: "var(--text-secondary)" }}>Claude</span>
          <span className="text-lg font-light" style={{ color: "var(--text-tertiary)" }}>vs.</span>
          <EngineLogo engine="gemini" size={22} />
          <span className="text-lg font-semibold" style={{ color: "var(--text-secondary)" }}>Gemini</span>
          <span className="text-lg font-light" style={{ color: "var(--text-tertiary)" }}>vs.</span>
          <EngineLogo engine="chatgpt" size={22} />
          <span className="text-lg font-semibold" style={{ color: "var(--text-secondary)" }}>ChatGPT</span>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 pb-24">

        {/* ── Controls ────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit}>
          <div className="glass p-5 mb-5">

            {/* Mode toggle */}
            <div className="flex items-center gap-3 mb-5">
              <span className="setting-label">Mode</span>
              <div className="segmented-control">
                <button
                  type="button"
                  onClick={() => setMode("single")}
                  className={`segmented-option ${mode === "single" ? "segmented-active" : ""}`}
                >
                  Single Engine
                </button>
                <button
                  type="button"
                  onClick={() => setMode("bakeoff")}
                  className={`segmented-option ${mode === "bakeoff" ? "segmented-active" : ""}`}
                >
                  Bake-off
                </button>
              </div>
            </div>

            {/* Settings row — segmented bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <span className="setting-label mb-2 block">Speed</span>
                <div className="segmented-control segmented-control-full">
                  {SPEED_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setSpeed(o.value)}
                      className={`segmented-option ${speed === o.value ? "segmented-active" : ""}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="setting-label mb-2 block">Response Length</span>
                <div className="segmented-control segmented-control-full">
                  {LENGTH_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setLength(o.value)}
                      className={`segmented-option ${length === o.value ? "segmented-active" : ""}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Engine / Arbiter selection */}
            <div className="mb-5">
              <span className="setting-label mb-2 block">
                {mode === "single" ? "Engine" : "Arbiter"}
              </span>
              <div className="engine-grid">
                {ENGINES.map((eng) => {
                  const meta = ENGINE_META[eng];
                  const isSelected = mode === "single" ? engine === eng : arbiter === eng;
                  return (
                    <button
                      key={eng}
                      type="button"
                      onClick={() =>
                        mode === "single" ? setEngine(eng) : setArbiter(eng)
                      }
                      className={`engine-card ${isSelected ? "engine-card-active" : ""}`}
                      style={{
                        "--engine-color": meta.color,
                      } as React.CSSProperties}
                    >
                      <span className="engine-radio">
                        {isSelected && <span className="engine-radio-dot" style={{ background: meta.color }} />}
                      </span>
                      <span className="engine-logo-wrap">
                        <EngineLogo engine={eng} size={22} />
                      </span>
                      <span className="engine-name">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prompt input */}
            <div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask anything..."
                rows={3}
                className="w-full rounded-xl px-4 py-3.5 text-sm leading-relaxed"
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
              <div className="flex items-center justify-between mt-2.5">
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {mode === "bakeoff"
                    ? `All 3 engines \u00b7 ${ENGINE_META[arbiter].label} arbitrates`
                    : `${ENGINE_META[engine].label}`}
                  {" \u00b7 "}
                  {speed} &middot; {length}
                </span>
                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="submit-btn flex items-center gap-2"
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
                      <span style={{ opacity: 0.5, fontSize: "0.7rem" }}>&thinsp;&#8984;&#9166;</span>
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
              <div className="pulse-dot" style={{ background: ENGINE_META.claude.color }} />
              <div className="pulse-dot" style={{ background: ENGINE_META.gemini.color }} />
              <div className="pulse-dot" style={{ background: ENGINE_META.chatgpt.color }} />
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

/* ── Response Card (single mode) ─────────────────────────────────────── */

function ResponseCard({ response }: { response: ProviderResponse }) {
  const meta = ENGINE_META[response.engine];
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    const newMessages = [...chatMessages, { role: "user" as const, text: userMsg }];
    setChatMessages(newMessages);
    setChatLoading(true);
    try {
      const history = [
        { role: "user" as const, content: response.text.length > 0 ? `[Previous context: I asked a question and you responded with the following]\n\n${response.text}` : "" },
        ...newMessages.map(m => ({ role: m.role, content: m.text })),
      ];
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine: response.engine, model: response.model, messages: history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setChatMessages([...newMessages, { role: "assistant", text: data.text }]);
    } catch {
      setChatMessages([...newMessages, { role: "assistant", text: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }

  return (
    <div
      className="glass card-accent p-6 mb-4"
      style={{
        borderLeftColor: meta.color,
        background: `linear-gradient(135deg, ${meta.color}06 0%, var(--bg-card) 40%)`,
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="w-8 h-8 flex items-center justify-center flex-shrink-0">
          <EngineLogo engine={response.engine} size={28} />
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

      {/* Continue Discussion */}
      {!chatOpen ? (
        <button
          onClick={() => setChatOpen(true)}
          className="continue-btn mt-4"
          style={{ "--engine-color": meta.color } as React.CSSProperties}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Continue discussion with {meta.label}
        </button>
      ) : (
        <div className="chat-continuation mt-4" style={{ borderColor: meta.color }}>
          {chatMessages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.role === "user" ? "chat-msg-user" : "chat-msg-assistant"}`}>
              {msg.role === "assistant" && (
                <span className="chat-msg-avatar"><EngineLogo engine={response.engine} size={18} /></span>
              )}
              <div className={`chat-msg-bubble ${msg.role === "user" ? "chat-msg-bubble-user" : "chat-msg-bubble-assistant"}`}>
                {msg.role === "assistant" ? (
                  <div className="prose-response text-sm leading-relaxed"><ReactMarkdown>{msg.text}</ReactMarkdown></div>
                ) : (
                  <p className="text-sm">{msg.text}</p>
                )}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="chat-msg chat-msg-assistant">
              <span className="chat-msg-avatar"><EngineLogo engine={response.engine} size={18} /></span>
              <div className="chat-msg-bubble chat-msg-bubble-assistant">
                <div className="flex gap-1.5 py-1">
                  <div className="pulse-dot" style={{ background: meta.color }} />
                  <div className="pulse-dot" style={{ background: meta.color, animationDelay: "0.2s" }} />
                  <div className="pulse-dot" style={{ background: meta.color, animationDelay: "0.4s" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
          <form onSubmit={handleContinue} className="chat-input-row">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={`Ask ${meta.label} a follow-up...`}
              className="chat-input"
              disabled={chatLoading}
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="chat-send-btn"
              style={{ background: chatLoading || !chatInput.trim() ? "var(--border)" : meta.color }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </form>
        </div>
      )}
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

  // Per-engine chat continuation state
  const [chatState, setChatState] = useState<Record<string, {
    open: boolean;
    messages: { role: "user" | "assistant"; text: string }[];
    input: string;
    loading: boolean;
  }>>({});
  const chatEndRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function getChatState(eng: string) {
    return chatState[eng] || { open: false, messages: [], input: "", loading: false };
  }

  function updateChatState(eng: string, patch: Partial<typeof chatState[string]>) {
    setChatState(prev => ({ ...prev, [eng]: { ...getChatState(eng), ...patch } }));
  }

  async function handleContinue(eng: Engine, model: string, originalText: string, e: React.FormEvent) {
    e.preventDefault();
    const cs = getChatState(eng);
    if (!cs.input.trim() || cs.loading) return;
    const userMsg = cs.input.trim();
    const newMessages = [...cs.messages, { role: "user" as const, text: userMsg }];
    updateChatState(eng, { input: "", messages: newMessages, loading: true });
    try {
      const history = [
        { role: "user" as const, content: `[Previous context: I asked a question and you responded with the following]\n\n${originalText}` },
        ...newMessages.map(m => ({ role: m.role, content: m.text })),
      ];
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine: eng, model, messages: history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      updateChatState(eng, { messages: [...newMessages, { role: "assistant", text: data.text }], loading: false });
    } catch {
      updateChatState(eng, { messages: [...newMessages, { role: "assistant", text: "Sorry, something went wrong. Please try again." }], loading: false });
    }
    setTimeout(() => chatEndRefs.current[eng]?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function resolveLabel(label: string) {
    return engineForLabel(label, result.responses);
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
          <EngineLogo engine={arb.bestEngine} size={26} />
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

      {/* Disagreements — engine logos instead of A/B/C circles */}
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
                  const em = resolveLabel(lbl);
                  return (
                    <div key={lbl} className="flex gap-3 text-sm">
                      <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                        {em.engine ? <EngineLogo engine={em.engine} size={22} /> : (
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: em.color, color: "#fff" }}>{lbl}</span>
                        )}
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
        const cs = getChatState(r.engine);
        return (
          <div key={r.engine} className="glass mb-4 overflow-hidden">
            <button
              onClick={() => onToggle(r.engine)}
              className="accordion-trigger w-full p-5 flex items-center gap-3 text-left"
              style={{ cursor: "pointer" }}
            >
              <span className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                <EngineLogo engine={r.engine} size={28} />
              </span>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{meta.label}</span>
              <span className="text-xs hide-mobile" style={{ color: "var(--text-tertiary)" }}>
                {r.model}
              </span>
              <span className="ml-auto text-xs hide-mobile" style={{ color: "var(--text-tertiary)" }}>
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

                {/* Continue Discussion */}
                {!cs.open ? (
                  <button
                    onClick={() => updateChatState(r.engine, { open: true })}
                    className="continue-btn mt-4"
                    style={{ "--engine-color": meta.color } as React.CSSProperties}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    Continue discussion with {meta.label}
                  </button>
                ) : (
                  <div className="chat-continuation mt-4" style={{ borderColor: meta.color }}>
                    {cs.messages.map((msg, i) => (
                      <div key={i} className={`chat-msg ${msg.role === "user" ? "chat-msg-user" : "chat-msg-assistant"}`}>
                        {msg.role === "assistant" && (
                          <span className="chat-msg-avatar"><EngineLogo engine={r.engine} size={18} /></span>
                        )}
                        <div className={`chat-msg-bubble ${msg.role === "user" ? "chat-msg-bubble-user" : "chat-msg-bubble-assistant"}`}>
                          {msg.role === "assistant" ? (
                            <div className="prose-response text-sm leading-relaxed"><ReactMarkdown>{msg.text}</ReactMarkdown></div>
                          ) : (
                            <p className="text-sm">{msg.text}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {cs.loading && (
                      <div className="chat-msg chat-msg-assistant">
                        <span className="chat-msg-avatar"><EngineLogo engine={r.engine} size={18} /></span>
                        <div className="chat-msg-bubble chat-msg-bubble-assistant">
                          <div className="flex gap-1.5 py-1">
                            <div className="pulse-dot" style={{ background: meta.color }} />
                            <div className="pulse-dot" style={{ background: meta.color, animationDelay: "0.2s" }} />
                            <div className="pulse-dot" style={{ background: meta.color, animationDelay: "0.4s" }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={el => { chatEndRefs.current[r.engine] = el; }} />
                    <form onSubmit={(e) => handleContinue(r.engine, r.model, r.text, e)} className="chat-input-row">
                      <input
                        value={cs.input}
                        onChange={(e) => updateChatState(r.engine, { input: e.target.value })}
                        placeholder={`Ask ${meta.label} a follow-up...`}
                        className="chat-input"
                        disabled={cs.loading}
                      />
                      <button
                        type="submit"
                        disabled={cs.loading || !cs.input.trim()}
                        className="chat-send-btn"
                        style={{ background: cs.loading || !cs.input.trim() ? "var(--border)" : meta.color }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      </button>
                    </form>
                  </div>
                )}
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

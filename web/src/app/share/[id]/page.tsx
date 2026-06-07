"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { Engine } from "@/lib/config";

/* ── Type mirrors ──────────────────────────────────────────────────── */

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

interface SavedSearch {
  id: string;
  prompt: string;
  mode: string;
  speed: string;
  length: string;
  engine?: string;
  arbiter?: string;
  result: QueryResult;
  created_at: string;
}

/* ── Constants ─────────────────────────────────────────────────────── */

const ENGINE_META: Record<Engine, { label: string; color: string }> = {
  claude: { label: "Claude", color: "#da7756" },
  gemini: { label: "Gemini", color: "#4285f4" },
  chatgpt: { label: "ChatGPT", color: "#10a37f" },
  perplexity: { label: "Perplexity", color: "#1a7f64" },
};

const RESPONSE_LABELS = ["A", "B", "C", "D"];

function engineForLabel(label: string, responses: ProviderResponse[]): { engine: Engine | null; color: string } {
  const idx = RESPONSE_LABELS.indexOf(label);
  if (idx >= 0 && idx < responses.length) {
    const eng = responses[idx].engine;
    return { engine: eng, color: ENGINE_META[eng].color };
  }
  return { engine: null, color: "var(--border)" };
}

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
      <path d="M24 4C24 15.05 15.05 24 4 24c11.05 0 20 8.95 20 20 0-11.05 8.95-20 20-20-11.05 0-20-8.95-20-20z" fill="url(#gemini-grad-share)"/>
      <defs>
        <linearGradient id="gemini-grad-share" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
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

function PerplexityLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.2L18 8v3h-3V8.5L12 6.8 9 8.5V11H6V8l6-3.8zM9 13v3.5l3 1.8 3-1.8V13h3v5l-6 3.8L6 18v-5h3z" fill="#1a7f64"/>
    </svg>
  );
}

function EngineLogo({ engine, size = 24 }: { engine: Engine; size?: number }) {
  switch (engine) {
    case "claude": return <ClaudeLogo size={size} />;
    case "gemini": return <GeminiLogo size={size} />;
    case "chatgpt": return <OpenAILogo size={size} />;
    case "perplexity": return <PerplexityLogo size={size} />;
    default: return null;
  }
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

/* ── Page ──────────────────────────────────────────────────────────── */

export default function SharePage() {
  const params = useParams();
  const id = params.id as string;
  const [search, setSearch] = useState<SavedSearch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedEngines, setExpandedEngines] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/searches/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Not found.");
        setSearch(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function toggleEngine(engine: string) {
    setExpandedEngines((prev) => {
      const next = new Set(prev);
      if (next.has(engine)) next.delete(engine);
      else next.add(engine);
      return next;
    });
  }

  function buildCopyText(): string {
    if (!search) return "";
    const r = search.result;
    const lines: string[] = [`# LLM Showdown Analysis`, "", `**Prompt:** ${search.prompt}`, ""];

    if (r.kind === "single") {
      const meta = ENGINE_META[r.response.engine];
      lines.push(`## ${meta.label}`, "", r.response.text);
    } else {
      const arb = r.arbitration;
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
            const em = engineForLabel(lbl, r.responses);
            const name = em.engine ? ENGINE_META[em.engine].label : lbl;
            lines.push(`- **${name}:** ${pos}`);
          });
          lines.push("", `*${d.assessment}*`, "");
        });
      }
      r.responses.forEach((resp) => {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex gap-2">
          <div className="pulse-dot" style={{ background: "var(--accent-blue)" }} />
          <div className="pulse-dot" style={{ background: "var(--accent-green)" }} />
          <div className="pulse-dot" style={{ background: "var(--accent-amber)" }} />
        </div>
      </div>
    );
  }

  if (error || !search) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass p-8 text-center">
          <p className="text-sm" style={{ color: "var(--accent-rose)" }}>
            {error ?? "Search not found."}
          </p>
        </div>
      </div>
    );
  }

  const result = search.result;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="pt-14 pb-8 px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
          Meta<span style={{ color: "var(--accent-blue)" }}>LLM</span>
        </h1>
        <p className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
          Shared analysis
        </p>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-6 pb-24">
        {/* Query info */}
        <div className="glass p-6 mb-6">
          <p className="text-xs font-medium tracking-wide mb-2" style={{ color: "var(--text-tertiary)" }}>
            Prompt
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
            {search.prompt}
          </p>
          <p className="text-xs mt-3" style={{ color: "var(--text-tertiary)" }}>
            {search.mode} &middot; {search.speed} speed &middot; {search.length} length
            {search.created_at && (
              <> &middot; {new Date(search.created_at).toLocaleDateString()}</>
            )}
          </p>
        </div>

        {/* Results */}
        <div className="stagger">
          {result.kind === "single" ? (
            <SharedResponseCard response={result.response} />
          ) : (
            <SharedBakeoffResults
              result={result}
              expandedEngines={expandedEngines}
              onToggle={toggleEngine}
            />
          )}
        </div>

        {/* Copy button — outside all cards */}
        <div className="flex justify-center mt-8 fade-in-up">
          <div className="action-bar flex items-center gap-2 px-4 py-2">
            <button
              onClick={handleCopy}
              className="px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2"
              style={{
                background: copied ? "var(--accent-green)" : "transparent",
                color: copied ? "#fff" : "var(--text-secondary)",
              }}
            >
              {copied ? (
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
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Shared Response Card ──────────────────────────────────────────── */

function SharedResponseCard({ response }: { response: ProviderResponse }) {
  const meta = ENGINE_META[response.engine];
  return (
    <div className="glass p-6 mb-4">
      <div className="flex items-center gap-3 mb-4">
        <EngineLogo engine={response.engine} size={22} />
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{meta.label}</span>
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

/* ── Shared Bakeoff Results ────────────────────────────────────────── */

function SharedBakeoffResults({
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

  function resolveLabel(label: string) {
    return engineForLabel(label, result.responses);
  }

  return (
    <>
      {arb.synthesis && (
        <>
          <div className="mb-3">
            <SectionLabel>Synthesised Answer</SectionLabel>
          </div>
          <div className="glass p-6 mb-6">
            <div className="prose-response text-sm leading-relaxed">
              <ReactMarkdown>{arb.synthesis}</ReactMarkdown>
            </div>
          </div>
        </>
      )}

      <div className="mt-10 mb-3">
        <SectionLabel>Bake-Off Winner</SectionLabel>
      </div>
      <div className="glass p-6 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <EngineLogo engine={arb.bestEngine} size={22} />
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {winnerMeta.label}
          </span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--accent-blue)" }}>
            Best
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {arb.bestRationale}
        </p>
      </div>

      {arb.consensus.length > 0 && (
        <>
          <div className="mt-10 mb-3">
            <SectionLabel>Consensus</SectionLabel>
          </div>
          <div className="glass p-6 mb-6">
            <ul className="space-y-3">
              {arb.consensus.map((point, i) => (
                <li key={i} className="flex gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <span className="flex-shrink-0 text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                    &bull;
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {arb.disagreements.length > 0 && (
        <>
          <div className="mt-10 mb-3">
            <SectionLabel>Disagreements</SectionLabel>
          </div>
          {arb.disagreements.map((d, i) => (
            <div
              key={i}
              className="glass p-6 mb-4"
            >
              <h4 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
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
              <EngineLogo engine={r.engine} size={20} />
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{meta.label}</span>
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
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ── Section Label ─────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-xs font-medium tracking-wide"
      style={{ color: "var(--text-tertiary)", letterSpacing: "0.05em" }}
    >
      {children}
    </h3>
  );
}

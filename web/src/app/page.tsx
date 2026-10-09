"use client";

import { useEffect, useRef, useState } from "react";
import { ENGINES, type Engine, type Length, type Mode, type Speed } from "@/lib/config";
import type { ProviderResponse } from "@/lib/providers/types";
import RunView, { LENGTH_LABEL, SPEED_LABEL, runSummaryText, type Run } from "@/components/RunView";
import { ENGINE_META } from "@/components/engines";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Settings { auto: boolean; mode: Mode; speed: Speed; length: Length; engine: Engine; arbiter: Engine }

const EXAMPLES = [
  "Is intermittent fasting effective for weight loss?",
  "Should I pay off my mortgage early or invest?",
  "What's the best way to learn a language as an adult?",
  "Explain how mRNA vaccines work",
];

function contextFor(run: Run): string {
  const answer = run.arbitration?.synthesis ?? Object.values(run.responses)[0]?.text ?? "";
  return `Earlier question: ${run.prompt}\n\nAnswer so far:\n${answer.slice(0, 6000)}`;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [settings, setSettings] = useState<Settings>({ auto: true, mode: "bakeoff", speed: "moderate", length: "moderate", engine: "claude", arbiter: "claude" });
  const [showSettings, setShowSettings] = useState(false);
  const [thread, setThread] = useState<Run[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [share, setShare] = useState<{ id: string; runs: number } | null>(null);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }));
  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  useEffect(() => { if (thread.length > 1) bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [thread.length]);

  async function ask() {
    const text = prompt.trim();
    if (!text || busy) return;
    const isFollowUp = thread.length > 0;
    const prev = thread[thread.length - 1];
    let { speed, length } = settings;
    let routeReason: string | undefined;

    if (settings.auto && !isFollowUp) {
      setBusy("Choosing the right settings…");
      try {
        const res = await fetch("/api/route", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: text }) });
        const d = await res.json();
        if (res.ok) { speed = d.speed; length = d.length; routeReason = d.reason; }
      } catch { /* fall back to current settings */ }
    } else if (isFollowUp) {
      speed = prev.speed; length = prev.length;
    }

    const mode = isFollowUp ? prev.mode : settings.mode;
    const engine = isFollowUp && prev.mode === "single" ? prev.engines[0] : settings.engine;
    const arbiter = isFollowUp ? prev.arbiter : settings.arbiter;
    const engines = mode === "single" ? [engine] : ENGINES;
    const run: Run = { prompt: text, mode, speed, length, arbiter, engines, responses: {}, errors: {}, status: "running", routeReason };
    const index = isFollowUp ? thread.length : 0;
    setThread((t) => (isFollowUp ? [...t, run] : [run]));
    if (!isFollowUp) setShare(null);
    setPrompt("");
    setBusy("Asking…");
    const update = (fn: (r: Run) => Run) => setThread((t) => t.map((r, i) => (i === index ? fn(r) : r)));
    const started = Date.now();

    try {
      const sent = isFollowUp ? `${contextFor(prev)}\n\nFollow-up question: ${text}` : text;
      const res = await fetch("/api/stream", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: sent, mode, speed, length, engine, arbiter, engines }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || "Request failed.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "engine") update((r) => ({ ...r, responses: { ...r.responses, [ev.response.engine]: ev.response } }));
          else if (ev.type === "engine_error") update((r) => ({ ...r, errors: { ...r.errors, [ev.engine]: ev.error } }));
          else if (ev.type === "arbitrating") update((r) => ({ ...r, status: "judging" }));
          else if (ev.type === "arbitration") update((r) => ({ ...r, arbitration: ev.arbitration, order: (ev.responses as ProviderResponse[]).map((x) => x.engine) }));
          else if (ev.type === "error") update((r) => ({ ...r, error: ev.error }));
        }
      }
      update((r) => ({ ...r, status: r.error ? "error" : "done", elapsed: (Date.now() - started) / 1000 }));
    } catch (err) {
      update((r) => ({ ...r, status: "error", error: err instanceof Error ? err.message : "Something went wrong." }));
    } finally {
      setBusy(null);
    }
  }

  async function shareLink(): Promise<string | null> {
    if (share && share.runs === thread.length) return `${location.origin}/share/${share.id}`;
    const last = thread[thread.length - 1];
    const res = await fetch("/api/searches", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: thread[0].prompt, mode: thread[0].mode, result: { kind: "thread", status: last.status }, thread }),
    });
    const d = await res.json();
    if (!res.ok) { flash(d.error || "Couldn't create link."); return null; }
    setShare({ id: d.id, runs: thread.length });
    return `${location.origin}/share/${d.id}`;
  }

  async function doShare(kind: "copy" | "native" | "text") {
    setMenu(false);
    if (kind === "text") {
      await navigator.clipboard.writeText(thread.map(runSummaryText).join("\n\n———\n\n"));
      return flash("Copied as text");
    }
    const url = await shareLink();
    if (!url) return;
    if (kind === "native" && navigator.share) {
      await navigator.share({ title: thread[0].prompt, text: `4 AIs on: ${thread[0].prompt}`, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      flash("Link copied");
    }
  }

  const done = thread.length > 0 && !busy;
  const autoSummary = settings.mode === "single"
    ? `${ENGINE_META[settings.engine].label} only`
    : `All 4 engines · judge: ${ENGINE_META[settings.arbiter].label}`;

  const composer = (followUp: boolean) => (
    <div className={`card composer ${followUp ? "followup" : ""}`}>
      <textarea
        value={prompt}
        placeholder={followUp ? "Ask a follow-up… every engine answers again and the judge re-rules" : "Ask anything…"}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
        rows={followUp ? 2 : 3}
      />
      <div className="row">
        {!followUp && (
          <button className="chip" onClick={() => setShowSettings(!showSettings)}>
            {settings.auto ? <>⚡ <b>Auto settings</b></> : <><b>{SPEED_LABEL[settings.speed]} · {LENGTH_LABEL[settings.length]}</b></>}
            <span>· {autoSummary}</span>
          </button>
        )}
        <span className="spacer" />
        {busy && <span className="runmeta" style={{ margin: 0 }}>{busy}</span>}
        <button className="btn primary" onClick={ask} disabled={!prompt.trim() || !!busy}>
          {followUp ? "Ask follow-up" : settings.mode === "single" ? "Ask" : "Ask all four"} ↵
        </button>
      </div>
      {!followUp && showSettings && (
        <div className="settings">
          <label className="toggle"><input type="checkbox" checked={settings.auto} onChange={(e) => set("auto", e.target.checked)} /> Let AI pick speed &amp; length</label>
          <label>Speed<select disabled={settings.auto} value={settings.speed} onChange={(e) => set("speed", e.target.value as Speed)}>
            {(Object.keys(SPEED_LABEL) as Speed[]).map((s) => <option key={s} value={s}>{SPEED_LABEL[s]}</option>)}</select></label>
          <label>Length<select disabled={settings.auto} value={settings.length} onChange={(e) => set("length", e.target.value as Length)}>
            {(Object.keys(LENGTH_LABEL) as Length[]).map((l) => <option key={l} value={l}>{LENGTH_LABEL[l]}</option>)}</select></label>
          <label>Who answers<select value={settings.mode === "single" ? settings.engine : "all"} onChange={(e) => {
            if (e.target.value === "all") set("mode", "bakeoff"); else setSettings((s) => ({ ...s, mode: "single", engine: e.target.value as Engine }));
          }}>
            <option value="all">All four engines</option>
            {ENGINES.map((e) => <option key={e} value={e}>{ENGINE_META[e].label} only</option>)}</select></label>
          {settings.mode === "bakeoff" && <label>Judge<select value={settings.arbiter} onChange={(e) => set("arbiter", e.target.value as Engine)}>
            {ENGINES.map((e) => <option key={e} value={e}>{ENGINE_META[e].label}</option>)}</select></label>}
        </div>
      )}
    </div>
  );

  return (
    <div className="wrap">
      <header className="topbar">
        <a className="logo" href="/" onClick={(e) => { e.preventDefault(); if (!busy) { setThread([]); setShare(null); } }}><i>M</i>MetaLLM</a>
        <nav>
          <ThemeToggle />
          {done && <button className="btn" onClick={() => setMenu(!menu)}>↗ Share</button>}
          {thread.length > 0 && <button className="btn" disabled={!!busy} onClick={() => { setThread([]); setShare(null); }}>New question</button>}
          {menu && (
            <div className="card menu">
              <button onClick={() => doShare("native")}>Send to WhatsApp / Messages<small>Opens your phone's share sheet</small></button>
              <button onClick={() => doShare("copy")}>Copy link<small>Includes follow-ups so far</small></button>
              <button onClick={() => doShare("text")}>Copy as text<small>Paste the summary anywhere</small></button>
            </div>
          )}
        </nav>
      </header>

      {thread.length === 0 ? (
        <div className="hero">
          <h1 className="serif">What do you want four AIs to weigh in on?</h1>
          <p>Claude, Gemini, ChatGPT and Perplexity answer in parallel. A blind judge compares them.</p>
          {composer(false)}
          <div className="examples">{EXAMPLES.map((x) => <button key={x} className="chip" onClick={() => setPrompt(x)}>{x}</button>)}</div>
        </div>
      ) : (
        <>
          {thread.map((run, i) => <RunView key={i} run={run} />)}
          {composer(true)}
          <div ref={bottom} />
        </>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

"use client";

import { Fragment, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ArbiterResult } from "@/lib/arbiter";
import type { Engine, Length, Mode, Speed } from "@/lib/config";
import type { ProviderResponse } from "@/lib/providers/types";
import { ENGINE_META, EngineLogo } from "./engines";

export interface Run {
  prompt: string;
  mode: Mode;
  speed: Speed;
  length: Length;
  arbiter: Engine;
  engines: Engine[];
  responses: Partial<Record<Engine, ProviderResponse>>;
  errors: Partial<Record<Engine, string>>;
  order?: Engine[];
  arbitration?: ArbiterResult;
  status: "running" | "judging" | "done" | "error";
  error?: string;
  elapsed?: number;
  routeReason?: string;
}

const SPEED_LABEL: Record<Speed, string> = { fast: "Fast", moderate: "Balanced", research: "Deep research" };
const LENGTH_LABEL: Record<Length, string> = { brief: "Brief", moderate: "Standard length", detailed: "Detailed", research: "Long report" };
export { SPEED_LABEL, LENGTH_LABEL };

/** Converts a pre-redesign saved record into a Run. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function legacyToRun(rec: any): Run {
  const r = rec.result ?? {};
  const list: ProviderResponse[] = r.kind === "single" ? [r.response] : (r.responses ?? []);
  const responses: Run["responses"] = {};
  list.forEach((x) => (responses[x.engine] = x));
  return {
    prompt: rec.prompt, mode: r.kind === "single" ? "single" : "bakeoff",
    speed: rec.speed ?? "moderate", length: rec.length ?? "moderate", arbiter: rec.arbiter ?? "claude",
    engines: list.map((x) => x.engine), responses, errors: {}, order: list.map((x) => x.engine),
    arbitration: r.arbitration, status: "done",
  };
}

export function runSummaryText(run: Run): string {
  const a = run.arbitration;
  if (a) {
    return [`Q: ${run.prompt}`, "", a.synthesis, "", `Best answer: ${ENGINE_META[a.bestEngine].label} — ${a.bestRationale}`,
      ...(a.consensus.length ? ["", "Where they agree:", ...a.consensus.map((c) => `• ${c}`)] : [])].join("\n");
  }
  const only = Object.values(run.responses)[0];
  return `Q: ${run.prompt}\n\n${only?.text ?? ""}`;
}

function labelToEngine(run: Run, label: string): Engine | undefined {
  return run.order?.[label.charCodeAt(0) - 65];
}

/** Replaces the judge's blind labels ("Response B") with engine names. */
function named(run: Run, text: string): string {
  return text.replace(/\b(Responses?|Answer) ([A-F])\b/g, (m, _w, l) => {
    const e = labelToEngine(run, l);
    return e ? ENGINE_META[e].label : m;
  }).replace(/\b([A-F]) and ([A-F])\b(?= (?:appear|reference|both|cite))/g, (m, a, b) => {
    const ea = labelToEngine(run, a), eb = labelToEngine(run, b);
    return ea && eb ? `${ENGINE_META[ea].label} and ${ENGINE_META[eb].label}` : m;
  });
}

function EngineStrip({ run }: { run: Run }) {
  return (
    <div className="engines" style={{ gridTemplateColumns: `repeat(${Math.min(run.engines.length, 4)}, 1fr)` }}>
      {run.engines.map((e) => {
        const r = run.responses[e];
        const err = run.errors[e];
        return (
          <div key={e} className="card eng">
            <div className="top"><EngineLogo engine={e} size={16} />{ENGINE_META[e].label}</div>
            <div className="meta">
              {r ? `${r.model.replace(/-\d{8}$/, "")} · ${r.latencySeconds.toFixed(1)}s` : err ? "Didn't answer" : "Writing…"}
            </div>
            <div className={`bar ${r ? "" : err ? "fail" : "live"}`}><span /></div>
          </div>
        );
      })}
    </div>
  );
}

function AnswerCard({ run, engine, best }: { run: Run; engine: Engine; best: boolean }) {
  const [open, setOpen] = useState(false);
  const r = run.responses[engine];
  if (!r) return null;
  return (
    <div className={`card ans ${open ? "open" : ""} ${best ? "win" : ""}`}>
      <div className="top"><EngineLogo engine={engine} size={16} />{ENGINE_META[engine].label}{best && <span className="best">BEST</span>}</div>
      <div className="md"><ReactMarkdown>{r.text}</ReactMarkdown></div>
      <button className="link" onClick={() => setOpen(!open)}>{open ? "Show less" : "Read full answer"}</button>
    </div>
  );
}

export default function RunView({ run }: { run: Run }) {
  const a = run.arbitration;
  const tokens = Object.values(run.responses).reduce((n, r) => n + (r ? r.inputTokens + r.outputTokens : 0), 0);
  const answered = run.engines.filter((e) => run.responses[e]);
  const failed = run.engines.filter((e) => run.errors[e]);
  const order = run.order ?? answered;

  return (
    <div className="run">
      <h2 className="serif question">{run.prompt}</h2>
      <EngineStrip run={run} />

      {run.status === "judging" && <div className="card status"><span className="spinner" />{ENGINE_META[run.arbiter].label} is judging the answers blind…</div>}
      {run.error && <div className="card errorbox">{run.error}</div>}

      {run.mode === "single" && answered[0] && (
        <div className="card verdict md"><ReactMarkdown>{run.responses[answered[0]]!.text}</ReactMarkdown></div>
      )}

      {a && (
        <>
          <section className="card verdict">
            <div className="vhead">
              {a.consensus.length > 0 && <span className="pill good">{a.consensus.length} points of agreement</span>}
              {a.disagreements.length > 0 && <span className="pill warn">{a.disagreements.length} disagreement{a.disagreements.length > 1 ? "s" : ""}</span>}
              <span className="pill">Judged blind by {ENGINE_META[run.arbiter].label}</span>
            </div>
            <div className="md synthesis"><ReactMarkdown>{named(run, a.synthesis)}</ReactMarkdown></div>
            <div className="winner">
              <EngineLogo engine={a.bestEngine} size={18} />
              <div><b>Best answer: {ENGINE_META[a.bestEngine].label}.</b> {named(run, a.bestRationale)}</div>
            </div>
          </section>

          {a.consensus.length > 0 && (
            <section><p className="label">Where they agree</p>
              <div className="card cons"><ul>{a.consensus.map((c, i) => <li key={i}><span className="check">✓</span>{named(run, c)}</li>)}</ul></div>
            </section>
          )}

          {a.disagreements.length > 0 && (
            <section><p className="label">Where they disagree</p>
              <div className="card dgrid"><table>
                <thead><tr><th />{order.map((e) => <th key={e}><span className="dot" style={{ background: ENGINE_META[e].color }} /> {ENGINE_META[e].label}</th>)}</tr></thead>
                <tbody>{a.disagreements.map((d, i) => (
                  <Fragment key={i}>
                    <tr><td className="topic">{d.topic}</td>
                      {order.map((e, j) => <td key={e}>{d.positions[String.fromCharCode(65 + j)] ?? "—"}</td>)}</tr>
                    <tr><td /><td colSpan={order.length} className="ruling">Judge: {named(run, d.assessment)}</td></tr>
                  </Fragment>
                ))}</tbody>
              </table></div>
              <div className="dcards">{a.disagreements.map((d, i) => (
                <div key={i} className="card">
                  <p className="topic">{d.topic}</p>
                  {Object.entries(d.positions).map(([lbl, pos]) => {
                    const e = labelToEngine(run, lbl);
                    return <p key={lbl} className="pos"><b>{e ? ENGINE_META[e].label : lbl}:</b> {pos}</p>;
                  })}
                  <p className="ruling">Judge: {named(run, d.assessment)}</p>
                </div>
              ))}</div>
            </section>
          )}
        </>
      )}

      {run.mode === "bakeoff" && answered.length > 0 && (
        <section><p className="label">{a ? "All answers" : "Answers so far"}</p>
          <div className="answers">{order.filter((e) => run.responses[e]).map((e) => <AnswerCard key={e} run={run} engine={e} best={a?.bestEngine === e} />)}</div>
        </section>
      )}

      {run.status === "done" && (
        <p className="runmeta">
          {answered.length} engine{answered.length > 1 ? "s" : ""} · {SPEED_LABEL[run.speed]} · {LENGTH_LABEL[run.length]}
          {run.elapsed ? ` · ${run.elapsed.toFixed(1)}s` : ""} · {(tokens / 1000).toFixed(1)}k tokens
          {failed.length > 0 && ` · ${failed.map((e) => ENGINE_META[e].label).join(", ")} didn't answer`}
          {run.routeReason && <><br />Settings chosen automatically: {run.routeReason}</>}
        </p>
      )}
    </div>
  );
}

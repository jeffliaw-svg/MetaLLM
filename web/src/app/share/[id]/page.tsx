"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import RunView, { legacyToRun, type Run } from "@/components/RunView";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function SharePage() {
  const { id } = useParams<{ id: string }>();
  const [thread, setThread] = useState<Run[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/searches/${id}`)
      .then(async (res) => {
        const rec = await res.json();
        if (!res.ok) throw new Error(rec.error || "Search not found.");
        setThread(Array.isArray(rec.thread) ? rec.thread : [legacyToRun(rec)]);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  return (
    <div className="wrap">
      <header className="topbar">
        <a className="logo" href="/"><i>P</i>PostCogs</a>
        <nav><ThemeToggle /><a className="btn primary" href="/">Ask your own question</a></nav>
      </header>
      {error && <p className="center">{error === "Not found" ? "Search not found." : error}</p>}
      {!thread && !error && <p className="center">Loading…</p>}
      {thread?.map((run, i) => <RunView key={i} run={run} />)}
    </div>
  );
}

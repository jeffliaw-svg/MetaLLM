import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { getThoughtByShareToken } from "@/lib/thoughts";

export const dynamic = "force-dynamic";

export default async function SharedThoughtPage({
  params,
}: {
  params: { token: string };
}) {
  const thought = await getThoughtByShareToken(params.token);

  if (!thought || thought.status !== "answered") notFound();

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="wordmark">
            MetaLLM
          </Link>
          <span className="faint" style={{ fontSize: 13, marginLeft: "auto" }}>
            Shared answer
          </span>
        </div>
      </header>

      <main className="shell rise" style={{ paddingTop: 32, paddingBottom: 96 }}>
        <h1 className="h1">{thought.resolved_prompt}</h1>

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

        <p
          className="faint"
          style={{
            fontSize: 13,
            marginTop: 48,
            paddingTop: 20,
            borderTop: "1px solid var(--border)",
          }}
        >
          Synthesised from multiple AI engines.
        </p>
      </main>
    </>
  );
}

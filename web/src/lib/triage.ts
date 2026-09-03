/**
 * Triage — classifies a captured thought before any expensive work happens.
 *
 * Runs on Haiku and returns in about a second, which is what makes
 * clarification possible at capture time: the Shortcut is still open, so we
 * can ask the one question that matters while the user is standing there,
 * rather than stranding the thought in an "awaiting reply" state.
 */

import Anthropic from "@anthropic-ai/sdk";
import { DEPTH_PRESETS, isDepth, type Depth, type Engine } from "./config";
import { parseJsonLoose } from "./json";

const TRIAGE_MODEL = "claude-haiku-4-5-20251001";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const TRIAGE_SYSTEM = `You are the triage step of a personal question-answering system. The user speaks thoughts aloud as they occur, often while driving or walking. You decide how much effort each one deserves and whether one clarifying question would materially improve the answer.

Classify the thought into exactly one depth:

- "quick" — a factual lookup with essentially one correct answer. Store hours, unit conversions, definitions, who won something, what a word means, current price of a thing. Answerable in a sentence or two.
- "standard" — needs explanation, judgement, or a few paragraphs, but is not high-stakes or contested. How something works, what the tradeoffs are, how to do a task, why something happened.
- "research" — consequential, contested, or genuinely open-ended. Financial and medical decisions, anything where credible sources disagree, anything the user will act on in a costly or hard-to-reverse way, anything asking for a recommendation between real alternatives.

Then decide about clarification. Set "needs_clarification" to true ONLY when a single short question would substantially change the answer — a missing location for something location-dependent, an ambiguous referent, a missing constraint that flips the recommendation. Default to false. The entire value of this system is that the user does not have to stop and interact, so a clarifying question must earn its interruption. Never ask for something you could reasonably assume and state.

If you do ask, phrase the question for the ear: short, plain, one sentence, no preamble. It will be spoken aloud by Siri.

Also write a "title": at most six words, no trailing punctuation, suitable as a row label in a list. Capitalise as a normal sentence.

And write "resolved_prompt": the thought rewritten as a clear, self-contained question for a research assistant. Fix dictation errors and dropped words. Preserve the user's actual intent and any specifics they gave. Do not expand scope or add requirements they did not express.

Return ONLY valid JSON:
{
  "depth": "quick" | "standard" | "research",
  "title": "Short label",
  "resolved_prompt": "The cleaned-up question.",
  "needs_clarification": false,
  "clarifying_question": null
}`;

export interface TriageResult {
  depth: Depth;
  title: string;
  resolvedPrompt: string;
  needsClarification: boolean;
  clarifyingQuestion: string | null;
  engines: Engine[];
  arbiter: Engine;
  arbitrate: boolean;
}

interface TriageJson {
  depth?: string;
  title?: string;
  resolved_prompt?: string;
  needs_clarification?: boolean;
  clarifying_question?: string | null;
}

/**
 * @param rawText     what was dictated
 * @param clarification  the user's answer to a previous clarifying question,
 *                       if this is the second pass
 */
export async function triage(
  rawText: string,
  clarification?: string
): Promise<TriageResult> {
  const userContent = clarification
    ? `Thought: ${rawText}\n\nThe user was asked a clarifying question and replied: ${clarification}\n\nDo not ask anything further — set needs_clarification to false and fold their reply into resolved_prompt.`
    : `Thought: ${rawText}`;

  let json: TriageJson | null = null;

  try {
    const response = await getClient().messages.create({
      model: TRIAGE_MODEL,
      max_tokens: 500,
      system: TRIAGE_SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    json = parseJsonLoose<TriageJson>(text);
  } catch {
    // Fall through to defaults below. Triage failing must never lose a
    // thought — a mis-routed answer is far better than a dropped one.
    json = null;
  }

  const depth: Depth = isDepth(json?.depth) ? json.depth : "standard";
  const preset = DEPTH_PRESETS[depth];

  // A second pass never asks again, regardless of what the model returns.
  const needsClarification =
    !clarification &&
    json?.needs_clarification === true &&
    typeof json.clarifying_question === "string" &&
    json.clarifying_question.trim().length > 0;

  const resolvedBase =
    typeof json?.resolved_prompt === "string" && json.resolved_prompt.trim()
      ? json.resolved_prompt.trim()
      : rawText;

  return {
    depth,
    title: cleanTitle(json?.title) ?? fallbackTitle(rawText),
    resolvedPrompt: resolvedBase,
    needsClarification,
    clarifyingQuestion: needsClarification
      ? (json!.clarifying_question as string).trim()
      : null,
    engines: preset.engines,
    arbiter: preset.arbiter,
    arbitrate: preset.arbitrate,
  };
}

function cleanTitle(title: unknown): string | null {
  if (typeof title !== "string") return null;
  const trimmed = title.trim().replace(/[.?!]+$/, "");
  return trimmed.length > 0 ? trimmed.slice(0, 80) : null;
}

function fallbackTitle(rawText: string): string {
  const words = rawText.trim().split(/\s+/).slice(0, 6).join(" ");
  return words.length > 0 ? words.slice(0, 80) : "Untitled thought";
}

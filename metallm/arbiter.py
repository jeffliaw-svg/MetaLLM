"""Arbiter — sends all responses to a chosen engine for evaluation."""

from __future__ import annotations

import json
from dataclasses import dataclass

from metallm.config import LENGTH_PRESETS, Engine, Length, Speed
from metallm.providers.base import BaseProvider, ProviderResponse

# Labels used to anonymise provider responses for the arbiter.
_LABELS = ["A", "B", "C"]

ARBITER_SYSTEM = """\
You are an impartial arbiter. You will receive three responses to the same \
user query, labelled A, B, and C. You do NOT know which AI produced which \
response — evaluate them purely on merit.

Return your analysis as JSON with exactly these keys:
{
  "best": "A" | "B" | "C",
  "best_rationale": "Why this response is best (2-3 sentences).",
  "consensus": ["Point of agreement 1", "Point of agreement 2", ...],
  "disagreements": [
    {
      "topic": "Short description of the area of disagreement",
      "positions": {"A": "...", "B": "...", "C": "..."},
      "assessment": "Your view on which position is most likely correct and why."
    }
  ],
  "synthesis": "A final, synthesised answer that incorporates the best elements of all three responses."
}

Return ONLY valid JSON. No markdown fences, no commentary outside the JSON.\
"""


@dataclass
class Disagreement:
    topic: str
    positions: dict[str, str]
    assessment: str


@dataclass
class ArbiterResult:
    best_label: str
    best_engine: Engine
    best_rationale: str
    consensus: list[str]
    disagreements: list[Disagreement]
    synthesis: str
    raw_json: dict


def _build_arbiter_prompt(prompt: str, responses: list[ProviderResponse]) -> str:
    """Build the user-message sent to the arbiter engine."""
    sections = [f"## Original query\n\n{prompt}\n"]
    for label, resp in zip(_LABELS, responses):
        sections.append(f"## Response {label}\n\n{resp.text}\n")
    return "\n".join(sections)


async def arbitrate(
    prompt: str,
    responses: list[ProviderResponse],
    arbiter_engine: Engine,
) -> ArbiterResult:
    """Run arbitration on the collected responses."""
    # Lazy import to avoid circular deps.
    from metallm.providers.chatgpt import ChatGPTProvider
    from metallm.providers.claude import ClaudeProvider
    from metallm.providers.gemini import GeminiProvider

    provider_map: dict[Engine, type[BaseProvider]] = {
        Engine.CLAUDE: ClaudeProvider,
        Engine.GEMINI: GeminiProvider,
        Engine.CHATGPT: ChatGPTProvider,
    }

    provider = provider_map[arbiter_engine]()
    arbiter_prompt = _build_arbiter_prompt(prompt, responses)

    # Arbiter always uses research speed + research length for maximum quality.
    # Override the system instruction to our arbiter prompt via a small wrapper.
    arbiter_response = await _query_arbiter(provider, arbiter_prompt)

    # Parse the JSON response.
    data = json.loads(arbiter_response.text)

    # Map the winning label back to the actual engine.
    label_to_engine = {label: resp.engine for label, resp in zip(_LABELS, responses)}
    best_label = data["best"]

    return ArbiterResult(
        best_label=best_label,
        best_engine=label_to_engine[best_label],
        best_rationale=data.get("best_rationale", ""),
        consensus=data.get("consensus", []),
        disagreements=[
            Disagreement(
                topic=d["topic"],
                positions=d["positions"],
                assessment=d["assessment"],
            )
            for d in data.get("disagreements", [])
        ],
        synthesis=data.get("synthesis", ""),
        raw_json=data,
    )


async def _query_arbiter(provider: BaseProvider, prompt: str) -> ProviderResponse:
    """Query the arbiter engine with our special system prompt.

    We override the provider's normal system prompt by injecting the arbiter
    system instruction into the prompt itself, and use research-tier settings.
    """
    full_prompt = f"{ARBITER_SYSTEM}\n\n---\n\n{prompt}"
    return await provider.query(full_prompt, Speed.RESEARCH, Length.RESEARCH)

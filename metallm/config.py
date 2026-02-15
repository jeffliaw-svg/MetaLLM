"""Configuration: modes, speed/length presets, model mappings."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


# ── Modes ────────────────────────────────────────────────────────────────

class Mode(str, Enum):
    SINGLE = "single"    # One engine, direct answer
    BAKEOFF = "bakeoff"  # All three engines + arbitration


# ── Speed tiers ──────────────────────────────────────────────────────────

class Speed(str, Enum):
    FAST = "fast"
    MODERATE = "moderate"
    RESEARCH = "research"


# ── Length tiers ─────────────────────────────────────────────────────────

class Length(str, Enum):
    QUICK = "quick"
    MODERATE = "moderate"
    DETAILED = "detailed"
    RESEARCH = "research"
    MEMO = "memo"


# ── Engine names ─────────────────────────────────────────────────────────

class Engine(str, Enum):
    CLAUDE = "claude"
    GEMINI = "gemini"
    CHATGPT = "chatgpt"


# ── Model mappings per speed tier ────────────────────────────────────────

MODEL_MAP: dict[Engine, dict[Speed, str]] = {
    Engine.CLAUDE: {
        Speed.FAST: "claude-haiku-4-5-20251001",
        Speed.MODERATE: "claude-sonnet-4-5-20250929",
        Speed.RESEARCH: "claude-opus-4-6",
    },
    Engine.GEMINI: {
        Speed.FAST: "gemini-2.0-flash",
        Speed.MODERATE: "gemini-2.5-pro",
        Speed.RESEARCH: "gemini-2.5-pro",  # with thinking budget
    },
    Engine.CHATGPT: {
        Speed.FAST: "gpt-4o-mini",
        Speed.MODERATE: "gpt-4o",
        Speed.RESEARCH: "o3",
    },
}


# ── Length → max_tokens + system instruction ─────────────────────────────

@dataclass(frozen=True)
class LengthPreset:
    max_tokens: int
    system_instruction: str


LENGTH_PRESETS: dict[Length, LengthPreset] = {
    Length.QUICK: LengthPreset(
        max_tokens=200,
        system_instruction="Answer in 1-2 sentences. Be direct and concise.",
    ),
    Length.MODERATE: LengthPreset(
        max_tokens=600,
        system_instruction="Provide a clear, concise answer in a few paragraphs.",
    ),
    Length.DETAILED: LengthPreset(
        max_tokens=1500,
        system_instruction="Provide a thorough answer with examples and explanation.",
    ),
    Length.RESEARCH: LengthPreset(
        max_tokens=4000,
        system_instruction=(
            "Provide comprehensive analysis. Include evidence, multiple perspectives, "
            "and citations where possible."
        ),
    ),
    Length.MEMO: LengthPreset(
        max_tokens=8000,
        system_instruction=(
            "Write a structured memo with an executive summary, analysis sections, "
            "supporting evidence, and actionable recommendations."
        ),
    ),
}


# ── Query settings ───────────────────────────────────────────────────────

@dataclass
class QuerySettings:
    """Fully resolved settings for a single query run."""

    mode: Mode
    speed: Speed
    length: Length
    engine: Optional[Engine] = None    # required for single mode
    arbiter: Optional[Engine] = None   # required for bakeoff mode

    def __post_init__(self) -> None:
        if self.mode == Mode.SINGLE and self.engine is None:
            raise ValueError("Single mode requires --engine to be set.")
        if self.mode == Mode.BAKEOFF and self.arbiter is None:
            raise ValueError("Bake-off mode requires --arbiter to be set.")

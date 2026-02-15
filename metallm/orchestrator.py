"""Orchestrator — dispatches queries in single or bake-off mode."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

from metallm.arbiter import ArbiterResult, arbitrate
from metallm.config import Engine, Length, Mode, QuerySettings, Speed
from metallm.providers.base import BaseProvider, ProviderResponse
from metallm.providers.chatgpt import ChatGPTProvider
from metallm.providers.claude import ClaudeProvider
from metallm.providers.gemini import GeminiProvider

# ── Provider registry ────────────────────────────────────────────────────

_PROVIDERS: dict[Engine, type[BaseProvider]] = {
    Engine.CLAUDE: ClaudeProvider,
    Engine.GEMINI: GeminiProvider,
    Engine.CHATGPT: ChatGPTProvider,
}


def _get_provider(engine: Engine) -> BaseProvider:
    return _PROVIDERS[engine]()


# ── Result containers ────────────────────────────────────────────────────

@dataclass
class SingleResult:
    response: ProviderResponse


@dataclass
class BakeoffResult:
    responses: list[ProviderResponse]
    arbitration: ArbiterResult


# ── Public API ───────────────────────────────────────────────────────────

async def run(prompt: str, settings: QuerySettings) -> SingleResult | BakeoffResult:
    """Execute a query according to the given settings."""
    if settings.mode == Mode.SINGLE:
        return await _run_single(prompt, settings)
    return await _run_bakeoff(prompt, settings)


async def _run_single(prompt: str, settings: QuerySettings) -> SingleResult:
    assert settings.engine is not None
    provider = _get_provider(settings.engine)
    response = await provider.query(prompt, settings.speed, settings.length)
    return SingleResult(response=response)


async def _run_bakeoff(prompt: str, settings: QuerySettings) -> BakeoffResult:
    assert settings.arbiter is not None

    # Fan out to all three providers in parallel.
    providers = [_get_provider(engine) for engine in Engine]
    tasks = [provider.query(prompt, settings.speed, settings.length) for provider in providers]
    responses: list[ProviderResponse] = await asyncio.gather(*tasks, return_exceptions=False)

    # Arbitrate.
    arbitration = await arbitrate(
        prompt=prompt,
        responses=responses,
        arbiter_engine=settings.arbiter,
    )

    return BakeoffResult(responses=responses, arbitration=arbitration)

"""Anthropic / Claude provider adapter."""

from __future__ import annotations

import anthropic

from metallm.config import LENGTH_PRESETS, MODEL_MAP, Engine, Length, Speed
from metallm.providers.base import BaseProvider, ProviderResponse


class ClaudeProvider(BaseProvider):
    engine = Engine.CLAUDE

    def __init__(self) -> None:
        # Reads ANTHROPIC_API_KEY from env automatically.
        self._client = anthropic.AsyncAnthropic()

    async def query(self, prompt: str, speed: Speed, length: Length) -> ProviderResponse:
        model = MODEL_MAP[self.engine][speed]
        preset = LENGTH_PRESETS[length]

        t0 = self._timer()
        message = await self._client.messages.create(
            model=model,
            max_tokens=preset.max_tokens,
            system=preset.system_instruction,
            messages=[{"role": "user", "content": prompt}],
        )
        latency = self._timer() - t0

        text = "".join(
            block.text for block in message.content if block.type == "text"
        )

        return ProviderResponse(
            engine=self.engine,
            model=model,
            text=text,
            latency_seconds=round(latency, 2),
            input_tokens=message.usage.input_tokens,
            output_tokens=message.usage.output_tokens,
        )

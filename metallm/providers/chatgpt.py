"""OpenAI / ChatGPT provider adapter."""

from __future__ import annotations

import openai

from metallm.config import LENGTH_PRESETS, MODEL_MAP, Engine, Length, Speed
from metallm.providers.base import BaseProvider, ProviderResponse


class ChatGPTProvider(BaseProvider):
    engine = Engine.CHATGPT

    def __init__(self) -> None:
        # Reads OPENAI_API_KEY from env automatically.
        self._client = openai.AsyncOpenAI()

    async def query(self, prompt: str, speed: Speed, length: Length) -> ProviderResponse:
        model = MODEL_MAP[self.engine][speed]
        preset = LENGTH_PRESETS[length]

        t0 = self._timer()
        response = await self._client.chat.completions.create(
            model=model,
            max_completion_tokens=preset.max_tokens,
            messages=[
                {"role": "system", "content": preset.system_instruction},
                {"role": "user", "content": prompt},
            ],
        )
        latency = self._timer() - t0

        choice = response.choices[0]
        usage = response.usage

        return ProviderResponse(
            engine=self.engine,
            model=model,
            text=choice.message.content or "",
            latency_seconds=round(latency, 2),
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
        )

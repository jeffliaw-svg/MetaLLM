"""Google Generative AI / Gemini provider adapter."""

from __future__ import annotations

import os

from google import genai
from google.genai import types

from metallm.config import LENGTH_PRESETS, MODEL_MAP, Engine, Length, Speed
from metallm.providers.base import BaseProvider, ProviderResponse


class GeminiProvider(BaseProvider):
    engine = Engine.GEMINI

    def __init__(self) -> None:
        api_key = os.environ.get("GOOGLE_API_KEY", "")
        self._client = genai.Client(api_key=api_key)

    async def query(self, prompt: str, speed: Speed, length: Length) -> ProviderResponse:
        model = MODEL_MAP[self.engine][speed]
        preset = LENGTH_PRESETS[length]

        config = types.GenerateContentConfig(
            system_instruction=preset.system_instruction,
            max_output_tokens=preset.max_tokens,
        )

        t0 = self._timer()
        response = await self._client.aio.models.generate_content(
            model=model,
            contents=prompt,
            config=config,
        )
        latency = self._timer() - t0

        text = response.text or ""
        usage_meta = response.usage_metadata

        return ProviderResponse(
            engine=self.engine,
            model=model,
            text=text,
            latency_seconds=round(latency, 2),
            input_tokens=getattr(usage_meta, "prompt_token_count", 0) or 0,
            output_tokens=getattr(usage_meta, "candidates_token_count", 0) or 0,
        )

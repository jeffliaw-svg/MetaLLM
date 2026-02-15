"""Abstract base for AI provider adapters."""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from metallm.config import Engine, Length, Speed


@dataclass
class ProviderResponse:
    """Standardised response from any provider."""

    engine: Engine
    model: str
    text: str
    latency_seconds: float
    input_tokens: int = 0
    output_tokens: int = 0
    metadata: dict = field(default_factory=dict)


class BaseProvider(ABC):
    """Every provider adapter implements this interface."""

    engine: Engine

    @abstractmethod
    async def query(self, prompt: str, speed: Speed, length: Length) -> ProviderResponse:
        """Send a prompt and return a standardised response."""

    @staticmethod
    def _timer() -> float:
        return time.perf_counter()

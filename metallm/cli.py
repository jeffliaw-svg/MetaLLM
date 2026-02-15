"""CLI entry point for MetaLLM."""

from __future__ import annotations

import asyncio
import sys

import click
from dotenv import load_dotenv
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.table import Table

from metallm.config import Engine, Length, Mode, QuerySettings, Speed
from metallm.orchestrator import BakeoffResult, SingleResult, run

load_dotenv()

console = Console()


# ── Helpers ──────────────────────────────────────────────────────────────

def _engine_choice(value: str) -> Engine:
    return Engine(value.lower())


def _render_single(result: SingleResult) -> None:
    r = result.response
    console.print(
        Panel(
            Markdown(r.text),
            title=f"[bold]{r.engine.value}[/bold]  ({r.model})",
            subtitle=f"{r.latency_seconds}s · {r.input_tokens}+{r.output_tokens} tokens",
            border_style="cyan",
        )
    )


def _render_bakeoff(result: BakeoffResult) -> None:
    labels = ["A", "B", "C"]

    # ── Individual responses ─────────────────────────────────────────────
    console.rule("[bold]Responses[/bold]")
    for label, r in zip(labels, result.responses):
        colour = {"A": "blue", "B": "green", "C": "yellow"}[label]
        console.print(
            Panel(
                Markdown(r.text),
                title=f"[bold]Response {label}[/bold]  ({r.engine.value} · {r.model})",
                subtitle=f"{r.latency_seconds}s · {r.input_tokens}+{r.output_tokens} tokens",
                border_style=colour,
            )
        )

    arb = result.arbitration

    # ── Verdict ──────────────────────────────────────────────────────────
    console.rule("[bold]Arbiter Verdict[/bold]")
    console.print(
        f"\n[bold green]Best response:[/bold green] "
        f"[bold]{arb.best_label}[/bold] ({arb.best_engine.value})\n"
    )
    console.print(f"[dim]{arb.best_rationale}[/dim]\n")

    # ── Consensus ────────────────────────────────────────────────────────
    if arb.consensus:
        console.rule("[bold]Consensus[/bold]")
        for point in arb.consensus:
            console.print(f"  • {point}")
        console.print()

    # ── Disagreements ────────────────────────────────────────────────────
    if arb.disagreements:
        console.rule("[bold]Disagreements[/bold]")
        for d in arb.disagreements:
            table = Table(title=d.topic, show_header=True, header_style="bold")
            table.add_column("Response")
            table.add_column("Position")
            for lbl, pos in d.positions.items():
                table.add_row(lbl, pos)
            console.print(table)
            console.print(f"  [italic]Assessment:[/italic] {d.assessment}\n")

    # ── Synthesis ────────────────────────────────────────────────────────
    if arb.synthesis:
        console.rule("[bold]Synthesised Answer[/bold]")
        console.print(Markdown(arb.synthesis))
        console.print()


# ── CLI ──────────────────────────────────────────────────────────────────

@click.command()
@click.argument("prompt", required=False)
@click.option(
    "--mode", "-m",
    type=click.Choice(["single", "bakeoff"], case_sensitive=False),
    default="bakeoff",
    help="Run a single engine or bake-off all three.",
)
@click.option(
    "--speed", "-s",
    type=click.Choice(["fast", "moderate", "research"], case_sensitive=False),
    default="moderate",
    help="Speed tier — controls model selection.",
)
@click.option(
    "--length", "-l",
    type=click.Choice(["quick", "moderate", "detailed", "research", "memo"], case_sensitive=False),
    default="moderate",
    help="Response length tier.",
)
@click.option(
    "--engine", "-e",
    type=click.Choice(["claude", "gemini", "chatgpt"], case_sensitive=False),
    default=None,
    help="Engine for single mode.",
)
@click.option(
    "--arbiter", "-a",
    type=click.Choice(["claude", "gemini", "chatgpt"], case_sensitive=False),
    default=None,
    help="Arbiter engine for bake-off mode.",
)
def main(
    prompt: str | None,
    mode: str,
    speed: str,
    length: str,
    engine: str | None,
    arbiter: str | None,
) -> None:
    """MetaLLM — query one or all AI engines, with optional arbitration."""

    # Resolve prompt: argument, stdin, or interactive.
    if prompt is None:
        if not sys.stdin.isatty():
            prompt = sys.stdin.read().strip()
        else:
            prompt = console.input("[bold]Enter your query:[/bold] ")

    if not prompt:
        console.print("[red]No prompt provided.[/red]")
        raise SystemExit(1)

    resolved_mode = Mode(mode.lower())

    # Default arbiter to claude if not specified in bakeoff mode.
    if resolved_mode == Mode.BAKEOFF and arbiter is None:
        arbiter = "claude"

    # Default engine to claude if not specified in single mode.
    if resolved_mode == Mode.SINGLE and engine is None:
        engine = "claude"

    settings = QuerySettings(
        mode=resolved_mode,
        speed=Speed(speed.lower()),
        length=Length(length.lower()),
        engine=Engine(engine) if engine else None,
        arbiter=Engine(arbiter) if arbiter else None,
    )

    # Show what we're doing.
    if settings.mode == Mode.SINGLE:
        console.print(
            f"\n[bold]Mode:[/bold] single · "
            f"[bold]Engine:[/bold] {settings.engine.value} · "  # type: ignore[union-attr]
            f"[bold]Speed:[/bold] {settings.speed.value} · "
            f"[bold]Length:[/bold] {settings.length.value}\n"
        )
    else:
        console.print(
            f"\n[bold]Mode:[/bold] bake-off · "
            f"[bold]Arbiter:[/bold] {settings.arbiter.value} · "  # type: ignore[union-attr]
            f"[bold]Speed:[/bold] {settings.speed.value} · "
            f"[bold]Length:[/bold] {settings.length.value}\n"
        )

    # Run.
    result = asyncio.run(run(prompt, settings))

    if isinstance(result, SingleResult):
        _render_single(result)
    else:
        _render_bakeoff(result)


if __name__ == "__main__":
    main()

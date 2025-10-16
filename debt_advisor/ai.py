"""Integration with OpenAI to produce tailored payoff guidance."""

from __future__ import annotations

import os
from typing import List, Optional

from dotenv import load_dotenv
from openai import OpenAI

from .planner import PaymentSummary

# Load environment variables from a local .env file when available so both the
# CLI and Netlify function can reuse the same credentials during development.
load_dotenv()


class AdviceGenerationError(RuntimeError):
    """Raised when the AI advisor could not return meaningful guidance."""


def _default_model() -> str:
    return os.getenv("OPENAI_MODEL", "gpt-4.1-mini")


def build_advice_prompt(summary: PaymentSummary, *, max_schedule_months: int = 6) -> str:
    """Create a concise prompt describing the payoff plan for the AI model."""

    head = [
        "You are coaching someone who wants to become debt free.",
        "Craft a concise, encouraging plan to help them stay on track.",
        "Highlight quick wins, key risks, and how to use any extra cash effectively.",
        "Offer budget or behavioral tips when appropriate, and be motivational without promising unrealistic outcomes.",
        "",
        "Here is their current payoff projection:",
        f"Strategy: {summary.strategy}",
        f"Months to payoff: {summary.months_to_payoff}",
        f"Total interest paid: ${summary.total_interest_paid:,.2f}",
        f"Total amount paid: ${summary.total_amount_paid:,.2f}",
        f"Recommended monthly payment: ${summary.recommended_monthly_payment:,.2f}",
        f"Approximate daily payment: ${summary.approximate_daily_payment:,.2f}",
        "",
        "Upcoming monthly schedule (include tactical suggestions referencing these numbers):",
    ]

    schedule_lines: List[str] = []
    for snapshot in summary.schedule[:max_schedule_months]:
        payments = ", ".join(
            f"{name}: ${amount:,.2f}" for name, amount in snapshot.payments.items()
        )
        remaining = ", ".join(
            f"{name}: ${amount:,.2f}" for name, amount in snapshot.remaining_balances.items()
        )
        schedule_lines.append(
            f"Month {snapshot.month_index}: Total payment ${snapshot.total_payment:,.2f}, "
            f"interest ${snapshot.total_interest:,.2f}; payments [{payments}] | remaining [{remaining}]"
        )

    if len(summary.schedule) > max_schedule_months:
        schedule_lines.append(
            "(Additional months omitted for brevity. Ensure the advice considers the full payoff horizon.)"
        )

    return "\n".join(head + schedule_lines)


def generate_ai_advice(
    summary: PaymentSummary,
    *,
    client: Optional[OpenAI] = None,
    model: Optional[str] = None,
) -> str:
    """Call OpenAI to synthesize actionable guidance for the payoff summary."""

    api_key = os.getenv("OPENAI_API_KEY")
    if client is None:
        if not api_key:
            raise AdviceGenerationError(
                "OPENAI_API_KEY is not configured. Add it to your .env file or environment."
            )
        client = OpenAI(api_key=api_key)

    prompt = build_advice_prompt(summary)

    try:
        response = client.responses.create(
            model=model or _default_model(),
            input=[
                {
                    "role": "system",
                    "content": (
                        "You are a certified financial coach who specializes in debt payoff "
                        "strategies and motivational planning. Provide concrete, safe advice."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            max_output_tokens=600,
        )
    except Exception as exc:  # pragma: no cover - network failure path
        raise AdviceGenerationError(f"OpenAI request failed: {exc}") from exc

    advice = (response.output_text or "").strip()
    if not advice:
        raise AdviceGenerationError("OpenAI returned an empty response.")

    return advice


__all__ = [
    "AdviceGenerationError",
    "build_advice_prompt",
    "generate_ai_advice",
]

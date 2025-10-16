"""Command line interface for the debt advisor."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Iterable, List

from dotenv import load_dotenv

from .models import Debt
from .planner import DebtAdvisor, PaymentSummary
from .ai import AdviceGenerationError, generate_ai_advice

load_dotenv()


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Simulate a debt payoff plan.")
    parser.add_argument(
        "debts",
        type=Path,
        help="Path to a JSON file describing the debts to simulate.",
    )
    parser.add_argument(
        "--strategy",
        choices=["snowball", "avalanche"],
        default="snowball",
        help="Payoff strategy to use.",
    )
    parser.add_argument(
        "--extra",
        type=float,
        default=0.0,
        help="Extra monthly amount to apply in addition to minimum payments.",
    )
    parser.add_argument(
        "--months",
        type=int,
        default=12,
        help="Number of months of the schedule to display (default: 12).",
    )
    parser.add_argument(
        "--advice",
        action="store_true",
        help="Generate AI-powered payoff coaching with your OpenAI credentials.",
    )
    return parser.parse_args(argv)


def load_debts(path: Path) -> List[Debt]:
    data = json.loads(path.read_text())
    if isinstance(data, dict):
        debt_items = data.get("debts", [])
    elif isinstance(data, list):
        debt_items = data
    else:
        raise ValueError("Debt configuration must be a list or an object with a 'debts' key")

    debts: List[Debt] = []
    for raw in debt_items:
        debts.append(
            Debt(
                name=raw["name"],
                balance=float(raw["balance"]),
                apr=float(raw["apr"]),
                minimum_payment=float(raw["minimum_payment"]),
            )
        )
    if not debts:
        raise ValueError("No debts were defined in the configuration file")
    return debts


def render_summary(summary: PaymentSummary, *, months_to_show: int) -> str:
    lines: List[str] = []
    lines.append("=== Debt Payoff Plan ===")
    lines.append(f"Strategy: {summary.strategy}")
    lines.append(f"Months to payoff: {summary.months_to_payoff} (~{summary.payoff_years():.2f} years)")
    lines.append(f"Total interest paid: ${summary.total_interest_paid:,.2f}")
    lines.append(f"Total amount paid: ${summary.total_amount_paid:,.2f}")
    lines.append(
        f"Recommended monthly payment: ${summary.recommended_monthly_payment:,.2f}"
    )
    lines.append(f"Approximate daily payment: ${summary.approximate_daily_payment:,.2f}")
    lines.append("")
    lines.append("Month | Total Payment | Total Interest | Remaining Balances")
    lines.append("------|---------------|----------------|--------------------")

    for snapshot in summary.schedule[:months_to_show]:
        balances = ", ".join(
            f"{name}: ${balance:,.2f}" for name, balance in snapshot.remaining_balances.items()
        )
        lines.append(
            f"{snapshot.month_index:5d} | ${snapshot.total_payment:11,.2f} | "
            f"${snapshot.total_interest:12,.2f} | {balances}"
        )

    if months_to_show < len(summary.schedule):
        lines.append("...")
        final = summary.schedule[-1]
        balances = ", ".join(
            f"{name}: ${balance:,.2f}" for name, balance in final.remaining_balances.items()
        )
        lines.append(
            f"{final.month_index:5d} | ${final.total_payment:11,.2f} | "
            f"${final.total_interest:12,.2f} | {balances}"
        )

    return "\n".join(lines)


def main(argv: Iterable[str] | None = None) -> int:
    args = parse_args(argv)
    debts = load_debts(args.debts)
    advisor = DebtAdvisor(debts)
    summary = advisor.plan(strategy=args.strategy, extra_payment=args.extra)
    print(render_summary(summary, months_to_show=args.months))

    if args.advice:
        try:
            advice = generate_ai_advice(summary)
        except AdviceGenerationError as exc:
            print(f"\n[AI] Unable to generate payoff advice: {exc}", file=sys.stderr)
            return 1

        print("\n=== AI Coaching Suggestions ===")
        print(advice)

    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    raise SystemExit(main())

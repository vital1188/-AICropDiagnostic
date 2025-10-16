"""Utilities for building actionable debt payoff plans."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Literal, Sequence

from .models import Debt

PaymentStrategy = Literal["snowball", "avalanche"]


@dataclass
class MonthlySnapshot:
    """Represents the results of a single simulated month."""

    month_index: int
    payments: Dict[str, float]
    interest_accrued: Dict[str, float]
    remaining_balances: Dict[str, float]
    total_payment: float
    total_interest: float


@dataclass
class PaymentSummary:
    """High level information about a payoff plan."""

    strategy: PaymentStrategy
    months_to_payoff: int
    total_interest_paid: float
    total_amount_paid: float
    recommended_monthly_payment: float
    approximate_daily_payment: float
    schedule: List[MonthlySnapshot] = field(default_factory=list)

    def payoff_years(self) -> float:
        """Return the number of years required to become debt free."""

        return self.months_to_payoff / 12.0


class DebtAdvisor:
    """Simulate payoff plans for a portfolio of debts."""

    def __init__(self, debts: Iterable[Debt]):
        self._debts: List[Debt] = [debt.clone() for debt in debts]
        if not self._debts:
            raise ValueError("At least one debt is required to run the advisor.")

    def plan(
        self,
        *,
        strategy: PaymentStrategy = "snowball",
        extra_payment: float = 0.0,
    ) -> PaymentSummary:
        """Compute a payoff plan using the requested strategy.

        Args:
            strategy: Either ``"snowball"`` or ``"avalanche"``.
            extra_payment: Additional monthly amount to apply on top of the
                contractual minimum payments.
        """

        if extra_payment < 0:
            raise ValueError("extra_payment must be zero or positive")

        ordering = self._resolve_ordering(strategy)
        state = [
            {
                "debt": debt.clone(),
                "balance": debt.balance,
            }
            for debt in self._debts
        ]

        base_monthly_payment = sum(debt.minimum_payment for debt in self._debts)
        schedule: List[MonthlySnapshot] = []
        total_interest_paid = 0.0
        total_paid = 0.0
        month_index = 0
        epsilon = 0.01

        while self._has_outstanding_balance(state, epsilon):
            month_index += 1
            interest_snapshot: Dict[str, float] = {}
            payment_snapshot: Dict[str, float] = {}
            total_payment_this_month = 0.0
            total_interest_this_month = 0.0

            # accrue interest
            for entry in state:
                balance = entry["balance"]
                if balance <= epsilon:
                    continue
                debt = entry["debt"]
                interest = balance * debt.monthly_interest_rate()
                entry["balance"] += interest
                interest_snapshot[debt.name] = interest
                total_interest_paid += interest
                total_interest_this_month += interest

            # pay minimums first
            for entry in state:
                balance = entry["balance"]
                if balance <= epsilon:
                    continue
                debt = entry["debt"]
                payment = min(debt.minimum_payment, balance)
                entry["balance"] -= payment
                payment_snapshot[debt.name] = payment_snapshot.get(debt.name, 0.0) + payment
                total_payment_this_month += payment

            # distribute extra payment according to strategy
            remaining_extra = extra_payment
            for entry in ordering(state):
                if remaining_extra <= 0:
                    break
                balance = entry["balance"]
                if balance <= epsilon:
                    continue
                debt = entry["debt"]
                payment = min(remaining_extra, balance)
                entry["balance"] -= payment
                payment_snapshot[debt.name] = payment_snapshot.get(debt.name, 0.0) + payment
                total_payment_this_month += payment
                remaining_extra -= payment

            # normalize balances and snapshots
            for entry in state:
                if entry["balance"] < epsilon:
                    entry["balance"] = 0.0

            total_paid += total_payment_this_month
            schedule.append(
                MonthlySnapshot(
                    month_index=month_index,
                    payments=dict(payment_snapshot),
                    interest_accrued=dict(interest_snapshot),
                    remaining_balances={entry["debt"].name: entry["balance"] for entry in state},
                    total_payment=total_payment_this_month,
                    total_interest=total_interest_this_month,
                )
            )

            if month_index > 1000:
                raise RuntimeError("Unexpectedly long payoff horizon; aborting simulation.")

        recommended_monthly_payment = base_monthly_payment + extra_payment
        approximate_daily_payment = recommended_monthly_payment / 30.4375

        return PaymentSummary(
            strategy=strategy,
            months_to_payoff=month_index,
            total_interest_paid=total_interest_paid,
            total_amount_paid=total_paid,
            recommended_monthly_payment=recommended_monthly_payment,
            approximate_daily_payment=approximate_daily_payment,
            schedule=schedule,
        )

    @staticmethod
    def _has_outstanding_balance(state: Sequence[Dict[str, object]], epsilon: float) -> bool:
        return any(entry["balance"] > epsilon for entry in state)

    @staticmethod
    def _resolve_ordering(strategy: PaymentStrategy):
        if strategy == "snowball":
            return DebtAdvisor._snowball_order
        if strategy == "avalanche":
            return DebtAdvisor._avalanche_order
        raise ValueError(f"Unsupported strategy: {strategy}")

    @staticmethod
    def _snowball_order(state: Sequence[Dict[str, object]]):
        return sorted(
            state,
            key=lambda entry: (
                entry["balance"],
                -entry["debt"].apr,
            ),
        )

    @staticmethod
    def _avalanche_order(state: Sequence[Dict[str, object]]):
        return sorted(
            state,
            key=lambda entry: (
                -entry["debt"].apr,
                entry["balance"],
            ),
        )

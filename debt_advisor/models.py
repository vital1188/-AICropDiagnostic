"""Core domain models used for debt payoff planning."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict


@dataclass
class Debt:
    """Represents a single debt account.

    Attributes:
        name: Human friendly name for the debt.
        balance: Current principal balance that is outstanding.
        apr: Annual percentage rate expressed as a decimal (e.g. 0.199).
        minimum_payment: Contractual minimum monthly payment.
    """

    name: str
    balance: float
    apr: float
    minimum_payment: float
    metadata: Dict[str, str] = field(default_factory=dict)

    def monthly_interest_rate(self) -> float:
        """Return the effective monthly interest rate."""

        return self.apr / 12.0

    def clone(self) -> "Debt":
        """Return a copy of the debt.

        The planner mutates balances as part of the simulation, so a helper
        method is provided to keep the public API immutable.
        """

        return Debt(
            name=self.name,
            balance=self.balance,
            apr=self.apr,
            minimum_payment=self.minimum_payment,
            metadata=dict(self.metadata),
        )

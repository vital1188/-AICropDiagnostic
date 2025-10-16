from __future__ import annotations

import math

import pytest

from debt_advisor.models import Debt
from debt_advisor.planner import DebtAdvisor


def make_sample_debts():
    return [
        Debt(name="Store Card", balance=100.0, apr=0.12, minimum_payment=25.0),
        Debt(name="Personal Loan", balance=500.0, apr=0.21, minimum_payment=35.0),
    ]


def test_snowball_targets_smallest_balance_first():
    advisor = DebtAdvisor(make_sample_debts())
    summary = advisor.plan(strategy="snowball", extra_payment=60.0)

    first_month = summary.schedule[0]
    assert first_month.payments["Store Card"] > first_month.payments["Personal Loan"]


def test_avalanche_targets_highest_interest_first():
    advisor = DebtAdvisor(make_sample_debts())
    summary = advisor.plan(strategy="avalanche", extra_payment=60.0)

    first_month = summary.schedule[0]
    assert first_month.payments["Personal Loan"] > first_month.payments["Store Card"]


def test_summary_includes_daily_payment():
    advisor = DebtAdvisor(make_sample_debts())
    summary = advisor.plan(strategy="snowball", extra_payment=40.0)
    expected_daily = summary.recommended_monthly_payment / 30.4375
    assert math.isclose(summary.approximate_daily_payment, expected_daily)


def test_rejects_invalid_configuration():
    with pytest.raises(ValueError):
        DebtAdvisor([])
    advisor = DebtAdvisor(make_sample_debts())
    with pytest.raises(ValueError):
        advisor.plan(extra_payment=-1)

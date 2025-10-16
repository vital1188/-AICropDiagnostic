import pytest

from debt_advisor.ai import (
    AdviceGenerationError,
    build_advice_prompt,
    generate_ai_advice,
)
from debt_advisor.planner import MonthlySnapshot, PaymentSummary


def _sample_summary():
    schedule = [
        MonthlySnapshot(
            month_index=1,
            payments={"Card": 300.0},
            interest_accrued={"Card": 45.0},
            remaining_balances={"Card": 4700.0},
            total_payment=300.0,
            total_interest=45.0,
        ),
        MonthlySnapshot(
            month_index=2,
            payments={"Card": 300.0},
            interest_accrued={"Card": 40.0},
            remaining_balances={"Card": 4410.0},
            total_payment=300.0,
            total_interest=40.0,
        ),
    ]
    return PaymentSummary(
        strategy="snowball",
        months_to_payoff=24,
        total_interest_paid=1200.0,
        total_amount_paid=6200.0,
        recommended_monthly_payment=310.0,
        approximate_daily_payment=10.2,
        schedule=schedule,
    )


def test_build_advice_prompt_includes_key_metrics():
    summary = _sample_summary()
    prompt = build_advice_prompt(summary)
    assert "Strategy: snowball" in prompt
    assert "Months to payoff: 24" in prompt
    assert "Total interest paid: $1,200.00" in prompt
    assert "Month 1" in prompt and "Month 2" in prompt


class _StubResponses:
    def __init__(self):
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)

        class _Response:
            output_text = "Stay focused and keep applying extra payments."

        return _Response()


class _StubClient:
    def __init__(self):
        self.responses = _StubResponses()


def test_generate_ai_advice_uses_provided_client():
    summary = _sample_summary()
    client = _StubClient()
    advice = generate_ai_advice(summary, client=client, model="test-model")
    assert "Stay focused" in advice
    assert client.responses.calls
    assert client.responses.calls[0]["model"] == "test-model"


def test_generate_ai_advice_requires_api_key(monkeypatch):
    summary = _sample_summary()
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(AdviceGenerationError):
        generate_ai_advice(summary)

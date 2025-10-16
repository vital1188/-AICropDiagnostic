# Debt Advisor

This repository contains a lightweight command line tool that helps you plan how
to pay down debt faster. It supports the popular **snowball** and **avalanche**
payment strategies and provides quick insight into the monthly and daily
payments required to become debt free.

## Features

- Track multiple debts including balance, APR, and minimum payment.
- Simulate the snowball (lowest balance first) and avalanche (highest interest
  first) strategies.
- Add extra monthly payments to understand how they reduce payoff time.
- View monthly payoff schedules with remaining balances and interest paid.
- See the recommended monthly payment alongside an approximate daily amount to
  keep you on track.

## Getting started

1. Ensure Python 3.10+ is installed.
2. Install dependencies for the optional test suite:

   ```bash
   pip install -r requirements.txt  # only required if you plan to run pytest
   ```

3. Create a JSON file that describes your debts. An example is provided at
   `examples/sample_debts.json`:

   ```json
   {
     "debts": [
       {"name": "Credit Card", "balance": 4500, "apr": 0.1999, "minimum_payment": 120},
       {"name": "Auto Loan", "balance": 12000, "apr": 0.065, "minimum_payment": 260},
       {"name": "Student Loan", "balance": 18000, "apr": 0.0425, "minimum_payment": 210}
     ]
   }
   ```

4. Run the advisor:

   ```bash
   python -m debt_advisor.cli examples/sample_debts.json --strategy avalanche --extra 150 --months 6
   ```

   This prints a summary similar to the following:

   ```
   === Debt Payoff Plan ===
   Strategy: avalanche
   Months to payoff: 74 (~6.17 years)
   Total interest paid: $9,873.42
   Total amount paid: $35,573.42
   Recommended monthly payment: $740.00
   Approximate daily payment: $24.32

   Month | Total Payment | Total Interest | Remaining Balances
   ------|---------------|----------------|--------------------
       1 | $    740.00 | $     262.58 | Credit Card: $4,461.58, Auto Loan: $11,804.98, Student Loan: $17,845.00
       2 | $    740.00 | $     260.07 | Credit Card: $4,406.65, Auto Loan: $11,608.64, Student Loan: $17,689.30
       3 | $    740.00 | $     257.53 | Credit Card: $4,350.63, Auto Loan: $11,412.18, Student Loan: $17,533.46
       4 | $    740.00 | $     254.95 | Credit Card: $4,293.51, Auto Loan: $11,215.60, Student Loan: $17,377.48
       5 | $    740.00 | $     252.34 | Credit Card: $4,235.30, Auto Loan: $11,018.90, Student Loan: $17,221.35
       6 | $    740.00 | $     249.69 | Credit Card: $4,175.99, Auto Loan: $10,822.07, Student Loan: $17,065.08
   ```

   Increase the `--months` parameter to see more of the schedule, or omit it to
   view the first year by default.

## Running tests

Install `pytest` and then execute:

```bash
pytest
```

The test suite validates the core simulation behavior and guards against
regressions.

const DEBT_DECIMALS = 2;
const MAX_MONTHS = 1000;

const debtsBody = document.querySelector("#debts-body");
const addDebtButton = document.querySelector("#add-debt");
const plannerForm = document.querySelector("#planner-form");
const extraPaymentField = document.querySelector("#extra-payment");
const strategyField = document.querySelector("#strategy");
const summarySection = document.querySelector("#summary");
const scheduleSection = document.querySelector("#schedule");
const formErrors = document.querySelector(".form-errors");
const adviceSection = document.querySelector("#advice");
const generateAdviceButton = document.querySelector("#generate-advice");
const adviceContent = document.querySelector("#advice-content");
const adviceStatus = document.querySelector("#advice-status");
const adviceError = document.querySelector("#advice-error");

let latestSummary = null;

function currency(value) {
  return `$${value.toFixed(2)}`;
}

function cloneDebts(debts) {
  return debts.map((debt) => ({ ...debt }));
}

function monthlyInterestRate(apr) {
  return (apr / 100) / 12;
}

function snowballOrder(state) {
  return [...state]
    .filter((entry) => entry.balance > 0)
    .sort((a, b) => {
      if (a.balance !== b.balance) {
        return a.balance - b.balance;
      }
      return b.debt.apr - a.debt.apr;
    });
}

function avalancheOrder(state) {
  return [...state]
    .filter((entry) => entry.balance > 0)
    .sort((a, b) => {
      if (a.debt.apr !== b.debt.apr) {
        return b.debt.apr - a.debt.apr;
      }
      return a.balance - b.balance;
    });
}

function simulatePlan(debts, { strategy, extraPayment }) {
  if (!debts.length) {
    throw new Error("Add at least one debt to generate a plan.");
  }
  if (extraPayment < 0) {
    throw new Error("Extra monthly payment must be zero or positive.");
  }

  const ordering = strategy === "avalanche" ? avalancheOrder : snowballOrder;
  const state = cloneDebts(
    debts.map((debt) => ({
      debt,
      balance: debt.balance,
    }))
  );

  const baseMonthlyPayment = debts.reduce((total, debt) => total + debt.minimumPayment, 0);
  const schedule = [];
  let monthIndex = 0;
  let totalPaid = 0;
  let totalInterestPaid = 0;
  const epsilon = 0.01;

  const hasOutstandingBalance = () => state.some((entry) => entry.balance > epsilon);

  while (hasOutstandingBalance()) {
    monthIndex += 1;
    if (monthIndex > MAX_MONTHS) {
      throw new Error("Payoff horizon exceeds maximum simulated months. Check your inputs.");
    }

    const paymentSnapshot = {};
    const interestSnapshot = {};
    let totalPaymentThisMonth = 0;
    let totalInterestThisMonth = 0;

    // accrue interest
    state.forEach((entry) => {
      if (entry.balance <= epsilon) {
        entry.balance = 0;
        return;
      }
      const interest = entry.balance * monthlyInterestRate(entry.debt.apr);
      entry.balance += interest;
      interestSnapshot[entry.debt.name] = interest;
      totalInterestPaid += interest;
      totalInterestThisMonth += interest;
    });

    // pay minimums
    state.forEach((entry) => {
      if (entry.balance <= epsilon) {
        entry.balance = 0;
        return;
      }
      const payment = Math.min(entry.debt.minimumPayment, entry.balance);
      entry.balance -= payment;
      paymentSnapshot[entry.debt.name] = (paymentSnapshot[entry.debt.name] || 0) + payment;
      totalPaymentThisMonth += payment;
    });

    // distribute extra payment
    let remainingExtra = extraPayment;
    ordering(state).forEach((entry) => {
      if (remainingExtra <= 0) {
        return;
      }
      if (entry.balance <= epsilon) {
        entry.balance = 0;
        return;
      }
      const payment = Math.min(remainingExtra, entry.balance);
      entry.balance -= payment;
      paymentSnapshot[entry.debt.name] = (paymentSnapshot[entry.debt.name] || 0) + payment;
      totalPaymentThisMonth += payment;
      remainingExtra -= payment;
    });

    state.forEach((entry) => {
      if (entry.balance < epsilon) {
        entry.balance = 0;
      }
    });

    totalPaid += totalPaymentThisMonth;
    schedule.push({
      month: monthIndex,
      payments: { ...paymentSnapshot },
      interest: { ...interestSnapshot },
      remaining: Object.fromEntries(state.map((entry) => [entry.debt.name, entry.balance])),
      totalPayment: totalPaymentThisMonth,
      totalInterest: totalInterestThisMonth,
    });
  }

  const recommendedMonthlyPayment = baseMonthlyPayment + extraPayment;
  const approximateDailyPayment = recommendedMonthlyPayment / 30.4375;

  return {
    strategy,
    monthsToPayoff: monthIndex,
    totalInterestPaid,
    totalAmountPaid: totalPaid,
    recommendedMonthlyPayment,
    approximateDailyPayment,
    schedule,
  };
}

function readDebtRow(row) {
  const [nameInput, balanceInput, aprInput, minPaymentInput] = row.querySelectorAll("input");

  const name = nameInput.value.trim() || "Debt";
  const balance = Number.parseFloat(balanceInput.value);
  const apr = Number.parseFloat(aprInput.value);
  const minimumPayment = Number.parseFloat(minPaymentInput.value);

  return {
    name,
    balance,
    apr,
    minimumPayment,
  };
}

function validateDebts(debts) {
  const errors = [];
  debts.forEach((debt, index) => {
    const rowNumber = index + 1;
    if (!Number.isFinite(debt.balance) || debt.balance <= 0) {
      errors.push(`Debt ${rowNumber}: balance must be greater than zero.`);
    }
    if (!Number.isFinite(debt.apr) || debt.apr < 0) {
      errors.push(`Debt ${rowNumber}: APR must be zero or positive.`);
    }
    if (!Number.isFinite(debt.minimumPayment) || debt.minimumPayment <= 0) {
      errors.push(`Debt ${rowNumber}: minimum payment must be greater than zero.`);
    }
  });
  return errors;
}

function renderDebts(debts) {
  debtsBody.innerHTML = "";
  debts.forEach((debt, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input type="text" value="${debt.name}" aria-label="Debt ${index + 1} name" /></td>
      <td><input type="number" min="0" step="0.01" value="${debt.balance.toFixed(DEBT_DECIMALS)}" aria-label="Debt ${index + 1} balance" /></td>
      <td><input type="number" min="0" step="0.01" value="${debt.apr.toFixed(2)}" aria-label="Debt ${index + 1} APR" /></td>
      <td><input type="number" min="0" step="0.01" value="${debt.minimumPayment.toFixed(DEBT_DECIMALS)}" aria-label="Debt ${index + 1} minimum payment" /></td>
      <td><button type="button" class="remove-row" aria-label="Remove debt ${debt.name}">&times;</button></td>
    `;
    const removeButton = row.querySelector(".remove-row");
    removeButton.addEventListener("click", () => {
      const nextDebts = [...debtsBody.querySelectorAll("tr")]
        .filter((r) => r !== row)
        .map((r) => readDebtRow(r));
      if (!nextDebts.length) {
        renderDebts([createEmptyDebt()]);
        return;
      }
      renderDebts(nextDebts);
    });
    debtsBody.appendChild(row);
  });
}

function createEmptyDebt() {
  return {
    name: "",
    balance: 0,
    apr: 0,
    minimumPayment: 0,
  };
}

function gatherDebts() {
  return [...debtsBody.querySelectorAll("tr")].map((row) => readDebtRow(row));
}

function showErrors(messages) {
  if (!messages.length) {
    formErrors.classList.remove("active");
    formErrors.textContent = "";
    return;
  }
  formErrors.classList.add("active");
  formErrors.innerHTML = messages
    .map((message) => `<div>${message}</div>`)
    .join("");
}

function hideErrors() {
  showErrors([]);
}

function updateSummary(summary) {
  summarySection.hidden = false;
  document.querySelector("#summary-strategy").textContent =
    summary.strategy === "snowball" ? "Snowball" : "Avalanche";
  document.querySelector("#summary-months").textContent = summary.monthsToPayoff;
  document.querySelector("#summary-years").textContent = (summary.monthsToPayoff / 12).toFixed(1);
  document.querySelector("#summary-interest").textContent = currency(summary.totalInterestPaid);
  document.querySelector("#summary-total").textContent = currency(summary.totalAmountPaid);
  document.querySelector("#summary-monthly").textContent = currency(summary.recommendedMonthlyPayment);
  document.querySelector("#summary-daily").textContent = currency(summary.approximateDailyPayment);
}

function updateSchedule(summary) {
  scheduleSection.hidden = false;
  const tbody = document.querySelector("#schedule-body");
  tbody.innerHTML = "";

  summary.schedule.forEach((snapshot) => {
    const row = document.createElement("tr");
    const paymentDetails = Object.entries(snapshot.payments)
      .map(([name, amount]) => `<div><strong>${name}:</strong> ${currency(amount)}</div>`)
      .join("");
    const remainingDetails = Object.entries(snapshot.remaining)
      .map(([name, amount]) => `<div><strong>${name}:</strong> ${currency(amount)}</div>`)
      .join("");

    row.innerHTML = `
      <td>${snapshot.month}</td>
      <td>${currency(snapshot.totalPayment)}</td>
      <td>${currency(snapshot.totalInterest)}</td>
      <td>${paymentDetails}</td>
      <td>${remainingDetails}</td>
    `;
    tbody.appendChild(row);
  });
}

function trimSchedule(schedule, limit = 6) {
  return schedule.slice(0, limit).map((snapshot) => ({
    month: snapshot.month,
    totalPayment: snapshot.totalPayment,
    totalInterest: snapshot.totalInterest,
    payments: snapshot.payments,
    remaining: snapshot.remaining,
  }));
}

function prepareAdvice(summary) {
  latestSummary = { ...summary, schedule: trimSchedule(summary.schedule) };
  adviceSection.hidden = false;
  adviceContent.hidden = true;
  adviceContent.textContent = "";
  adviceError.textContent = "";
  adviceError.hidden = true;
  adviceStatus.textContent =
    "Generate a personalized action plan using OpenAI once you've created a payoff strategy.";
  generateAdviceButton.disabled = false;
}

function setAdviceLoading() {
  adviceError.textContent = "";
  adviceError.hidden = true;
  adviceContent.hidden = true;
  adviceStatus.textContent = "Generating AI advice...";
  generateAdviceButton.disabled = true;
}

function showAdvice(advice) {
  adviceStatus.textContent = "Here's your AI-powered guidance:";
  adviceContent.textContent = advice;
  adviceContent.hidden = false;
  adviceError.textContent = "";
  adviceError.hidden = true;
  generateAdviceButton.disabled = false;
}

function showAdviceError(message) {
  adviceStatus.textContent = "";
  adviceContent.hidden = true;
  adviceContent.textContent = "";
  adviceError.textContent = message;
  adviceError.hidden = false;
  generateAdviceButton.disabled = false;
}

async function requestAdvice() {
  if (!latestSummary) {
    showAdviceError("Generate a plan before requesting advice.");
    return;
  }

  setAdviceLoading();

  try {
    const response = await fetch("/.netlify/functions/generate-advice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ summary: latestSummary }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Unable to generate advice.");
    }

    if (!payload.advice) {
      throw new Error("Received an empty response from the AI service.");
    }

    showAdvice(payload.advice);
  } catch (error) {
    showAdviceError(error.message || "Unable to generate advice.");
  }
}

function addDebtRow() {
  const debts = gatherDebts();
  debts.push(createEmptyDebt());
  renderDebts(debts);
}

addDebtButton.addEventListener("click", () => {
  addDebtRow();
});

plannerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  hideErrors();

  const debts = gatherDebts();
  const errors = validateDebts(debts);
  const extraPayment = Number.parseFloat(extraPaymentField.value);
  if (!Number.isFinite(extraPayment) || extraPayment < 0) {
    errors.push("Extra monthly payment must be zero or positive.");
  }

  if (errors.length) {
    showErrors(errors);
    return;
  }

  try {
    const summary = simulatePlan(debts, {
      strategy: strategyField.value,
      extraPayment,
    });
    updateSummary(summary);
    updateSchedule(summary);
    prepareAdvice(summary);
  } catch (error) {
    showErrors([error.message]);
  }
});

generateAdviceButton.addEventListener("click", () => {
  requestAdvice();
});

renderDebts([
  {
    name: "Credit Card",
    balance: 3200,
    apr: 18,
    minimumPayment: 80,
  },
  {
    name: "Auto Loan",
    balance: 12500,
    apr: 5.5,
    minimumPayment: 250,
  },
]);

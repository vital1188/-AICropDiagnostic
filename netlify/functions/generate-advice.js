const { config } = require("dotenv");
const OpenAI = require("openai");

config();

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

function sanitizeSchedule(schedule, limit = 6) {
  return schedule.slice(0, limit).map((snapshot) => ({
    month: snapshot.month,
    totalPayment: snapshot.totalPayment,
    totalInterest: snapshot.totalInterest,
    payments: snapshot.payments,
    remaining: snapshot.remaining,
  }));
}

function buildPrompt(summary) {
  const lines = [
    "You are coaching a household on how to become debt free. Offer motivational yet realistic advice.",
    "Discuss snowball vs avalanche trade-offs if helpful, call out any quick wins, and provide budgeting or mindset tips.",
    "Avoid promising guaranteed outcomes and keep the response actionable and concise.",
    "",
    `Strategy: ${summary.strategy}`,
    `Months to payoff: ${summary.monthsToPayoff}`,
    `Total interest paid: $${summary.totalInterestPaid.toFixed(2)}`,
    `Total amount paid: $${summary.totalAmountPaid.toFixed(2)}`,
    `Recommended monthly payment: $${summary.recommendedMonthlyPayment.toFixed(2)}`,
    `Approximate daily payment: $${summary.approximateDailyPayment.toFixed(2)}`,
    "",
    "Upcoming monthly schedule:",
  ];

  const schedule = summary.schedule || [];
  sanitizeSchedule(schedule).forEach((snapshot) => {
    const payments = Object.entries(snapshot.payments || {})
      .map(([name, amount]) => `${name}: $${amount.toFixed(2)}`)
      .join(", ");
    const remaining = Object.entries(snapshot.remaining || {})
      .map(([name, amount]) => `${name}: $${amount.toFixed(2)}`)
      .join(", ");
    lines.push(
      `Month ${snapshot.month}: total payment $${snapshot.totalPayment.toFixed(2)}, interest $${snapshot.totalInterest.toFixed(2)} | payments [${payments}] | remaining [${remaining}]`
    );
  });

  if (schedule.length > 6) {
    lines.push("(Additional months omitted for brevity. Address the full payoff journey in your advice.)");
  }

  return lines.join("\n");
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "OPENAI_API_KEY is not configured." }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (error) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON payload." }) };
  }

  const summary = payload.summary;
  if (!summary) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing summary payload." }) };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await client.responses.create({
      model: payload.model || DEFAULT_MODEL,
      input: [
        {
          role: "system",
          content:
            "You are a certified financial coach specializing in debt payoff strategies. Provide safe, tactical, and encouraging guidance.",
        },
        {
          role: "user",
          content: buildPrompt({ ...summary, schedule: sanitizeSchedule(summary.schedule || []) }),
        },
      ],
      max_output_tokens: 600,
    });

    const advice = (response.output_text || "").trim();
    if (!advice) {
      return { statusCode: 502, body: JSON.stringify({ error: "Received empty response from OpenAI." }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ advice }),
    };
  } catch (error) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: error.message || "Failed to generate advice." }),
    };
  }
};

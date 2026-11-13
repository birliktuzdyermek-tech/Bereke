// Run with: pnpm test. Same fixture and expectations as AnalyticsTests in backend/finance/tests.py.
import test from "node:test";
import assert from "node:assert/strict";
import { analyticsFromRows, changePercent, periodBounds } from "./analytics.ts";

const NOW = new Date(2026, 10, 15); // 15 Nov 2026, local time
const row = (txDate: string, type: "income" | "expense", category: string, amount: number) => ({ txDate, type, category, amount });
const FIXTURE = [
  row("2026-12-01", "income", "Жалақы", 7000), row("2026-11-30", "income", "Жалақы", 1000), row("2026-11-01", "expense", "Азық-түлік", 200),
  row("2026-10-31", "expense", "Көлік", 300), row("2026-09-01", "expense", "Азық-түлік", 400), row("2026-08-31", "expense", "Көлік", 500),
  row("2026-06-01", "income", "Жалақы", 2000), row("2026-05-31", "expense", "Тұрғын үй", 600), row("2025-12-01", "expense", "Көлік", 700),
  row("2025-11-30", "income", "Жалақы", 800),
];
const WANT: Record<number, { income: number; expense: number; categories: [string, number][]; previous: [number, number]; from: string }> = {
  1: { income: 1000, expense: 200, categories: [["Азық-түлік", 200]], previous: [0, 300], from: "2026-11-01" },
  3: { income: 1000, expense: 900, categories: [["Азық-түлік", 600], ["Көлік", 300]], previous: [2000, 500], from: "2026-09-01" },
  6: { income: 3000, expense: 1400, categories: [["Көлік", 800], ["Азық-түлік", 600]], previous: [0, 1300], from: "2026-06-01" },
  12: { income: 3000, expense: 2700, categories: [["Көлік", 1500], ["Азық-түлік", 600], ["Тұрғын үй", 600]], previous: [800, 0], from: "2025-12-01" },
};

test("totals, categories, previous period and bounds per period", () => {
  for (const [months, want] of Object.entries(WANT)) {
    const result = analyticsFromRows(FIXTURE, Number(months), NOW);
    assert.equal(result.income, want.income, `income ${months}`);
    assert.equal(result.expense, want.expense, `expense ${months}`);
    assert.equal(result.balance, want.income - want.expense);
    assert.deepEqual(result.categories.map(c => [c.category, c.total]), want.categories, `categories ${months}`);
    assert.deepEqual([result.previous.income, result.previous.expense], want.previous, `previous ${months}`);
    assert.deepEqual([result.from, result.to], [want.from, "2026-11-30"]);
  }
});

test("monthly series reproduces the SQL expectations, including the running net inside the period", () => {
  const three = analyticsFromRows(FIXTURE, 3, NOW).monthly.map(m => [m.month, m.income, m.expense, m.balance]);
  assert.deepEqual(three, [["2026-09", 0, 400, -400], ["2026-10", 0, 300, -700], ["2026-11", 1000, 200, 100]]);
});

test("chart and numbers are one dataset", () => {
  for (const months of [1, 3, 6, 12]) {
    const result = analyticsFromRows(FIXTURE, months, NOW);
    assert.equal(result.monthly.reduce((t, m) => t + m.income, 0), result.income);
    assert.equal(result.monthly.reduce((t, m) => t + m.expense, 0), result.expense);
    assert.equal(result.categories.reduce((t, c) => t + c.total, 0), result.expense);
    assert.equal(result.monthly[result.monthly.length - 1].balance, result.balance); // line ends at the period balance
  }
});

test("empty data gives a zero state for every period", () => {
  for (const months of [1, 3, 6, 12]) {
    const result = analyticsFromRows([], months, NOW);
    assert.deepEqual([result.income, result.expense, result.balance, result.transactionCount], [0, 0, 0, 0]);
    assert.equal(result.categories.length, 0);
    assert.equal(result.monthly.length, months);
    assert.ok(result.monthly.every(m => m.income === 0 && m.expense === 0 && m.balance === 0));
  }
});

test("windows wrap year boundaries", () => {
  assert.deepEqual([periodBounds(3, new Date(2026, 0, 15)).from, periodBounds(3, new Date(2026, 0, 15)).to], ["2025-11-01", "2026-01-31"]);
  assert.equal(periodBounds(1, new Date(2026, 11, 31)).to, "2026-12-31");
  assert.equal(periodBounds(12, new Date(2026, 1, 28)).from, "2025-03-01");
  assert.equal(periodBounds(12, new Date(2028, 1, 10)).to, "2028-02-29"); // leap year
});

test("change against the previous period", () => {
  assert.equal(changePercent(150, 100), 50);
  assert.equal(changePercent(50, 100), -50);
  assert.equal(changePercent(10, 0), null);
});

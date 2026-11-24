// Run with: pnpm test. Same cases as InsightRuleTests in backend/finance/tests.py.
import test from "node:test";
import assert from "node:assert/strict";
import { buildInsights } from "./insights.ts";

const stats = (changes: Record<string, unknown> = {}) => ({ months: 3, from: "2026-09-01", to: "2026-11-30", income: 0, expense: 0, balance: 0,
  previous: { income: 0, expense: 0 }, categories: [] as { category: string; total: number }[], ...changes }) as Parameters<typeof buildInsights>[0];
const codes = (s: Parameters<typeof buildInsights>[0], subs = 0) => buildInsights(s, subs).map(tip => tip.ruleCode);

test("nothing to say without data", () => assert.deepEqual(codes(stats()), []));

test("category share threshold is 40 percent", () => {
  const make = (total: number) => stats({ expense: 1000, income: 5000, balance: 4000, categories: [{ category: "Көлік", total }] });
  assert.deepEqual(codes(make(399)), []);
  const tips = buildInsights(make(400), 0);
  assert.deepEqual(tips.map(tip => tip.ruleCode), ["category_share"]);
  assert.match(tips[0].message, /40%/);
  assert.match(tips[0].basis, /2026-09-01 — 2026-11-30/);
  assert.deepEqual([tips[0].periodStart, tips[0].periodEnd], ["2026-09-01", "2026-11-30"]);
});

test("growth needs a previous period and 20 percent", () => {
  assert.deepEqual(codes(stats({ expense: 1200, income: 9000, balance: 7800, previous: { income: 0, expense: 1000 } })), ["expense_growth"]);
  assert.deepEqual(codes(stats({ expense: 1199, income: 9000, balance: 7801, previous: { income: 0, expense: 1000 } })), []);
  assert.deepEqual(codes(stats({ expense: 5000, income: 9000, balance: 4000 })), []);
});

test("subscription load uses average monthly expense", () => {
  const s = stats({ months: 3, expense: 30000, income: 900000, balance: 870000 });
  assert.deepEqual(codes(s, 1000), ["subscription_load"]);
  assert.deepEqual(codes(s, 999), []);
  assert.deepEqual(codes(s, 0), []);
});

test("low savings below 10 percent of income", () => {
  assert.deepEqual(codes(stats({ income: 1000, expense: 901, balance: 99 })), ["low_savings"]);
  assert.deepEqual(codes(stats({ income: 1000, expense: 900, balance: 100 })), []);
  assert.match(buildInsights(stats({ income: 1000, expense: 1500, balance: -500 }), 0)[0].message, /0%/);
  assert.deepEqual(codes(stats({ income: 0, expense: 100, balance: -100 })), []);
});

test("message text matches the backend wording", () => {
  const [tip] = buildInsights(stats({ expense: 98000, income: 100000, balance: 2000, categories: [{ category: "Тұрғын үй", total: 60000 }] }), 0);
  assert.equal(tip.message, "«Тұрғын үй» санаты шығынның 61%-ын құрайды (60 000 ₸). Осы бағытты қайта қарап көруге болады.");
});

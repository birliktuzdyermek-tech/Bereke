import type { Sub, Tx } from "./finance-types.ts";

/** Rules of the 12th lesson (also explained on screen and in the report). */
export const AMOUNT_TOLERANCE = 0.1; // two payments "match" when they differ by at most 10 %
export const MAX_CHANGE = 0.5; // a bigger jump between neighbours means a different kind of payment
export const MONTH_DAYS = { min: 25, max: 35 }; // gap between two monthly payments
export const MISSED_DAYS = { min: 55, max: 65 }; // a gap of about two months = one month skipped
export const STALE_DAYS = 45; // the series must have a payment within this many days to be offered

export type Candidate = {
  key: string; merchant: string; amount: number; payments: number; lastDate: string; nextPayment: string;
  amountChanged: boolean; missedMonth: boolean; dates: string[];
};
export type Warning = { kind: "changed" | "missed"; amount?: number; lastDate: string };

const DAY = 86400000;
const toDay = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY);
const iso = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
const gap = (a: string, b: string) => toDay(b) - toDay(a);

/** "NETFLIX *4421" and "Netflix" are the same seller: lower case, no digits, no punctuation, single spaces. */
export function normalizeMerchant(name: string) {
  return name.toLocaleLowerCase("kk").replace(/[\d_]+/g, " ").replace(/[^\p{L}\s]+/gu, " ").replace(/\s+/g, " ").trim();
}

/** Same day of the next month; a short month clamps to its last day (31 Jan -> 28 Feb). */
export function addMonth(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return iso(Math.round(Date.UTC(y, m, Math.min(d, last)) / DAY));
}

/** Next expected payment: last payment + one month; if that is already past, keep adding months until it is today or later. */
export function nextPaymentDate(lastDate: string, today: string) {
  let next = addMonth(lastDate);
  const [y, m, d] = lastDate.split("-").map(Number);
  for (let step = 2; next < today && step < 600; step++) {
    const last = new Date(Date.UTC(y, m - 1 + step, 0)).getUTCDate();
    next = iso(Math.round(Date.UTC(y, m - 1 + step, Math.min(d, last)) / DAY));
  }
  return next;
}

const close = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= Math.max(a, b) * tolerance;
const between = (days: number, range: { min: number; max: number }) => days >= range.min && days <= range.max;

type Payment = { txDate: string; amount: number };

/** Walk back from the latest payment while the gap is monthly (or one skipped month) and the price jumps stay below 50 %. */
function series(payments: Payment[]) {
  const sorted = [...payments].sort((a, b) => a.txDate.localeCompare(b.txDate));
  const chain = [sorted[sorted.length - 1]];
  let missed = false;
  for (let i = sorted.length - 2; i >= 0; i--) {
    const days = gap(sorted[i].txDate, chain[0].txDate);
    const skipped = between(days, MISSED_DAYS);
    if (!(between(days, MONTH_DAYS) || skipped) || !close(sorted[i].amount, chain[0].amount, MAX_CHANGE)) break;
    if (skipped) missed = true;
    chain.unshift(sorted[i]);
  }
  return { chain, missed };
}

/** Likely subscriptions: the same seller, about every month, with a similar amount. One-off payments never qualify. */
export function detectSubscriptions(txs: Tx[], subs: Sub[], ignored: string[], today: string): Candidate[] {
  const known = new Set([...subs.map(s => normalizeMerchant(s.merchant)), ...ignored]);
  const groups = new Map<string, { name: string; payments: Payment[] }>();
  for (const tx of txs) {
    if (tx.type !== "expense" || tx.amount <= 0) continue;
    const key = normalizeMerchant(tx.merchant);
    if (!key) continue;
    const group = groups.get(key) ?? { name: tx.merchant.trim(), payments: [] };
    group.payments.push({ txDate: tx.txDate, amount: tx.amount });
    groups.set(key, group);
  }
  const found: Candidate[] = [];
  for (const [key, group] of groups) {
    if (known.has(key) || group.payments.length < 2) continue;
    const { chain, missed } = series(group.payments);
    if (chain.length < 2) continue;
    const similarPair = chain.some((p, i) => i > 0 && close(chain[i - 1].amount, p.amount, AMOUNT_TOLERANCE));
    if (!similarPair) continue; // the amounts keep changing: shopping habit, not a subscription
    const last = chain[chain.length - 1], before = chain[chain.length - 2];
    if (gap(last.txDate, today) > STALE_DAYS) continue; // series stopped long ago
    found.push({
      key, merchant: group.name, amount: last.amount, payments: chain.length, lastDate: last.txDate,
      nextPayment: nextPaymentDate(last.txDate, today), amountChanged: !close(before.amount, last.amount, AMOUNT_TOLERANCE),
      missedMonth: missed, dates: chain.map(p => p.txDate),
    });
  }
  return found.sort((a, b) => b.payments - a.payments || b.amount - a.amount);
}

/** A confirmed subscription is checked separately: the latest payment has another amount, or the month was skipped. */
export function checkConfirmed(sub: Sub, txs: Tx[], today: string): Warning | null {
  if (sub.status !== "active") return null;
  const key = normalizeMerchant(sub.merchant);
  const own = txs.filter(tx => tx.type === "expense" && normalizeMerchant(tx.merchant) === key).sort((a, b) => b.txDate.localeCompare(a.txDate));
  if (!own.length) return null;
  const last = own[0];
  if (gap(last.txDate, today) > MONTH_DAYS.max) return { kind: "missed", lastDate: last.txDate };
  if (!close(last.amount, sub.monthlyAmount, AMOUNT_TOLERANCE)) return { kind: "changed", amount: last.amount, lastDate: last.txDate };
  return null;
}

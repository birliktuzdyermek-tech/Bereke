// Run with: pnpm test. Checks of the 12th lesson: grouping by seller, thresholds, next payment date.
import test from "node:test";
import assert from "node:assert/strict";
import { addMonth, checkConfirmed, detectSubscriptions, nextPaymentDate, normalizeMerchant } from "./recurring.ts";
import type { Sub, Tx } from "./finance-types.ts";

let id = 0;
const tx = (merchant: string, amount: number, txDate: string, type: "income" | "expense" = "expense"): Tx => ({ id: ++id, merchant, category: "Ойын-сауық", amount, type, txDate, cardId: null });
const sub = (merchant: string, monthlyAmount: number, status: "active" | "cancelled" = "active"): Sub => ({ id: ++id, merchant, monthlyAmount, nextPayment: "2026-11-20", status });
const TODAY = "2026-11-17";

test("seller names are normalised", () => {
  assert.equal(normalizeMerchant("NETFLIX *4421"), "netflix");
  assert.equal(normalizeMerchant("  Netflix.com  "), "netflix com");
  assert.equal(normalizeMerchant("Yandex  Plus #12"), "yandex plus");
});

test("a monthly payment with a similar amount is a likely subscription", () => {
  const rows = [tx("Netflix", 3990, "2026-08-08"), tx("NETFLIX *1", 3990, "2026-09-08"), tx("Netflix", 3990, "2026-10-09"), tx("Netflix", 3990, "2026-11-08")];
  const [c] = detectSubscriptions(rows, [], [], TODAY);
  assert.equal(c.key, "netflix");
  assert.equal(c.payments, 4);
  assert.equal(c.amount, 3990);
  assert.equal(c.nextPayment, "2026-12-08");
  assert.equal(c.amountChanged || c.missedMonth, false);
});

test("a one-off payment is never proposed", () => {
  assert.deepEqual(detectSubscriptions([tx("Кино", 7900, "2026-11-10")], [], [], TODAY), []);
});

test("two payments inside one month or far apart do not make a subscription", () => {
  assert.deepEqual(detectSubscriptions([tx("Такси", 2000, "2026-11-01"), tx("Такси", 2000, "2026-11-12")], [], [], TODAY), []);
  assert.deepEqual(detectSubscriptions([tx("Қасапхана", 5000, "2026-07-01"), tx("Қасапхана", 5000, "2026-11-01")], [], [], TODAY), []);
});

test("a shop with changing amounts is not a subscription (amount threshold 10 %)", () => {
  const rows = [tx("Magnum", 28500, "2026-08-11"), tx("Magnum", 64200, "2026-09-11"), tx("Magnum", 41000, "2026-10-12"), tx("Magnum", 71300, "2026-11-11")];
  assert.deepEqual(detectSubscriptions(rows, [], [], TODAY), []);
  const near = [tx("Gym", 15000, "2026-10-01"), tx("Gym", 16400, "2026-11-01")]; // +9.8 % still matches
  assert.equal(detectSubscriptions(near, [], [], TODAY).length, 1);
  const far = [tx("Gym", 15000, "2026-10-01"), tx("Gym", 17000, "2026-11-01")]; // +13 % does not match as a pair
  assert.equal(detectSubscriptions(far, [], [], TODAY).length, 0);
});

test("a changed amount and a skipped month are flagged", () => {
  const changed = [tx("Yandex Plus", 1990, "2026-08-15"), tx("Yandex Plus", 1990, "2026-09-15"), tx("Yandex Plus", 1990, "2026-10-15"), tx("Yandex Plus", 2490, "2026-11-15")];
  const [c] = detectSubscriptions(changed, [], [], TODAY);
  assert.equal(c.amountChanged, true);
  assert.equal(c.amount, 2490);
  const skipped = [tx("Fitness", 15000, "2026-07-03"), tx("Fitness", 15000, "2026-08-03"), tx("Fitness", 15000, "2026-10-03"), tx("Fitness", 15000, "2026-11-03")];
  const [s] = detectSubscriptions(skipped, [], [], TODAY);
  assert.equal(s.missedMonth, true);
  assert.equal(s.payments, 4);
});

test("incomes, known subscriptions and ignored sellers are left out", () => {
  const salary = [tx("Жалақы", 450000, "2026-10-01", "income"), tx("Жалақы", 450000, "2026-11-01", "income")];
  const spotify = [tx("Spotify", 2390, "2026-10-05"), tx("Spotify", 2390, "2026-11-05")];
  assert.deepEqual(detectSubscriptions(salary, [], [], TODAY), []);
  assert.deepEqual(detectSubscriptions(spotify, [sub("Spotify", 2390)], [], TODAY), []);
  assert.deepEqual(detectSubscriptions(spotify, [], ["spotify"], TODAY), []);
  assert.equal(detectSubscriptions(spotify, [], [], TODAY).length, 1);
});

test("next payment date: one month later, clamped to the month end, rolled forward if past", () => {
  assert.equal(addMonth("2026-01-31"), "2026-02-28");
  assert.equal(addMonth("2026-12-15"), "2027-01-15");
  assert.equal(nextPaymentDate("2026-11-08", TODAY), "2026-12-08");
  assert.equal(nextPaymentDate("2026-10-08", TODAY), "2026-12-08"); // 8 Nov is already past on 17 Nov
  assert.equal(nextPaymentDate("2026-10-31", "2026-11-17"), "2026-11-30");
});

test("a confirmed subscription is checked for a new amount and for a skipped month", () => {
  const rows = [tx("YouTube Premium", 2990, "2026-11-12"), tx("YouTube Premium", 2690, "2026-10-12")];
  assert.deepEqual(checkConfirmed(sub("YouTube Premium", 2690), rows, TODAY), { kind: "changed", amount: 2990, lastDate: "2026-11-12" });
  assert.equal(checkConfirmed(sub("YouTube Premium", 2990), rows, TODAY), null);
  assert.equal(checkConfirmed(sub("YouTube Premium", 2990, "cancelled"), rows, TODAY), null);
  const old = [tx("Spotify", 2390, "2026-09-05")];
  assert.equal(checkConfirmed(sub("Spotify", 2390), old, TODAY)?.kind, "missed");
});

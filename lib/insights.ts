import type { Analytics } from "./analytics.ts";

/** Same rules and thresholds as backend/finance/insights.py; both are tested against the same cases. */
export const SHARE_LIMIT_PERCENT = 40;
export const GROWTH_LIMIT_PERCENT = 20;
export const SUBSCRIPTION_LIMIT_PERCENT = 10;
export const SAVINGS_LIMIT_PERCENT = 10;

export type Insight = { ruleCode: string; message: string; basis: string; periodStart: string; periodEnd: string; createdAt?: string };

const tenge = (value: number) => `${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;
/** Whole percent, half up, integers only so that TypeScript and Python agree. */
const percent = (part: number, whole: number) => Math.floor((part * 100 + Math.floor(whole / 2)) / whole);

export function buildInsights(stats: Pick<Analytics, "months" | "from" | "to" | "income" | "expense" | "balance" | "previous" | "categories">, subscriptionsTotal: number): Insight[] {
  const { months, expense, income, balance } = stats;
  const where = `Кезең ${stats.from} — ${stats.to}`;
  const out: Insight[] = [];
  const add = (ruleCode: string, message: string, basis: string) => out.push({ ruleCode, message, basis, periodStart: stats.from, periodEnd: stats.to });

  const top = stats.categories[0];
  if (expense > 0 && top && top.total * 100 >= expense * SHARE_LIMIT_PERCENT) {
    const share = percent(top.total, expense);
    add("category_share", `«${top.category}» санаты шығынның ${share}%-ын құрайды (${tenge(top.total)}). Осы бағытты қайта қарап көруге болады.`,
      `${where}: жалпы шығын ${tenge(expense)}, санат ${tenge(top.total)} = ${share}%. Ереже: бір санат ≥ ${SHARE_LIMIT_PERCENT}%.`);
  }
  const previous = stats.previous.expense;
  if (previous > 0 && expense * 100 >= previous * (100 + GROWTH_LIMIT_PERCENT)) {
    const growth = percent(expense - previous, previous);
    add("expense_growth", `Шығын алдыңғы кезеңмен салыстырғанда ${growth}%-ға өскен: ${tenge(previous)} → ${tenge(expense)}.`,
      `${where}: шығын ${tenge(expense)}, алдыңғы тең кезеңде ${tenge(previous)}. Ереже: өсім ≥ ${GROWTH_LIMIT_PERCENT}%.`);
  }
  if (subscriptionsTotal > 0 && expense > 0 && subscriptionsTotal * months * 100 >= expense * SUBSCRIPTION_LIMIT_PERCENT) {
    const share = percent(subscriptionsTotal * months, expense);
    add("subscription_load", `Белсенді жазылымдарға айына ${tenge(subscriptionsTotal)} кетеді, бұл орташа айлық шығынның шамамен ${share}%-ы.`,
      `${where}: белсенді жазылымдар ${tenge(subscriptionsTotal)}/ай × ${months} ай, жалпы шығын ${tenge(expense)}. Ереже: үлес ≥ ${SUBSCRIPTION_LIMIT_PERCENT}%.`);
  }
  if (income > 0 && balance * 100 < income * SAVINGS_LIMIT_PERCENT) {
    add("low_savings", `Кірістің тек ${percent(Math.max(balance, 0), income)}%-ы жұмсалмай қалды (${balance >= 0 ? tenge(balance) : "−" + tenge(-balance)}).`,
      `${where}: кіріс ${tenge(income)}, шығыс ${tenge(expense)}. Ереже: қалдық кірістің ${SAVINGS_LIMIT_PERCENT}%-ынан аз.`);
  }
  return out;
}

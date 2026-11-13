// Period analytics. The server (/api/analytics) is the source of truth for signed-in users;
// analyticsFromRows applies the same rules to local rows for the demo account, and
// periodBounds keeps the transaction list on the same dates as the totals.
export type Analytics = {
  months: number;
  from: string;
  to: string;
  income: number;
  expense: number;
  balance: number;
  previous: { income: number; expense: number };
  categories: { category: string; total: number }[];
  monthly: { month: string; income: number; expense: number; balance: number }[];
  transactionCount: number;
};
type Row = { txDate: string; type: "income" | "expense"; category: string; amount: number };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;
const shift = (year: number, month: number, delta: number): [number, number] => {
  const index = year * 12 + (month - 1) + delta;
  return [Math.floor(index / 12), (index % 12) + 1];
};

/** Calendar-month window: the current month plus the previous months - 1. `to` is the last day, inclusive. */
export function periodBounds(months: number, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const [startYear, startMonth] = shift(year, month, -(months - 1));
  return { from: iso(startYear, startMonth, 1), to: iso(year, month, new Date(year, month, 0).getDate()), startYear, startMonth };
}

export function analyticsFromRows(rows: Row[], months: number, now = new Date()): Analytics {
  const { from, to, startYear, startMonth } = periodBounds(months, now);
  const [previousYear, previousMonth] = shift(startYear, startMonth, -months);
  const previousFrom = iso(previousYear, previousMonth, 1);
  const sum = (list: Row[], type: Row["type"]) => list.filter(row => row.type === type).reduce((total, row) => total + row.amount, 0);
  const inside = rows.filter(row => row.txDate >= from && row.txDate <= to);
  const previous = rows.filter(row => row.txDate >= previousFrom && row.txDate < from);
  const income = sum(inside, "income");
  const expense = sum(inside, "expense");
  const totals = new Map<string, number>();
  for (const row of inside) if (row.type === "expense") totals.set(row.category, (totals.get(row.category) || 0) + row.amount);
  let running = 0; // running net inside the period; the last point equals the period balance
  const monthly = Array.from({ length: months }, (_, offset) => {
    const [year, month] = shift(startYear, startMonth, offset);
    const key = `${year}-${pad(month)}`;
    const list = inside.filter(row => row.txDate.startsWith(key));
    const monthIncome = sum(list, "income");
    const monthExpense = sum(list, "expense");
    running += monthIncome - monthExpense;
    return { month: key, income: monthIncome, expense: monthExpense, balance: running };
  });
  return {
    months, from, to, income, expense, balance: income - expense,
    previous: { income: sum(previous, "income"), expense: sum(previous, "expense") },
    categories: [...totals].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total || (a.category < b.category ? -1 : a.category > b.category ? 1 : 0)),
    monthly, transactionCount: inside.length,
  };
}

/** Change against the previous period in whole percent, or null when there is nothing to compare with. */
export const changePercent = (current: number, previous: number) => (previous > 0 ? Math.round((current - previous) / previous * 100) : null);

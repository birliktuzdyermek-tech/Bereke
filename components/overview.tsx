"use client";

import { useMemo } from "react";
import { Lightbulb, RefreshCw } from "lucide-react";
import { TransactionRow } from "@/components/transaction-row";
import { colors, money } from "@/lib/format";
import type { Sub, Tx } from "@/lib/finance-types";

const FULL_MONTHS = ["Қаңтар", "Ақпан", "Наурыз", "Сәуір", "Мамыр", "Маусым", "Шілде", "Тамыз", "Қыркүйек", "Қазан", "Қараша", "Желтоқсан"];
const SHORT_MONTHS = ["қаң", "ақп", "нау", "сәу", "мам", "мау", "шіл", "там", "қыр", "қаз", "қар", "жел"];

type MonthTotals = { key: string; month: number; year: number; income: number; expense: number; balance: number };

/** Income, expenses and running balance for the last `count` calendar months. */
export function monthSeries(rows: Tx[], count: number, now = new Date()): MonthTotals[] {
  const months = Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, month: d.getMonth(), year: d.getFullYear(), income: 0, expense: 0, balance: 0 };
  });
  const byKey = new Map(months.map(m => [m.key, m]));
  let opening = 0;
  for (const tx of rows) {
    const signed = tx.type === "income" ? tx.amount : -tx.amount;
    const bucket = byKey.get(tx.txDate.slice(0, 7));
    if (bucket) { if (tx.type === "income") bucket.income += tx.amount; else bucket.expense += tx.amount; }
    else if (tx.txDate.slice(0, 7) < months[0].key) opening += signed;
  }
  let running = opening;
  for (const m of months) { running += m.income - m.expense; m.balance = running; }
  return months;
}

type OverviewProps = {
  rows: Tx[];
  visible: Tx[];
  period: string;
  income: number;
  expense: number;
  byCategory: [string, number][];
  activeSubs: Sub[];
  monthlySubs: number;
  insights: string[];
  canSeed: boolean;
  busy: boolean;
  onSeed: () => void;
  onShowTransactions: () => void;
  onShowSubscriptions: () => void;
};

export function Overview({ rows, visible, period, income, expense, byCategory, activeSubs, monthlySubs, insights, canSeed, busy, onSeed, onShowTransactions, onShowSubscriptions }: OverviewProps) {
  const count = Math.max(6, Number(period));
  const months = useMemo(() => monthSeries(rows, count), [rows, count]);
  const current = months[months.length - 1];
  const peak = Math.max(1, ...months.map(m => Math.max(m.income, m.expense)));
  const lows = Math.min(...months.map(m => m.balance));
  const highs = Math.max(...months.map(m => m.balance));
  const span = highs - lows || 1;
  const line = months.map((m, i) => `${i ? "L" : "M"}${((i + 0.5) / count * 700).toFixed(1)},${(66 - (m.balance - lows) / span * 54).toFixed(1)}`).join(" ");
  const balance = income - expense;
  const kept = income > 0 ? Math.min(100, Math.max(0, Math.round(balance / income * 100))) : null;
  const incomeShare = income + expense > 0 ? income / (income + expense) * 100 : 50;
  const top = byCategory.slice(0, 4);
  const topMax = top[0]?.[1] || 1;

  return <div className="overview">
    <section className="panel ov-strip" aria-label="Қаржы көрсеткіштері">
      <div className="ov-cell">
        <span className="ov-label">Осы кезеңдегі қалдық</span>
        <strong className="ov-big">{money(balance)}</strong>
        <span className="ov-note">{period} айлық кезең</span>
      </div>
      <div className="ov-cell">
        <div className="ov-split" role="img" aria-label="Кіріс пен шығыс арақатынасы"><span className="c-in" style={{ flex: incomeShare }}/><span className="c-out" style={{ flex: 100 - incomeShare }}/></div>
        <div className="ov-legend"><span><i className="c-in"/>Кіріс</span><b>{money(income)}</b><span><i className="c-out"/>Шығыс</span><b>{money(expense)}</b></div>
      </div>
      <div className="ov-cell">
        <span className="ov-label">Жұмсалмай қалған бөлік</span>
        <strong className="ov-big ov-green">{kept === null ? "—" : `${kept}%`}</strong>
        <div className="ov-meter" aria-hidden="true"><span style={{ width: `${kept ?? 0}%` }}/></div>
      </div>
    </section>

    {canSeed && <div className="empty-callout"><strong>Әзірге операция жоқ</strong><p>Өз деректеріңізді енгізіңіз немесе интерфейсті көру үшін үлгі мәліметтерді қосыңыз.</p><button className="text-button" disabled={busy} onClick={onSeed}>Үлгі деректерді қосу</button></div>}

    <section className="panel ov-flow">
      <div className="ov-flow-main">
        <div className="panel-heading">
          <div><h2>Ақша қозғалысы</h2><p className="ov-note">Кіріс пен шығыс айлар бойынша және қалдықтың өзгерісі</p></div>
          <div className="ov-keys"><span><i className="c-in"/>Кіріс</span><span><i className="c-out"/>Шығыс</span><span><i className="ov-key-line"/>Қалдық</span></div>
        </div>
        <svg className="ov-line" viewBox="0 0 700 80" preserveAspectRatio="none" role="img" aria-label="Қалдық динамикасы"><path d={line} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/></svg>
        <div className="ov-months" style={{ gridTemplateColumns: `repeat(${count},minmax(0,1fr))` }}>
          {months.map((m, i) => {
            const now = i === months.length - 1;
            return <div key={m.key} className={now ? "ov-month now" : "ov-month"} title={`+${money(m.income)} / −${money(m.expense)}`}>
              <div className="ov-bar-in"><span style={{ height: m.income ? Math.max(3, m.income / peak * 80) : 0 }}/></div>
              <div className="ov-bar-out"><span style={{ height: m.expense ? Math.max(3, m.expense / peak * 60) : 0 }}/></div>
              <small>{SHORT_MONTHS[m.month]}</small>
            </div>;
          })}
        </div>
      </div>
      <aside className="ov-side">
        <span className="ov-now"><i aria-hidden="true"/>Қазір</span>
        <strong>{FULL_MONTHS[current.month]} {current.year}</strong>
        <div className="ov-net">
          <span>Кіріс</span><b className="t-in">{money(current.income)}</b>
          <span>Шығыс</span><b className="t-out">{money(current.expense)}</b>
          <span>Таза</span><b className={current.income >= current.expense ? "positive" : "t-out"}>{current.income >= current.expense ? "+" : "−"}{money(Math.abs(current.income - current.expense))}</b>
        </div>
        <span className="ov-label ov-where">Қайда жұмсалды</span>
        {top.length ? top.map(([name, amount], i) => <div className="ov-cat" key={name}>
          <div><span>{name}</span><b>{money(amount)}</b></div>
          <div className="ov-cat-track"><span style={{ width: `${Math.max(4, amount / topMax * 100)}%`, background: colors[i % colors.length] }}/></div>
        </div>) : <p className="empty-small">Шығын қосылғанда талдау осында шығады.</p>}
      </aside>
    </section>

    <div className="ov-grid">
      <section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow">СОҢҒЫ ҚОЗҒАЛЫС</p><h2>Соңғы операциялар</h2></div><button className="text-button" onClick={onShowTransactions}>Барлығын көру</button></div>{visible.length ? <div className="tx-list">{visible.slice(0, 5).map(x => <TransactionRow key={x.id} tx={x}/>)}</div> : <p className="empty-small">Бұл кезеңде операция жоқ.</p>}</section>
      <div className="ov-stack">
        <section className="panel advice-panel"><div className="panel-heading"><div><p className="eyebrow">ЖЕКЕ ТАЛДАУ</p><h2>Үнемдеу кеңестері</h2></div><span className="advice-icon"><Lightbulb size={21}/></span></div><div className="advice-list">{insights.map((tip, i) => <div className="advice-item" key={i}><span className="advice-num">0{i + 1}</span><p>{tip}</p></div>)}</div><p className="advice-foot">Кеңестер сіз енгізген деректерден есептеледі.</p></section>
        <section className="panel sub-summary"><div className="panel-heading"><div><p className="eyebrow">ТҰРАҚТЫ ТӨЛЕМДЕР</p><h2>Жазылымдар</h2></div><RefreshCw size={20}/></div><strong className="sub-total">{money(monthlySubs)}<span> / ай</span></strong><p>{activeSubs.length} белсенді жазылым</p><div className="sub-preview">{activeSubs.slice(0, 2).map(x => <div key={x.id}><span className="service-dot">{x.merchant.slice(0, 1)}</span><span>{x.merchant}</span><strong>{money(x.monthlyAmount)}</strong></div>)}</div><button className="text-button" onClick={onShowSubscriptions}>Жазылымдарды басқару</button></section>
      </div>
    </div>
  </div>;
}

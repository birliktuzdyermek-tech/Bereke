"use client";

import { Lightbulb, RefreshCw } from "lucide-react";
import { TransactionRow } from "@/components/transaction-row";
import { colors, money } from "@/lib/format";
import { changePercent, type Analytics } from "@/lib/analytics";
import type { Sub, Tx } from "@/lib/finance-types";

const FULL_MONTHS = ["Қаңтар", "Ақпан", "Наурыз", "Сәуір", "Мамыр", "Маусым", "Шілде", "Тамыз", "Қыркүйек", "Қазан", "Қараша", "Желтоқсан"];
const SHORT_MONTHS = ["қаң", "ақп", "нау", "сәу", "мам", "мау", "шіл", "там", "қыр", "қаз", "қар", "жел"];
const monthIndex = (key: string) => Number(key.slice(5, 7)) - 1;
const delta = (current: number, previous: number) => {
  const value = changePercent(current, previous);
  return value === null ? "—" : `${value > 0 ? "+" : ""}${value}%`;
};

type OverviewProps = {
  stats: Analytics | null;
  statsError: boolean;
  visible: Tx[];
  period: string;
  activeSubs: Sub[];
  monthlySubs: number;
  insights: string[];
  canSeed: boolean;
  busy: boolean;
  onSeed: () => void;
  onShowTransactions: () => void;
  onShowSubscriptions: () => void;
};

export function Overview({ stats, statsError, visible, period, activeSubs, monthlySubs, insights, canSeed, busy, onSeed, onShowTransactions, onShowSubscriptions }: OverviewProps) {
  const seed = canSeed && <div className="empty-callout"><strong>Әзірге операция жоқ</strong><p>Өз деректеріңізді енгізіңіз немесе интерфейсті көру үшін үлгі мәліметтерді қосыңыз.</p><button className="text-button" disabled={busy} onClick={onSeed}>Үлгі деректерді қосу</button></div>;
  const lower = <div className="ov-grid">
    <section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow">СОҢҒЫ ҚОЗҒАЛЫС</p><h2>Соңғы операциялар</h2></div><button className="text-button" onClick={onShowTransactions}>Барлығын көру</button></div>{visible.length ? <div className="tx-list">{visible.slice(0, 5).map(x => <TransactionRow key={x.id} tx={x}/>)}</div> : <p className="empty-small">Бұл кезеңде операция жоқ.</p>}</section>
    <div className="ov-stack">
      <section className="panel advice-panel"><div className="panel-heading"><div><p className="eyebrow">ЖЕКЕ ТАЛДАУ</p><h2>Үнемдеу кеңестері</h2></div><span className="advice-icon"><Lightbulb size={21}/></span></div><div className="advice-list">{insights.map((tip, i) => <div className="advice-item" key={i}><span className="advice-num">0{i + 1}</span><p>{tip}</p></div>)}</div><p className="advice-foot">Кеңестер сіз енгізген деректерден есептеледі.</p></section>
      <section className="panel sub-summary"><div className="panel-heading"><div><p className="eyebrow">ТҰРАҚТЫ ТӨЛЕМДЕР</p><h2>Жазылымдар</h2></div><RefreshCw size={20}/></div><strong className="sub-total">{money(monthlySubs)}<span> / ай</span></strong><p>{activeSubs.length} белсенді жазылым</p><div className="sub-preview">{activeSubs.slice(0, 2).map(x => <div key={x.id}><span className="service-dot">{x.merchant.slice(0, 1)}</span><span>{x.merchant}</span><strong>{money(x.monthlyAmount)}</strong></div>)}</div><button className="text-button" onClick={onShowSubscriptions}>Жазылымдарды басқару</button></section>
    </div>
  </div>;

  if (!stats) {
    return <div className="overview">{seed}
      <section className="panel ov-state" role={statsError ? "alert" : "status"}>{statsError ? "Талдау деректерін жүктеу мүмкін болмады. Жаңарту батырмасын басыңыз." : "Деректер жүктелуде…"}</section>
      {lower}</div>;
  }

  const count = stats.months;
  const peak = Math.max(1, ...stats.monthly.map(m => Math.max(m.income, m.expense)));
  const lows = Math.min(...stats.monthly.map(m => m.balance));
  const span = Math.max(...stats.monthly.map(m => m.balance)) - lows || 1;
  const line = stats.monthly.map((m, i) => `${i ? "L" : "M"}${((i + 0.5) / count * 700).toFixed(1)},${(66 - (m.balance - lows) / span * 54).toFixed(1)}`).join(" ");
  const current = stats.monthly[stats.monthly.length - 1];
  const net = current.income - current.expense;
  const kept = stats.income > 0 ? Math.min(100, Math.max(0, Math.round(stats.balance / stats.income * 100))) : null;
  const incomeShare = stats.income + stats.expense > 0 ? stats.income / (stats.income + stats.expense) * 100 : 50;
  const rest = stats.categories.slice(4).reduce((sum, item) => sum + item.total, 0);
  const shown = [...stats.categories.slice(0, 4).map(item => ({ name: item.category, total: item.total })), ...(rest > 0 ? [{ name: "Басқалары", total: rest }] : [])];
  const share = (total: number) => stats.expense > 0 ? total / stats.expense * 100 : 0;
  const empty = stats.transactionCount === 0;

  return <div className="overview">
    <section className="panel ov-strip" aria-label="Қаржы көрсеткіштері">
      <div className="ov-cell">
        <span className="ov-label">Осы кезеңдегі қалдық</span>
        <strong className="ov-big">{money(stats.balance)}</strong>
        <span className="ov-note">{period} айлық кезең</span>
      </div>
      <div className="ov-cell">
        <div className="ov-split" role="img" aria-label="Кіріс пен шығыс арақатынасы"><span className="c-in" style={{ flex: incomeShare }}/><span className="c-out" style={{ flex: 100 - incomeShare }}/></div>
        <div className="ov-legend">
          <span><i className="c-in"/>Кіріс</span><b>{money(stats.income)}</b><small>{delta(stats.income, stats.previous.income)}</small>
          <span><i className="c-out"/>Шығыс</span><b>{money(stats.expense)}</b><small>{delta(stats.expense, stats.previous.expense)}</small>
        </div>
        <span className="ov-note">Алдыңғы кезеңмен салыстырғанда</span>
      </div>
      <div className="ov-cell">
        <span className="ov-label">Жұмсалмай қалған бөлік</span>
        <strong className="ov-big ov-green">{kept === null ? "—" : `${kept}%`}</strong>
        <div className="ov-meter" aria-hidden="true"><span style={{ width: `${kept ?? 0}%` }}/></div>
      </div>
    </section>

    {seed}

    <section className="panel ov-flow">
      <div className="ov-flow-main">
        <div className="panel-heading">
          <div><h2>Ақша қозғалысы</h2><p className="ov-note">Кіріс пен шығыс айлар бойынша және қалдықтың өзгерісі</p></div>
          <div className="ov-keys"><span><i className="c-in"/>Кіріс</span><span><i className="c-out"/>Шығыс</span><span><i className="ov-key-line"/>Қалдық</span></div>
        </div>
        {empty && <p className="ov-empty" role="status">Бұл кезеңде операция жоқ. Барлық көрсеткіш 0 ₸.</p>}
        <svg className="ov-line" viewBox="0 0 700 80" preserveAspectRatio="none" role="img" aria-label="Қалдық динамикасы"><path d={line} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/></svg>
        <div className="ov-months" style={{ gridTemplateColumns: `repeat(${count},minmax(0,1fr))` }}>
          {stats.monthly.map((m, i) => <div key={m.month} className={i === count - 1 ? "ov-month now" : "ov-month"} title={`+${money(m.income)} / −${money(m.expense)}`}>
            <div className="ov-bar-in"><span style={{ height: m.income ? Math.max(3, m.income / peak * 80) : 0 }}/></div>
            <div className="ov-bar-out"><span style={{ height: m.expense ? Math.max(3, m.expense / peak * 60) : 0 }}/></div>
            <small>{SHORT_MONTHS[monthIndex(m.month)]}</small>
          </div>)}
        </div>
        <details className="ov-details">
          <summary>Айлар бойынша кесте</summary>
          <div className="table-wrap"><table className="ov-table">
            <thead><tr><th>Ай</th><th className="right">Кіріс</th><th className="right">Шығыс</th><th className="right">Таза</th><th className="right">Қалдық</th></tr></thead>
            <tbody>{stats.monthly.map(m => <tr key={m.month}><td>{FULL_MONTHS[monthIndex(m.month)]} {m.month.slice(0, 4)}</td><td className="right">{money(m.income)}</td><td className="right">{money(m.expense)}</td><td className="right">{money(m.income - m.expense)}</td><td className="right">{money(m.balance)}</td></tr>)}</tbody>
            <tfoot><tr><th>Барлығы</th><th className="right">{money(stats.income)}</th><th className="right">{money(stats.expense)}</th><th className="right">{money(stats.balance)}</th><th className="right">{money(current.balance)}</th></tr></tfoot>
          </table></div>
        </details>
      </div>
      <aside className="ov-side">
        <span className="ov-now"><i aria-hidden="true"/>Қазір</span>
        <strong>{FULL_MONTHS[monthIndex(current.month)]} {current.month.slice(0, 4)}</strong>
        <div className="ov-net">
          <span>Кіріс</span><b className="t-in">{money(current.income)}</b>
          <span>Шығыс</span><b className="t-out">{money(current.expense)}</b>
          <span>Таза</span><b className={net >= 0 ? "positive" : "t-out"}>{net > 0 ? "+" : net < 0 ? "−" : ""}{money(Math.abs(net))}</b>
        </div>
        <span className="ov-label ov-where">Қайда жұмсалды</span>
        {shown.length ? shown.map((item, i) => <div className="ov-cat" key={item.name}>
          <div><span>{item.name}</span><b>{Math.round(share(item.total))}% · {money(item.total)}</b></div>
          <div className="ov-cat-track"><span style={{ width: `${Math.max(2, share(item.total))}%`, background: colors[i % colors.length] }}/></div>
        </div>) : <p className="empty-small">Шығын қосылғанда талдау осында шығады.</p>}
      </aside>
    </section>
    {lower}
  </div>;
}

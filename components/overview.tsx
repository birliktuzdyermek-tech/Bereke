"use client";

import { ArrowDownLeft, ArrowUpRight, Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { CategoryBadge } from "@/components/category-badge";
import { Donut } from "@/components/donut";
import { TransactionRow } from "@/components/transaction-row";
import { categoryColor } from "@/lib/categories";
import { groupByDay, money } from "@/lib/format";
import { changePercent, type Analytics } from "@/lib/analytics";
import type { Sub, Tx } from "@/lib/finance-types";

const FULL_MONTHS = ["Қаңтар", "Ақпан", "Наурыз", "Сәуір", "Мамыр", "Маусым", "Шілде", "Тамыз", "Қыркүйек", "Қазан", "Қараша", "Желтоқсан"];
const SHORT_MONTHS = ["қаң", "ақп", "нау", "сәу", "мам", "мау", "шіл", "там", "қыр", "қаз", "қар", "жел"];
const monthIndex = (key: string) => Number(key.slice(5, 7)) - 1;
const delta = (current: number, previous: number) => {
  const value = changePercent(current, previous);
  return value === null ? "—" : `${value > 0 ? "+" : ""}${value}%`;
};

/** Path of a polyline (and its area) through the running balance, scaled to a width x height box. */
function trend(values: number[], width: number, height: number, pad: number) {
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const points = values.map((value, i) => [values.length === 1 ? width / 2 : i / (values.length - 1) * width, height - pad - (value - low) / span * (height - pad * 2)]);
  if (points.length === 1) {
    const y = points[0][1];
    points.splice(0, 1, [0, y], [width, y]);
  }
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return { line, area: `${line} L${width},${height} L0,${height}Z`, last };
}

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
  const recent = groupByDay(visible.slice(0, 6));
  const lower = <div className="ov-grid">
    <section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow">СОҢҒЫ ҚОЗҒАЛЫС</p><h2>Соңғы операциялар</h2></div><button className="text-button" onClick={onShowTransactions}>Барлығын көру</button></div>{recent.length ? <div className="tx-list">{recent.map(group => <div key={group.key}><p className="day-label">{group.label}</p>{group.items.map(x => <TransactionRow key={x.id} tx={x}/>)}</div>)}</div> : <p className="empty-small">Бұл кезеңде операция жоқ.</p>}</section>
    <div className="ov-stack">
      <section className="panel advice-panel"><div className="panel-heading"><div><p className="eyebrow">ЖЕКЕ ТАЛДАУ</p><h2>Үнемдеу кеңестері</h2></div><span className="advice-icon"><Lightbulb size={21}/></span></div><div className="advice-list">{insights.map((tip, i) => <div className="advice-item" key={i}><span className="advice-num">0{i + 1}</span><p>{tip}</p></div>)}</div><p className="advice-foot">Кеңестер сіз енгізген деректерден есептеледі.</p></section>
      <section className="panel sub-summary"><div className="panel-heading"><div><p className="eyebrow">ТҰРАҚТЫ ТӨЛЕМДЕР</p><h2>Жазылымдар</h2></div><RefreshCw size={20}/></div><strong className="sub-total">{money(monthlySubs)}<span> / ай</span></strong><p>{activeSubs.length} белсенді жазылым</p><div className="sub-preview">{activeSubs.slice(0, 2).map(x => <div key={x.id}><span className="service-dot">{x.merchant.slice(0, 1)}</span><span>{x.merchant}</span><strong>{money(x.monthlyAmount)}</strong></div>)}</div><button className="text-button" onClick={onShowSubscriptions}>Жазылымдарды басқару</button></section>
    </div>
  </div>;

  if (!stats) {
    return <div className="overview">{seed}
      {statsError
        ? <section className="panel ov-state" role="alert">Талдау деректерін жүктеу мүмкін болмады. Жаңарту батырмасын басыңыз.</section>
        : <div className="ov-skeleton" role="status" aria-label="Деректер жүктелуде…"><span className="sk sk-hero"/><span className="sk sk-stat"/><span className="sk sk-stat"/><span className="sk sk-wide"/><span className="sk sk-wide"/></div>}
      {lower}</div>;
  }

  const count = stats.months;
  const peak = Math.max(1, ...stats.monthly.map(m => Math.max(m.income, m.expense)));
  const balances = stats.monthly.map(m => m.balance);
  const hero = trend(balances, 300, 64, 6);
  const flow = trend(balances, 700, 80, 12);
  const kept = stats.income > 0 ? Math.min(100, Math.max(0, Math.round(stats.balance / stats.income * 100))) : null;
  const rest = stats.categories.slice(4).reduce((sum, item) => sum + item.total, 0);
  const shown = [...stats.categories.slice(0, 4).map(item => ({ name: item.category, total: item.total, color: categoryColor(item.category) })), ...(rest > 0 ? [{ name: "Басқалары", total: rest, color: "#8A948C" }] : [])];
  const share = (total: number) => stats.expense > 0 ? Math.round(total / stats.expense * 100) : 0;
  const empty = stats.transactionCount === 0;
  const incomeDelta = delta(stats.income, stats.previous.income);
  const expenseDelta = delta(stats.expense, stats.previous.expense);

  return <div className="overview">
    <div className="ov-top" aria-label="Қаржы көрсеткіштері">
      <section className="ov-hero">
        <span className="ov-hero-label">Осы кезеңдегі қалдық</span>
        <strong className="ov-hero-num">{money(stats.balance)}</strong>
        <span className="ov-hero-meta"><span className="ov-pill"><Sparkles size={13}/>{kept === null ? "—" : <><b>{kept}%</b> жұмсалмай қалды</>}</span><span>{period} айлық кезең</span></span>
        <svg className="ov-hero-trend" viewBox="0 0 300 64" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="ov-hero-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".32"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient></defs>
          <path d={hero.area} fill="url(#ov-hero-fill)"/>
          <path d={hero.line} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
        </svg>
      </section>
      <section className="ov-stat">
        <span className="ov-stat-icon ov-in"><ArrowDownLeft size={20}/></span>
        <span className="ov-stat-label">Кіріс</span>
        <strong className="ov-stat-num">{money(stats.income)}</strong>
        <span className="ov-stat-delta"><b className={incomeDelta.startsWith("-") ? "t-out" : "t-up"}>{incomeDelta}</b> Алдыңғы кезеңмен салыстырғанда</span>
      </section>
      <section className="ov-stat">
        <span className="ov-stat-icon ov-out"><ArrowUpRight size={20}/></span>
        <span className="ov-stat-label">Шығыс</span>
        <strong className="ov-stat-num">{money(stats.expense)}</strong>
        <span className="ov-stat-delta"><b className={expenseDelta.startsWith("-") ? "t-up" : "t-out"}>{expenseDelta}</b> Алдыңғы кезеңмен салыстырғанда</span>
      </section>
    </div>

    {seed}

    <div className="ov-mid">
      <section className="panel ov-donut-card">
        <div className="panel-heading"><div><h2>Қайда жұмсалды</h2><p className="ov-note">{period} айлық кезең</p></div></div>
        {shown.length ? <div className="ov-donut-row">
          <Donut slices={shown} total={stats.expense} caption="жалпы шығын"/>
          <ul className="ov-legend-list">{shown.map(item => <li key={item.name}>
            {item.name === "Басқалары" ? <span className="cbadge cbadge-other" aria-hidden="true"><i className="dot" style={{ background: item.color }}/></span> : <CategoryBadge name={item.name}/>}
            <span className="ov-legend-name">{item.name}</span>
            <span className="ov-legend-val"><b>{money(item.total)}</b><small>{share(item.total)}%</small></span>
          </li>)}</ul>
        </div> : <p className="empty-small">Шығын қосылғанда талдау осында шығады.</p>}
      </section>

      <section className="panel ov-flow">
        <div className="panel-heading">
          <div><h2>Ақша қозғалысы</h2><p className="ov-note">Кіріс пен шығыс айлар бойынша және қалдықтың өзгерісі</p></div>
          <div className="ov-keys"><span><i className="c-in"/>Кіріс</span><span><i className="c-out"/>Шығыс</span><span><i className="ov-key-line"/>Қалдық</span></div>
        </div>
        {empty && <p className="ov-empty" role="status">Бұл кезеңде операция жоқ. Барлық көрсеткіш 0 ₸.</p>}
        <svg className="ov-line" viewBox="0 0 700 80" preserveAspectRatio="none" role="img" aria-label="Қалдық динамикасы">
          <defs><linearGradient id="ov-flow-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="ov-fill-top"/><stop offset="1" className="ov-fill-bottom"/></linearGradient></defs>
          <path d={flow.area} fill="url(#ov-flow-fill)"/>
          <path d={flow.line} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
        </svg>
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
            <tfoot><tr><th>Барлығы</th><th className="right">{money(stats.income)}</th><th className="right">{money(stats.expense)}</th><th className="right">{money(stats.balance)}</th><th className="right">{money(stats.monthly[stats.monthly.length - 1].balance)}</th></tr></tfoot>
          </table></div>
        </details>
      </section>
    </div>
    {lower}
  </div>;
}

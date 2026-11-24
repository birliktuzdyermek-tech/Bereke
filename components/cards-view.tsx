"use client";

import { useState } from "react";
import { CreditCard, Plus, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { money, shortDate } from "@/lib/format";
import type { Card, Tx } from "@/lib/finance-types";

const GRADIENTS = [
  "linear-gradient(135deg,#1E6B4A,#2C8A62)",
  "linear-gradient(135deg,#1C2420,#3A4A44)",
  "linear-gradient(135deg,#3A4A6B,#566A93)",
  "linear-gradient(135deg,#17706B,#1F8A84)",
];
// Recognisable colours for popular banks, matched on the name the user typed; other names fall back to the generic palette.
const BANKS: [RegExp, string][] = [
  [/kaspi|каспи/i, "linear-gradient(135deg,#C4241A,#F0483C)"],
  [/halyk|халык|қазақстан халық|народн/i, "linear-gradient(135deg,#0A7A3D,#25A559)"],
  [/jusan|жусан|жүсан/i, "linear-gradient(135deg,#E8590C,#FF9A3C)"],
  [/forte|форте/i, "linear-gradient(135deg,#7A1D4E,#C23A86)"],
  [/freedom|фридом/i, "linear-gradient(135deg,#0B3D2E,#1E8A5E)"],
  [/bcc|центркредит|center/i, "linear-gradient(135deg,#1B3FA0,#3F6FE0)"],
  [/sber|сбер/i, "linear-gradient(135deg,#0E8F3A,#53C25B)"],
  [/alfa|альфа/i, "linear-gradient(135deg,#B3141B,#EF3B3B)"],
  [/bereke|береке/i, "linear-gradient(135deg,#1E6B4A,#2C8A62)"],
];
const gradientFor = (card: Card) => BANKS.find(([pattern]) => pattern.test(card.bankName))?.[1] ?? GRADIENTS[card.id % GRADIENTS.length];
const initials = (name: string) => name.trim().slice(0, 1).toUpperCase();

export function CardsView({ cards, transactions, onAdd, onToggle, busy = false }: { cards: Card[]; transactions: Tx[]; onAdd: () => void; onToggle?: (card: Card) => void; busy?: boolean }) {
  const [pickedId, setPickedId] = useState<number | null>(null);
  const selected = cards.find(card => card.id === pickedId) ?? cards[0];
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; // local month, same as the overview chart
  const monthExpense = transactions.filter(tx => tx.type === "expense" && tx.txDate.startsWith(month)).reduce((sum, tx) => sum + tx.amount, 0);

  return <div className="cards-view">
    <div className="cards-intro"><ShieldCheck size={21}/><p>Банк картасының тек атауы мен соңғы төрт саны сақталады. Бұл сервис банк шотына қосылмайды және төлем жасамайды.</p></div>
    {!selected ? <div className="panel cards-empty"><CreditCard size={28}/><strong>Карта әзірге жоқ</strong><p>Операцияларды карталар бойынша көру үшін карта белгісін қосыңыз.</p><button className="primary-button" onClick={onAdd}><Plus size={18}/>Карта белгісін қосу</button></div> : (() => {
      const used = transactions.filter(tx => tx.cardId === selected.id);
      const spent = used.filter(tx => tx.type === "expense" && tx.txDate.startsWith(month)).reduce((sum, tx) => sum + tx.amount, 0);
      const share = monthExpense > 0 ? Math.round(spent / monthExpense * 100) : 0;
      return <div className="cards-layout">
        <div className="cards-list" role="group" aria-label="Карталар">
          {cards.map(card => <button key={card.id} aria-pressed={card.id === selected.id} className={card.id === selected.id ? "card-pick on" : "card-pick"} onClick={() => setPickedId(card.id)}>
            <span className="card-thumb" style={{ background: gradientFor(card) }}/>
            <span className="card-pick-text"><strong>{card.bankName}</strong><small>•••• {card.last4}{card.status === "inactive" ? " · белсенді емес" : ""}</small></span>
          </button>)}
          <button className="card-pick add" onClick={onAdd}><span className="card-thumb card-thumb-add"><Plus size={16}/></span><span className="card-pick-text"><strong>Карта белгісін қосу</strong></span></button>
        </div>
        <div className="panel card-detail">
          <div className="card-top">
            <div className={selected.status === "inactive" ? "bank-card is-inactive" : "bank-card"} style={{ background: gradientFor(selected) }}>
              <div><BrandLogo compact light /><CreditCard size={24}/></div>
              <strong>{selected.bankName}</strong>
              <small>•••• &nbsp; •••• &nbsp; •••• &nbsp; {selected.last4}</small>
            </div>
            <div className="card-facts">
              <span className="ov-label">Осы айда жұмсалды</span>
              <strong className="ov-big">{money(spent)}</strong>
              <div className="ov-meter" aria-hidden="true"><span style={{ width: `${share}%` }}/></div>
              <span className="ov-note"><b>{share}%</b> Барлық шығыстағы үлесі</span>
              {onToggle && <button className="text-button card-status-button" disabled={busy} onClick={() => onToggle(selected)}>{selected.status === "inactive" ? "Картаны қайта белсендіру" : "Картаны белсенді емес деп белгілеу"}</button>}
            </div>
          </div>
          <div className="card-history">
            <span className="ov-label">Осы картамен төленді</span>
            {used.length ? used.slice(0, 6).map(tx => <div className="card-tx" key={tx.id}>
              <span className="card-tx-ini">{initials(tx.merchant)}</span>
              <span className="tx-name"><strong>{tx.merchant}</strong><small>{tx.category} · {shortDate(tx.txDate)}</small></span>
              <strong className={tx.type === "income" ? "tx-amount positive" : "tx-amount"}>{tx.type === "income" ? "+" : "−"}{money(tx.amount)}</strong>
            </div>) : <p className="empty-small">Бұл карта бойынша операция жоқ.</p>}
          </div>
        </div>
      </div>;
    })()}
  </div>;
}

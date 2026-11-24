"use client";

import { AlertTriangle, CalendarClock, Check, EyeOff, Sparkles } from "lucide-react";
import { money, shortDate } from "@/lib/format";
import { AMOUNT_TOLERANCE, MONTH_DAYS, type Candidate } from "@/lib/recurring";

type Props = { candidates: Candidate[]; busy: boolean; onConfirm: (item: Candidate) => void; onIgnore: (item: Candidate) => void; onSeed?: () => void; ignoredCount?: number; onRestore?: () => void };

/** Likely subscriptions found in the user's own expenses. Nothing is saved until the user confirms. */
export function SubscriptionSuggestions({ candidates, busy, onConfirm, onIgnore, onSeed, ignoredCount = 0, onRestore }: Props) {
  return <section className="panel suggest-panel" aria-label="Ықтимал жазылымдар">
    <div className="panel-heading"><div><p className="eyebrow">АВТОМАТТЫ ТАЛДАУ</p><h2>Ықтимал жазылымдар</h2></div><span className="advice-icon"><Sparkles size={20}/></span></div>
    <p className="suggest-lead">Операцияларыңыздан ай сайын қайталанатын төлемдер табылды. Бұл — болжам: бірдей төлем әрдайым жазылым емес, сондықтан қолданушы растамайынша ешнәрсе сақталмайды.</p>
    {candidates.length ? <div className="suggest-list">{candidates.map(item => <article className="suggest-item" key={item.key}>
      <span className="service-dot large">{item.merchant.slice(0, 1).toUpperCase()}</span>
      <div className="suggest-body">
        <div className="suggest-title"><strong>{item.merchant}</strong><span className="suggest-tag">ықтимал жазылым</span></div>
        <p>{item.payments} рет қайталанды · соңғы төлем {shortDate(item.lastDate)}</p>
        <p className="suggest-next"><CalendarClock size={14}/>Келесі төлем болжамы: <b>{shortDate(item.nextPayment)}</b></p>
        {(item.amountChanged || item.missedMonth) && <p className="suggest-warn"><AlertTriangle size={14}/>{[item.amountChanged && "Соңғы төлем сомасы өзгерген", item.missedMonth && "Бір ай өткізіліп кеткен"].filter(Boolean).join(" · ")}</p>}
      </div>
      <div className="suggest-side">
        <strong>{money(item.amount)}<small> / ай</small></strong>
        <div className="suggest-actions">
          <button className="primary-button small-button" disabled={busy} onClick={() => onConfirm(item)}><Check size={15}/>Растау</button>
          <button className="text-button" disabled={busy} onClick={() => onIgnore(item)}><EyeOff size={14}/> Елемеу</button>
        </div>
      </div>
    </article>)}</div> : <p className="empty-small">Қазір қайталанатын төлем табылмады. Жаңа операциялар қосылғанда талдау қайта жүргізіледі.</p>}
    {!candidates.length && onSeed && <button className="text-button" disabled={busy} onClick={onSeed}>Үлгі қайталанатын төлемдерді қосу (Netflix, Yandex Plus)</button>}
    {ignoredCount > 0 && onRestore && <button className="text-button" disabled={busy} onClick={onRestore}>Елеген сатушыларды қайта көрсету ({ignoredCount})</button>}
    <details className="suggest-rules"><summary>Қалай анықталады және келесі күн қалай есептеледі?</summary>
      <ol>
        <li>Тек шығыс операциялар алынады, сатушы атауы қалыпқа келтіріледі (әріпке дейін кішірейтіледі, сандар мен таңбалар алынады): «NETFLIX *4421» мен «Netflix» бір сатушы.</li>
        <li>Төлем <b>{MONTH_DAYS.min}–{MONTH_DAYS.max} күн</b> сайын қайталануы керек (ай сайын). Бір реттік төлем жазылым болып бекітілмейді.</li>
        <li>Екі көрші төлемнің сомасы <b>{Math.round(AMOUNT_TOLERANCE * 100)}%</b>-дан артық айырмашылықсыз болуы керек. Сома әр айда өзгеретін дүкен (мысалы, азық-түлік) жазылым емес.</li>
        <li>Соңғы төлем сомасы өзгерсе немесе бір ай (55–65 күн аралық) өткізілсе — белгі көрсетіледі, бірақ жазылым жойылмайды.</li>
        <li><b>Келесі төлем күні</b> = соңғы төлем күні + 1 ай (сол күні; қысқа айда соңғы күні, мысалы 31 қаңтар → 28 ақпан). Егер ол күн өтіп кетсе, бүгінге дейін айлар қосыла береді.</li>
      </ol>
    </details>
  </section>;
}

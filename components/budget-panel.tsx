"use client";

import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { translateText, type Locale } from "@/lib/translations";

export type Budget = { id: number; category: string; monthlyLimit: number; spent: number };
type Expense = { category: string; amount: number; type: "income" | "expense"; txDate: string };

const money = (amount: number) => new Intl.NumberFormat("kk-KZ").format(amount) + " ₸";

export function BudgetPanel({ budgets, transactions, categories, demo, onSave, onDelete }: {
  budgets: Budget[];
  transactions: Expense[];
  categories: string[];
  demo: boolean;
  onSave: (category: string, limit: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [category, setCategory] = useState(categories[0]);
  const [amount, setAmount] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const items = budgets.map(budget => ({
    ...budget,
    spent: demo ? transactions.filter(item => item.type === "expense" && item.category === budget.category && item.txDate.startsWith(month)).reduce((sum, item) => sum + item.amount, 0) : budget.spent,
  }));
  const totalLimit = items.reduce((sum, item) => sum + item.monthlyLimit, 0);
  const totalSpent = items.reduce((sum, item) => sum + item.spent, 0);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const limit = Number(amount);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000_000_000) { setError("Айлық лимитті дұрыс енгізіңіз"); return; }
    setBusy(true); setError("");
    try { await onSave(category, limit); setEditing(false); setAmount(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Қате пайда болды"); }
    finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    const savedLocale = localStorage.getItem("bereke-locale");
    const locale: Locale = savedLocale === "ru" || savedLocale === "en" ? savedLocale : "kk";
    if (!window.confirm(translateText("Бюджет лимитін жою керек пе?", locale))) return;
    setBusy(true); setError("");
    try { await onDelete(id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Қате пайда болды"); }
    finally { setBusy(false); }
  };

  return <div className="budget-page">
    <div className="panel budget-summary"><div><span>Осы айдың лимиті</span><strong>{money(totalLimit)}</strong></div><div><span>Лимиті бар санаттарда жұмсалды</span><strong>{money(totalSpent)}</strong></div><div><span>{totalSpent > totalLimit ? "Лимиттен асты" : "Қалғаны"}</span><strong className={totalSpent > totalLimit ? "budget-over" : ""}>{money(Math.abs(totalLimit - totalSpent))}</strong></div></div>
    <div className="budget-toolbar"><p>Лимит әр айда қайта басталады. Шығындар операциялардан есептеледі.</p><button className="primary-button" type="button" onClick={() => { setEditing(true); setError(""); }}><Plus size={18}/> Лимит қосу</button></div>
    {editing && <form className="panel budget-form" onSubmit={submit}><label>Санат<select value={category} onChange={event => { const next = event.target.value; setCategory(next); setAmount(String(items.find(item => item.category === next)?.monthlyLimit || "")); }}>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label>Айлық лимит, ₸<input type="number" min="1" max="1000000000" step="1" required value={amount} onChange={event => setAmount(event.target.value)} /></label><div className="budget-form-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? "Сақталуда…" : "Сақтау"}</button><button className="auth-text-button" type="button" onClick={() => setEditing(false)}>Бас тарту</button></div>{error && <p className="auth-error" role="alert">{error}</p>}</form>}
    {!editing && error && <p className="auth-error" role="alert">{error}</p>}
    <div className="budget-grid">{items.map(item => { const percent = Math.round(item.spent / item.monthlyLimit * 100); const over = item.spent > item.monthlyLimit; return <article className="panel budget-card" key={item.id}><div className="budget-card-heading"><h2>{item.category}</h2><button type="button" className="row-action" aria-label={`${item.category} лимитін жою`} title="Жою" disabled={busy} onClick={() => void remove(item.id)}><Trash2 size={17}/></button></div><div className="budget-amounts"><strong>{money(item.spent)}</strong><span>/ {money(item.monthlyLimit)}</span></div><div className="budget-progress" role="progressbar" aria-label={item.category} aria-valuenow={Math.min(percent, 100)} aria-valuemin={0} aria-valuemax={100}><span className={over ? "over" : ""} style={{ width: `${Math.min(percent, 100)}%` }} /></div><p className={over ? "budget-over" : ""}>{over ? `Лимит ${money(item.spent - item.monthlyLimit)}-ге асты` : `Қалғаны: ${money(item.monthlyLimit - item.spent)}`}</p><button type="button" className="text-button" onClick={() => { setCategory(item.category); setAmount(String(item.monthlyLimit)); setEditing(true); setError(""); }}>Лимитті өзгерту</button></article>; })}{items.length === 0 && <div className="panel budget-empty"><h2>Әзірге лимит жоқ</h2><p>Шығын санатын таңдап, айлық лимит қойыңыз.</p></div>}</div>
  </div>;
}

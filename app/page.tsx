"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowDownLeft, ArrowUpRight, CreditCard, Target, LayoutDashboard, LogOut, Pencil, Plus, ReceiptText, RefreshCw, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { AuthDialog, type AuthMode } from "@/components/auth-dialog";
import { BudgetPanel } from "@/components/budget-panel";
import { Overview } from "@/components/overview";
import { CardsView } from "@/components/cards-view";
import { money, shortDate, today } from "@/lib/format";
import { analyticsFromRows, periodBounds, type Analytics } from "@/lib/analytics";
import type { Finance, Sub, Tx } from "@/lib/finance-types";
import { PreferencesControls } from "@/components/preferences-provider";
import { apiFetch } from "@/lib/api-fetch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Modal = "transaction" | "subscription" | "card" | null;
const categories = ["Азық-түлік", "Көлік", "Тамақтану", "Тұрғын үй", "Денсаулық", "Ойын-сауық", "Білім", "Сауда", "Басқа"];
const monthsAgo = (months: number, day: number) => { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth() - months, day)).toISOString().slice(0, 10); };
const sampleTx: [string, string, number, Tx["type"], number, number, number | null][] = [
  ["Жалақы", "Жалақы", 480000, "income", 0, 1, null], ["Magnum", "Азық-түлік", 28500, "expense", 0, 2, 1], ["Такси", "Көлік", 6800, "expense", 0, 3, 1],
  ["Кафе", "Тамақтану", 12500, "expense", 0, 3, 1], ["Фриланс", "Қосымша табыс", 85000, "income", 0, 4, null], ["Кино", "Ойын-сауық", 7900, "expense", 0, 4, 1],
  ["Жалақы", "Жалақы", 480000, "income", 1, 1, null], ["Пәтер жалы", "Тұрғын үй", 150000, "expense", 1, 5, null], ["Magnum", "Азық-түлік", 64200, "expense", 1, 9, 1], ["Дәріхана", "Денсаулық", 9800, "expense", 1, 14, 1],
  ["Жалақы", "Жалақы", 480000, "income", 2, 1, null], ["Пәтер жалы", "Тұрғын үй", 150000, "expense", 2, 5, null], ["Киім дүкені", "Сауда", 58000, "expense", 2, 17, 1], ["Фриланс", "Қосымша табыс", 120000, "income", 2, 20, null],
  ["Жалақы", "Жалақы", 450000, "income", 3, 1, null], ["Пәтер жалы", "Тұрғын үй", 150000, "expense", 3, 5, null], ["Magnum", "Азық-түлік", 71300, "expense", 3, 11, 1],
  ["Жалақы", "Жалақы", 450000, "income", 4, 1, null], ["Пәтер жалы", "Тұрғын үй", 150000, "expense", 4, 5, null], ["Курс", "Білім", 45000, "expense", 4, 12, null],
  ["Жалақы", "Жалақы", 450000, "income", 5, 1, null], ["Пәтер жалы", "Тұрғын үй", 150000, "expense", 5, 5, null], ["Такси", "Көлік", 21400, "expense", 5, 18, 1],
];
const sample: Finance = { user: { name: "Ерасыл", email: "Үлгі кабинет" }, budgets: [], cards: [{ id: 1, bankName: "Kaspi Gold", last4: "2486" }, { id: 2, bankName: "Halyk Bank", last4: "7310" }],
  transactions: sampleTx.map(([merchant, category, amount, type, ago, day, cardId], i) => ({ id: i + 1, merchant, category, amount, type, txDate: monthsAgo(ago, day) > today() ? today() : monthsAgo(ago, day), cardId })),
  subscriptions: [{ id: 1, merchant: "YouTube Premium", monthlyAmount: 2690, nextPayment: today(), status: "active" }, { id: 2, merchant: "Spotify", monthlyAmount: 2390, nextPayment: today(), status: "active" }] };

export default function Home() {
  const [data, setData] = useState<Finance | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("overview");
  const [period, setPeriod] = useState("3");
  const [modal, setModal] = useState<Modal>(null);
  const [editingTransaction, setEditingTransaction] = useState<Tx | null>(null);
  const [formError, setFormError] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [form, setForm] = useState({ merchant: "", category: "Азық-түлік", amount: "", type: "expense", txDate: today(), cardId: "", monthlyAmount: "", nextPayment: today(), bankName: "", last4: "" });
  const load = useCallback(async () => { setLoading(true); try { const r = await fetch("/api/finance", { cache: "no-store" }); if (r.status === 401) { if (["127.0.0.1", "localhost"].includes(location.hostname)) { setDemo(true); setData(sample); setError(""); } else { setData(null); setDemo(false); setError("Жеке кабинетке кіру керек."); } return; } if (!r.ok) throw new Error("Деректерді жүктеу мүмкін болмады."); const next = await r.json() as Finance; setData(next); setProfileName(next.user.name); setDemo(false); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Қате пайда болды"); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const change = async (method: string, body?: Record<string, unknown>, url = "/api/finance") => { setBusy(true); setNotice(""); setFormError(""); try { if (demo && data) {
    if (method === "DELETE") setData({ ...data, transactions: data.transactions.filter(x => x.id !== Number(new URL(url, location.origin).searchParams.get("id"))) });
    else if (method === "PATCH" && body?.kind === "transaction") setData({ ...data, transactions: data.transactions.map(x => x.id === body.id ? { ...x, merchant: String(body.merchant), category: String(body.category), amount: Number(body.amount), type: body.type as Tx["type"], txDate: String(body.txDate), cardId: body.cardId ? Number(body.cardId) : null } : x) });
    else if (method === "PATCH") setData({ ...data, subscriptions: data.subscriptions.map(x => x.id === body?.id ? { ...x, status: body.status as Sub["status"] } : x) });
    else if (body?.kind === "transaction") setData({ ...data, transactions: [{ id: Date.now(), merchant: String(body.merchant), category: String(body.category), amount: Number(body.amount), type: body.type as Tx["type"], txDate: String(body.txDate), cardId: body.cardId ? Number(body.cardId) : null }, ...data.transactions] });
    else if (body?.kind === "subscription") setData({ ...data, subscriptions: [{ id: Date.now(), merchant: String(body.merchant), monthlyAmount: Number(body.monthlyAmount), nextPayment: String(body.nextPayment), status: "active" }, ...data.subscriptions] });
    else if (body?.kind === "card") setData({ ...data, cards: [{ id: Date.now(), bankName: String(body.bankName), last4: String(body.last4) }, ...data.cards] });
  } else { const r = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); const result = await r.json() as { error?: string }; if (!r.ok) throw new Error(result.error || "Әрекет орындалмады"); await load(); } setModal(null); setEditingTransaction(null); setNotice("Өзгеріс сақталды"); } catch (e) { const message = e instanceof Error ? e.message : "Қате пайда болды"; if (modal) setFormError(message); else setNotice(message); } finally { setBusy(false); } };
  const rows = useMemo(() => data?.transactions || [], [data]);
  const months = Number(period);
  // One dataset per period: signed-in users get it from SQL (/api/analytics), the demo account computes it locally.
  const [fetched, setFetched] = useState<{ source: Finance; months: number; value: Analytics } | null>(null);
  const [statsError, setStatsError] = useState(false);
  useEffect(() => {
    if (!data || demo) return;
    let live = true;
    fetch(`/api/analytics?months=${months}`, { cache: "no-store" })
      .then(r => r.ok ? r.json() as Promise<Analytics> : Promise.reject(new Error("analytics")))
      .then(value => { if (live) { setFetched({ source: data, months, value }); setStatsError(false); } })
      .catch(() => { if (live) setStatsError(true); });
    return () => { live = false; };
  }, [data, demo, months]);
  const localStats = useMemo(() => demo ? analyticsFromRows(rows, months) : null, [demo, rows, months]);
  const stats: Analytics | null = demo ? localStats : fetched && fetched.source === data && fetched.months === months ? fetched.value : null;
  const bounds = periodBounds(months);
  const visible = useMemo(() => rows.filter(x => x.txDate >= bounds.from && x.txDate <= bounds.to), [rows, bounds.from, bounds.to]);
  const income = stats?.income ?? 0;
  const expense = stats?.expense ?? 0;
  const byCategory = useMemo<[string, number][]>(() => (stats?.categories || []).map(item => [item.category, item.total]), [stats]);
  const activeSubs = (data?.subscriptions || []).filter(x => x.status === "active");
  const monthlySubs = activeSubs.reduce((s, x) => s + x.monthlyAmount, 0);
  const filtered = visible.filter(x => (categoryFilter === "all" || x.category === categoryFilter) && `${x.merchant} ${x.category}`.toLowerCase().includes(query.toLowerCase()));
  const insights = [byCategory[0] ? `${byCategory[0][0]} санатына ${money(byCategory[0][1])} жұмсалды. Бұл кезеңдегі ең үлкен шығын бағыты.` : "Шығындарыңызды енгізсеңіз, негізгі шығын санатын көрсетеміз.", monthlySubs ? `Белсенді жазылымдарға айына ${money(monthlySubs)} кетеді. Қолданбайтын сервистерді тексеріңіз.` : "Жазылым қоссаңыз, ай сайынғы тұрақты төлемдеріңізді көресіз.", income > 0 ? `Кірістің ${Math.max(0, Math.round((income - expense) / income * 100))}% осы кезеңде жұмсалмай қалды. Қалаған бөлігін жинаққа бөлуге болады.` : "Үнемдеу үлесін көру үшін кірісіңізді қосыңыз."];
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); if (modal === "transaction") change(editingTransaction ? "PATCH" : "POST", { kind: "transaction", id: editingTransaction?.id, merchant: form.merchant, category: form.category, amount: Number(form.amount), type: form.type, txDate: form.txDate, cardId: form.cardId || null }); if (modal === "subscription") change("POST", { kind: "subscription", merchant: form.merchant, monthlyAmount: Number(form.monthlyAmount), nextPayment: form.nextPayment }); if (modal === "card") change("POST", { kind: "card", bankName: form.bankName, last4: form.last4 }); };
  const openNewTransaction = () => { setEditingTransaction(null); setFormError(""); setForm(previous => ({ ...previous, merchant: "", category: "Азық-түлік", amount: "", type: "expense", txDate: today(), cardId: "" })); setModal("transaction"); };
  const openEditTransaction = (item: Tx) => { setEditingTransaction(item); setFormError(""); setForm(previous => ({ ...previous, merchant: item.merchant, category: item.category, amount: String(item.amount), type: item.type, txDate: item.txDate, cardId: item.cardId ? String(item.cardId) : "" })); setModal("transaction"); };
  const signOut = async () => {
    if (data?.user.provider === "platform") { location.href = "/signout-with-chatgpt?return_to=/"; return; }
    try { const response = await apiFetch("/api/auth", { method: "DELETE" }); if (!response.ok) throw new Error("Шығу мүмкін болмады"); setTab("overview"); await load(); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "Қате пайда болды"); }
  };
  const saveBudget = async (category: string, monthlyLimit: number) => {
    if (demo && data) {
      const existing = data.budgets.find(item => item.category === category);
      const next = { id: existing?.id || Date.now(), category, monthlyLimit, spent: 0 };
      setData({ ...data, budgets: existing ? data.budgets.map(item => item.id === existing.id ? next : item) : [...data.budgets, next] });
    } else {
      const response = await apiFetch("/api/budgets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, monthlyLimit }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Сақтау мүмкін болмады");
      await load();
    }
    setNotice("Бюджет сақталды");
  };
  const deleteBudget = async (id: number) => {
    if (demo && data) setData({ ...data, budgets: data.budgets.filter(item => item.id !== id) });
    else {
      const response = await apiFetch(`/api/budgets?id=${id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Бюджетті жою мүмкін болмады");
      await load();
    }
    setNotice("Бюджет жойылды");
  };
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setProfileBusy(true); setNotice("");
    try {
      const response = await apiFetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: profileName }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Профиль сақталмады");
      await load(); setNotice("Профиль сақталды");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Қате пайда болды"); }
    finally { setProfileBusy(false); }
  };
  const resendVerification = async () => {
    setProfileBusy(true); setNotice("");
    try {
      const response = await apiFetch("/api/email-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Хатты жіберу мүмкін болмады");
      setNotice("Растау сілтемесі email арқылы жіберілді");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Қате пайда болды"); }
    finally { setProfileBusy(false); }
  };
  useEffect(() => {
    type WebContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: object; execute: (input: unknown) => Promise<object> }, options: { signal: AbortSignal }) => void | Promise<void> };
    const context = (document as Document & { modelContext?: WebContext }).modelContext;
    if (!context?.registerTool || !data || demo) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<WebContext["registerTool"]>[0]) => { try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch {} };
    register({ name: "get_finance_summary", title: "Қаржы жиынтығын оқу", description: "Ағымдағы кезеңнің кіріс, шығыс және жазылым жиынтығын қайтарады.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: async () => ({ income, expense, balance: income - expense, monthlySubscriptions: monthlySubs, periodMonths: Number(period) }) });
    register({ name: "create_transaction", title: "Операция қосу", description: "Қолданушының қаржы жазбасына жаңа кіріс не шығыс операциясын қосады.", inputSchema: { type: "object", properties: { merchant: { type: "string" }, category: { type: "string" }, amount: { type: "integer", minimum: 1 }, type: { type: "string", enum: ["income", "expense"] }, txDate: { type: "string", format: "date" } }, required: ["merchant", "category", "amount", "type", "txDate"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: async (input) => { const x = input as Record<string, unknown>; if (typeof x?.merchant !== "string" || !x.merchant.trim() || typeof x.category !== "string" || !x.category.trim() || !Number.isSafeInteger(x.amount) || Number(x.amount) < 1 || !["income", "expense"].includes(String(x.type)) || typeof x.txDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x.txDate)) throw new Error("Операция деректері қате"); const r = await apiFetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "transaction", ...x }) }); const result = await r.json() as { error?: string; item?: { id: number } }; if (!r.ok || !result.item) throw new Error(result.error || "Сақтау мүмкін болмады"); await load(); return { id: result.item.id, saved: true }; } });
    return () => lifecycle.abort();
  }, [data, demo, income, expense, monthlySubs, period, load]);
  const menu = [{ id: "overview", label: "Шолу", icon: LayoutDashboard }, { id: "transactions", label: "Операциялар", icon: ReceiptText }, { id: "budgets", label: "Бюджеттер", icon: Target }, { id: "subscriptions", label: "Жазылымдар", icon: RefreshCw }, { id: "cards", label: "Карталар", icon: CreditCard }, { id: "profile", label: "Профиль", icon: UserRound }];
  return <div className="app-shell"><aside className="sidebar"><Link className="brand" href="/about"><BrandLogo /></Link><p className="sidebar-label">ЖЕКЕ КАБИНЕТ</p><nav aria-label="Негізгі бөлімдер" className="side-nav">{menu.map(item => <button key={item.id} className={tab === item.id ? "nav-item active" : "nav-item"} onClick={() => setTab(item.id)}><item.icon size={19} strokeWidth={1.8}/>{item.label}</button>)}</nav><div className="side-bottom"><Link className="about-side-link" href="/about">Жоба туралы</Link><div className="privacy-note"><ShieldCheck size={21}/><strong>Деректеріңіз қорғалған</strong><span>Тек картаның соңғы 4 саны сақталады.</span></div><div className="side-user"><span className="avatar">{(data?.user.name || "Б").slice(0, 1).toUpperCase()}</span><span><strong>{data?.user.name || "Қолданушы"}</strong><small>{data?.user.email || "Жеке кабинет"}</small></span></div></div></aside>
  <div className="main-area"><header className="topbar"><div className="mobile-brand"><BrandLogo compact /></div><span className="topbar-title">Жеке қаржы кеңістігі</span><div className="topbar-actions"><PreferencesControls/><span className="secure-label"><ShieldCheck size={16}/> Қауіпсіз кабинет</span>{demo || !data ? <div className="auth-actions"><button className="auth-text-button" onClick={() => setAuthMode("login")}>Кіру</button><button className="primary-button auth-header-button" onClick={() => setAuthMode("register")}>Тіркелу</button></div> : <><button className="profile-shortcut" onClick={() => setTab("profile")} aria-label="Профильді ашу"><span className="avatar top-avatar">{data.user.name.slice(0, 1).toUpperCase()}</span><span>{data.user.name}</span></button><button className="icon-button" title="Шығу" aria-label="Шығу" onClick={signOut}><LogOut size={18}/></button></>}<button className="icon-button refresh-button" title="Деректерді жаңарту" aria-label="Деректерді жаңарту" onClick={load}><RefreshCw size={18}/></button></div></header><main className="content">
  {demo && <div className="demo-banner">Алдын ала қарау: үлгі деректер. Өзгерістер бұл бетте ғана сақталады. <button onClick={() => setAuthMode("register")}>Тіркеліп, жеке кабинет ашу</button></div>}{error && <div className="error-banner" role="alert">{error} {error.includes("кіру") ? <button onClick={() => setAuthMode("login")}>Кіру</button> : <button onClick={load}>Қайталау</button>}</div>}{notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Жабу">×</button></div>}
  <div className="page-heading"><div><p className="eyebrow">{tab === "profile" ? "ЖЕКЕ КАБИНЕТ" : tab === "budgets" ? "АЙЛЫҚ БЮДЖЕТ" : "ҚАРЖЫ ШОЛУЫ"}</p><h1>{tab === "overview" ? "Қайырлы күн!" : tab === "transactions" ? "Операциялар" : tab === "budgets" ? "Бюджеттер" : tab === "subscriptions" ? "Жазылымдар" : tab === "cards" ? "Карталар" : "Менің профилім"}</h1><p className="heading-sub">{tab === "overview" ? "Ақшаңыздың қозғалысын бір жерден бақылаңыз." : tab === "transactions" ? "Кіріс пен шығысты тіркеп, керегін тез табыңыз." : tab === "budgets" ? "Әр санатқа айлық лимит қойып, шығынды бақылаңыз." : tab === "subscriptions" ? "Ай сайынғы төлемдерді қадағалаңыз." : tab === "cards" ? "Карталарыңызды қауіпсіз түрде белгілеңіз." : "Тіркелгі деректеріңізді қараңыз және өзгертіңіз."}</p></div>{tab !== "profile" && tab !== "budgets" && <div className="heading-actions">{tab !== "cards" && <Select value={period} onValueChange={setPeriod}><SelectTrigger className="period-select" aria-label="Талдау кезеңі"><SelectValue/></SelectTrigger><SelectContent>{[["1","1 ай"],["3","3 ай"],["6","6 ай"],["12","12 ай"]].map(([v,t]) => <SelectItem key={v} value={v}>{t}</SelectItem>)}</SelectContent></Select>}<button className="primary-button" onClick={() => tab === "subscriptions" ? setModal("subscription") : tab === "cards" ? setModal("card") : openNewTransaction()}><Plus size={18}/>{tab === "subscriptions" ? "Жазылым қосу" : tab === "cards" ? "Карта қосу" : "Операция қосу"}</button></div>}</div>
  {loading && !data ? <div className="loading">Деректер жүктелуде…</div> : !data ? null : <Tabs value={tab} onValueChange={setTab} className="main-tabs"><TabsList className="mobile-nav" aria-label="Бөлімдер">{menu.map(item => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}</TabsList>
  <TabsContent value="overview"><Overview stats={stats} statsError={statsError} visible={visible} period={period} activeSubs={activeSubs} monthlySubs={monthlySubs} insights={insights} canSeed={rows.length === 0 && !demo} busy={busy} onSeed={() => change("POST", { kind: "seed" })} onShowTransactions={() => setTab("transactions")} onShowSubscriptions={() => setTab("subscriptions")}/></TabsContent>
  <TabsContent value="transactions"><div className="panel full-panel"><div className="list-toolbar"><input className="search-input" aria-label="Операцияларды іздеу" placeholder="Атауы немесе санат бойынша іздеу" value={query} onChange={e => setQuery(e.target.value)}/><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="filter-select" aria-label="Санат сүзгісі"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Барлық санат</SelectItem>{Array.from(new Set(rows.map(x => x.category))).map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div><div className="table-wrap"><table><thead><tr><th>Операция</th><th>Санат</th><th>Күні</th><th className="right">Сома</th><th className="right">Әрекет</th></tr></thead><tbody>{filtered.map(x => <tr key={x.id}><td><span className={x.type === "income" ? "tx-icon tx-income" : "tx-icon"}>{x.type === "income" ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}</span><strong>{x.merchant}</strong></td><td>{x.category}</td><td>{shortDate(x.txDate)}</td><td className={x.type === "income" ? "right positive" : "right"}>{x.type === "income" ? "+" : "−"}{money(x.amount)}</td><td className="right"><button className="row-action" aria-label={`${x.merchant} операциясын өзгерту`} title="Өзгерту" onClick={() => openEditTransaction(x)}><Pencil size={16}/></button><button className="row-action" aria-label={`${x.merchant} операциясын жою`} title="Жою" onClick={() => { if (window.confirm("Операцияны жою керек пе?")) change("DELETE", undefined, `/api/finance?id=${x.id}`); }}><Trash2 size={16}/></button></td></tr>)}</tbody></table>{filtered.length === 0 && <p className="empty-small">Операция табылмады.</p>}</div></div></TabsContent>
  <TabsContent value="budgets"><BudgetPanel budgets={data.budgets || []} transactions={rows} categories={categories} demo={demo} onSave={saveBudget} onDelete={deleteBudget}/></TabsContent>
  <TabsContent value="subscriptions"><div className="subscriptions-head"><div><span>Ай сайынғы төлем</span><strong>{money(monthlySubs)}</strong></div><p>Жазылымдарды қолмен бақылайсыз. «Тоқтатылды» белгісі провайдердегі жазылымды автоматты түрде тоқтатпайды.</p></div><div className="subscription-grid">{data.subscriptions.map(x => <div className="panel subscription-card" key={x.id}><div className="service-dot large">{x.merchant.slice(0,1)}</div><div><strong>{x.merchant}</strong><span className={x.status === "active" ? "status active-status" : "status"}>{x.status === "active" ? "Белсенді" : "Тоқтатылды"}</span></div><p>Келесі төлем: {shortDate(x.nextPayment)}</p><div className="subscription-footer"><strong>{money(x.monthlyAmount)}<small> / ай</small></strong><button className="text-button" disabled={busy} onClick={() => change("PATCH", { id: x.id, status: x.status === "active" ? "cancelled" : "active" })}>{x.status === "active" ? "Тоқтатылды деп белгілеу" : "Қайта белсендіру"}</button></div></div>)}{data.subscriptions.length === 0 && <div className="panel empty-panel">Жазылым әзірге жоқ. Ай сайынғы төлемді қосып бастаңыз.</div>}</div></TabsContent>
  <TabsContent value="cards"><CardsView cards={data.cards} transactions={rows} onAdd={() => setModal("card")}/></TabsContent>
  <TabsContent value="profile"><div className="panel profile-panel">{demo ? <div className="profile-guest"><span className="profile-avatar"><UserRound size={30}/></span><h2>Жеке профиліңізді ашыңыз</h2><p>Тіркелген соң қаржы деректеріңіз жеке кабинетіңізде сақталады.</p><div className="profile-guest-actions"><button className="primary-button" onClick={() => setAuthMode("register")}>Тіркелу</button><button className="auth-text-button" onClick={() => setAuthMode("login")}>Кіру</button></div></div> : <><div className="profile-heading"><span className="profile-avatar">{data.user.name.slice(0, 1).toUpperCase()}</span><div><h2>{data.user.name}</h2><p>{data.user.email}</p></div></div><form className="profile-form" onSubmit={saveProfile}><label>Аты-жөніңіз<input required minLength={2} maxLength={80} disabled={data.user.provider !== "local" || profileBusy} value={profileName} onChange={event => setProfileName(event.target.value)}/></label><label>Email<input value={data.user.email} readOnly /></label>{data.user.provider === "local" && <div className="email-verification"><strong>{data.user.emailVerified ? "Email расталды" : "Email расталмаған"}</strong>{!data.user.emailVerified && <button type="button" className="auth-link-button" disabled={profileBusy} onClick={resendVerification}>Растау хатын қайта жіберу</button>}</div>}{data.user.phone && <label>Телефон нөмірі<input value={data.user.phone} readOnly /></label>}{data.user.provider === "local" ? <button className="primary-button" disabled={profileBusy || profileName.trim() === data.user.name} type="submit">{profileBusy ? "Сақталуда…" : "Өзгерісті сақтау"}</button> : <p className="form-help">Бұл профильдің деректері сыртқы тіркелгі арқылы басқарылады.</p>}</form><button className="profile-signout" onClick={signOut}><LogOut size={17}/> Шығу</button></>}</div></TabsContent></Tabs>}
  </main></div>
  <Dialog open={modal !== null} onOpenChange={open => { if (!open) { setModal(null); setEditingTransaction(null); setFormError(""); } }}><DialogContent className="form-dialog"><DialogHeader><DialogTitle>{modal === "transaction" ? (editingTransaction ? "Операцияны өзгерту" : "Операция қосу") : modal === "subscription" ? "Жазылым қосу" : "Карта белгісін қосу"}</DialogTitle></DialogHeader><form onSubmit={submit} className="entry-form">
  {modal === "transaction" && <><div className="type-switch"><button type="button" className={form.type === "expense" ? "chosen" : ""} onClick={() => setForm({ ...form, type: "expense", category: "Азық-түлік" })}>Шығыс</button><button type="button" className={form.type === "income" ? "chosen" : ""} onClick={() => setForm({ ...form, type: "income", category: "Жалақы" })}>Кіріс</button></div><label>Атауы<input required maxLength={80} placeholder="Мысалы, азық-түлік" value={form.merchant} onChange={e => setForm({ ...form, merchant: e.target.value })}/></label><div className="form-pair"><label>Сома, ₸<input required type="number" min="1" max="1000000000" step="1" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}/></label><label>Күні<input required type="date" value={form.txDate} onChange={e => setForm({ ...form, txDate: e.target.value })}/></label></div><label>Санат<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{Array.from(new Set([form.category, ...(form.type === "income" ? ["Жалақы", "Қосымша табыс", "Сыйлық", "Басқа"] : categories)])).map(x => <option key={x} value={x}>{x}</option>)}</select></label>{data?.cards.length ? <label>Карта<select value={form.cardId} onChange={e => setForm({ ...form, cardId: e.target.value })}><option value="">Картасыз</option>{data.cards.map(x => <option key={x.id} value={x.id}>{x.bankName} •••• {x.last4}</option>)}</select></label> : null}</>}
  {modal === "subscription" && <><label>Сервис атауы<input required maxLength={80} placeholder="Мысалы, музыка сервисі" value={form.merchant} onChange={e => setForm({ ...form, merchant: e.target.value })}/></label><div className="form-pair"><label>Айлық төлем, ₸<input required type="number" min="1" max="1000000000" step="1" value={form.monthlyAmount} onChange={e => setForm({ ...form, monthlyAmount: e.target.value })}/></label><label>Келесі төлем<input required type="date" value={form.nextPayment} onChange={e => setForm({ ...form, nextPayment: e.target.value })}/></label></div><p className="form-help">Жазылымды бақылау үшін қолмен қосасыз.</p></>}
  {modal === "card" && <><label>Банк немесе карта атауы<input required maxLength={50} placeholder="Мысалы, Kaspi Gold" value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })}/></label><label>Картаның соңғы 4 саны<input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="1234" value={form.last4} onChange={e => setForm({ ...form, last4: e.target.value })}/></label><p className="form-help">Толық карта нөмірін, CVV немесе SMS кодын енгізбеңіз.</p></>}
  {formError && <p className="auth-error" role="alert">{formError}</p>}<button className="primary-button submit-button" disabled={busy} type="submit">{busy ? "Сақталуда…" : "Сақтау"}</button></form></DialogContent></Dialog><AuthDialog mode={authMode} onModeChange={setAuthMode} onSuccess={() => { setTab("profile"); void load(); }}/></div>;
}

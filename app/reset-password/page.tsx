"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { PreferencesControls } from "@/components/preferences-provider";
import { apiFetch } from "@/lib/api-fetch";
import { passwordProblem } from "@/lib/password-validation";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const passwordIssue = passwordProblem(password);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("token") || "";
    setToken(value);
    if (!value) { setValid(false); return; }
    fetch(`/api/password-reset/confirm?token=${encodeURIComponent(value)}`, { cache: "no-store" })
      .then(response => response.json() as Promise<{ valid?: boolean }>).then(result => setValid(Boolean(result.valid)))
      .catch(() => setValid(false));
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordTouched(true);
    if (passwordIssue) { setError(passwordIssue); return; }
    if (password !== confirmation) { setError("Құпиясөздер сәйкес келмейді"); return; }
    setBusy(true); setError("");
    try {
      const response = await apiFetch("/api/password-reset/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Құпиясөзді өзгерту мүмкін болмады");
      setPassword(""); setConfirmation(""); setDone(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Қате пайда болды"); }
    finally { setBusy(false); }
  };

  return <main className="account-flow"><header className="account-flow-header"><Link className="about-logo" href="/"><span className="brand-mark">Б</span>береке.</Link><PreferencesControls /></header><section className="account-flow-card">
    <h1>Құпиясөзді қалпына келтіру</h1>
    {done ? <><p className="auth-success" role="status">Құпиясөз өзгертілді. Енді жаңа құпиясөзбен кіріңіз.</p><Link className="primary-button" href="/">Басты бетке оралу</Link></> : valid === null ? <p>Сілтеме тексерілуде…</p> : !valid ? <><p className="auth-error" role="alert">Сілтеме жарамсыз немесе мерзімі өтті</p><Link href="/">Басты бетке оралу</Link></> : <form className="auth-form" onSubmit={submit}>
      <label>Жаңа құпиясөз<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onBlur={() => setPasswordTouched(true)} onChange={event => { setPassword(event.target.value); setError(""); }} aria-invalid={(passwordTouched || !!password) && !!passwordIssue} aria-describedby="reset-password-status" />
        <span id="reset-password-status" className={`auth-field-message ${!(passwordTouched || password) ? "hint" : passwordIssue ? "invalid" : "valid"}`} role="status">{passwordTouched || password ? passwordIssue || "Құпиясөз қабылданады." : "Кемінде 8 таңба, әріп, сан және арнайы таңба (!, ?, #) қажет."}</span>
      </label>
      <label>Құпиясөзді қайталаңыз<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Күтіңіз…" : "Құпиясөзді өзгерту"}</button>
    </form>}
  </section></main>;
}

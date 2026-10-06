"use client";

import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-fetch";

export type AuthMode = "login" | "register";

export function AuthDialog({ mode, onModeChange, onSuccess }: {
  mode: AuthMode | null;
  onModeChange: (mode: AuthMode | null) => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const switchMode = (next: AuthMode) => {
    setError(""); setResetMode(false); setResetSent(false); onModeChange(next);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mode) return;
    if (resetMode) {
      setBusy(true); setError("");
      try {
        const response = await apiFetch("/api/password-reset", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: resetEmail }),
        });
        if (!response.ok) throw new Error("Сұрауды жіберу мүмкін болмады");
        setResetSent(true);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Қате пайда болды"); }
      finally { setBusy(false); }
      return;
    }
    if (mode === "register" && name.trim().length < 2) { setError("Атыңыз кемінде 2 таңбадан тұруы керек."); return; }
    if (mode === "register" && password.length < 8) { setError("Құпиясөз кемінде 8 таңбадан тұруы керек."); return; }
    if (mode === "register" && !/^(?:\+[1-9]\d{7,14}|[78]\d{10})$/.test(phone.replace(/[\s()-]/g, ""))) {
      setError("Телефон нөмірін дұрыс енгізіңіз, мысалы +77001234567."); return;
    }
    setBusy(true); setError("");
    try {
      const response = await apiFetch("/api/auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, name, email, phone, identifier, password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Әрекет орындалмады");
      setPassword(""); onModeChange(null); onSuccess();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Қате пайда болды"); }
    finally { setBusy(false); }
  };

  const close = () => { setError(""); setResetMode(false); setResetSent(false); onModeChange(null); };

  return <Dialog open={mode !== null} onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className="auth-dialog">
      <DialogHeader><DialogTitle>{resetMode ? "Құпиясөзді қалпына келтіру" : mode === "register" ? "Тіркелу" : "Кіру"}</DialogTitle></DialogHeader>
      <p className="auth-intro">{resetMode ? "Қалпына келтіру сілтемесін email арқылы жібереміз." : mode === "register" ? "Жеке қаржы кабинетіңізді ашыңыз." : "Жеке кабинетіңізге кіріңіз."}</p>
      {!resetMode && <div className="auth-switch" role="group" aria-label="Кіру түрі">
        <button type="button" className={mode === "login" ? "selected" : ""} onClick={() => switchMode("login")}>Кіру</button>
        <button type="button" className={mode === "register" ? "selected" : ""} onClick={() => switchMode("register")}>Тіркелу</button>
      </div>}
      <form className="auth-form" onSubmit={submit}>
        {resetMode ? <>
          {resetSent ? <p className="auth-success" role="status">Егер бұл email тіркелген болса, қалпына келтіру сілтемесі жіберілді.</p> : <label>Email<input type="email" autoComplete="email" required maxLength={254} value={resetEmail} onChange={event => setResetEmail(event.target.value)} placeholder="name@example.com" /></label>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          {!resetSent && <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Күтіңіз…" : "Сілтемені жіберу"}</button>}
          <button className="auth-link-button" type="button" onClick={() => { setResetMode(false); setResetSent(false); setError(""); }}>Кіруге оралу</button>
        </> : <>
          {mode === "register" && <label>Атыңыз<input autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Атыңыз" /></label>}
          {mode === "register" ? <>
            <label>Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" /></label>
            <label>Телефон нөмірі<input type="tel" inputMode="tel" autoComplete="tel" required maxLength={24} value={phone} onChange={event => setPhone(event.target.value)} placeholder="+77001234567" /></label>
          </> : <label>Email немесе телефон<input type="text" autoComplete="username" required maxLength={254} value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="name@example.com / +77001234567" /></label>}
          <label>Құпиясөз<input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 8 : 1} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} placeholder={mode === "register" ? "Кемінде 8 таңба" : "Құпиясөз"} /></label>
          {mode === "login" && <button className="auth-link-button" type="button" onClick={() => { setResetEmail(identifier.includes("@") ? identifier : ""); setResetMode(true); setError(""); }}>Құпиясөзді ұмыттыңыз ба?</button>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Күтіңіз…" : mode === "register" ? "Тіркелу" : "Кіру"}</button>
        </>}
      </form>
    </DialogContent>
  </Dialog>;
}

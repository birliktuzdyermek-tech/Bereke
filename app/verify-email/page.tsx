"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { PreferencesControls } from "@/components/preferences-provider";
import { apiFetch } from "@/lib/api-fetch";

export default function VerifyEmailPage() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const verify = async () => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) { setError("Сілтеме жарамсыз немесе мерзімі өтті"); return; }
    setBusy(true); setError("");
    try {
      const response = await apiFetch("/api/email-verification", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Email растау мүмкін болмады");
      setDone(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Қате пайда болды"); }
    finally { setBusy(false); }
  };

  return <main className="account-flow"><header className="account-flow-header"><Link className="about-logo" href="/"><BrandLogo /></Link><PreferencesControls /></header><section className="account-flow-card">
    <h1>Email мекенжайын растау</h1>
    {done ? <p className="auth-success" role="status">Email мекенжайы расталды.</p> : <><p>Тіркелгіңіздегі email мекенжайын растаңыз.</p>{error && <p className="auth-error" role="alert">{error}</p>}<button className="primary-button auth-submit" type="button" disabled={busy} onClick={verify}>{busy ? "Күтіңіз…" : "Email растау"}</button></>}
    <Link href="/">Басты бетке оралу</Link>
  </section></main>;
}

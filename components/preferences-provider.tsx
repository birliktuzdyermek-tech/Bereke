"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Languages, Moon, Sun } from "lucide-react";
import { translateText, type Locale } from "@/lib/translations";

type Theme = "light" | "dark";
type Preferences = { locale: Locale; setLocale: (value: Locale) => void; theme: Theme; setTheme: (value: Theme) => void };
const Context = createContext<Preferences | null>(null);

function usePreferences() {
  const value = useContext(Context);
  if (!value) throw new Error("PreferencesProvider is missing");
  return value;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("kk");
  const [theme, setTheme] = useState<Theme>("light");
  const textSource = useRef(new WeakMap<Text, { original: string; rendered: string }>()).current;
  const attrSource = useRef(new WeakMap<Element, Map<string, { original: string; rendered: string }>>()).current;

  useEffect(() => {
    const savedLocale = localStorage.getItem("bereke-locale");
    if (savedLocale === "kk" || savedLocale === "ru" || savedLocale === "en") setLocale(savedLocale);
    const savedTheme = localStorage.getItem("bereke-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem("bereke-locale", locale);
    const scan = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node as Text;
        if (!text.parentElement || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(text.parentElement.tagName)) continue;
        const current = text.nodeValue || "";
        const previous = textSource.get(text);
        const original = previous && current === previous.rendered ? previous.original : current;
        const rendered = translateText(original, locale);
        textSource.set(text, { original, rendered });
        if (rendered !== current) text.nodeValue = rendered;
      }
      for (const element of document.body.querySelectorAll("[placeholder], [aria-label], [title]")) {
        let entries = attrSource.get(element);
        if (!entries) { entries = new Map(); attrSource.set(element, entries); }
        for (const name of ["placeholder", "aria-label", "title"]) {
          const current = element.getAttribute(name);
          if (current === null) continue;
          const previous = entries.get(name);
          const original = previous && current === previous.rendered ? previous.original : current;
          const rendered = translateText(original, locale);
          entries.set(name, { original, rendered });
          if (rendered !== current) element.setAttribute(name, rendered);
        }
      }
    };
    let frame = 0;
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; scan(); }); };
    scan();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] });
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [locale, textSource, attrSource]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("bereke-theme", theme);
  }, [theme]);

  return <Context.Provider value={{ locale, setLocale, theme, setTheme }}>{children}</Context.Provider>;
}

export function PreferencesControls() {
  const { locale, setLocale, theme, setTheme } = usePreferences();
  const themeLabel = theme === "light"
    ? { kk: "Қараңғы тақырып", ru: "Тёмная тема", en: "Dark theme" }[locale]
    : { kk: "Жарық тақырып", ru: "Светлая тема", en: "Light theme" }[locale];
  return <div className="preferences-controls">
    <label className="language-control"><Languages size={16} aria-hidden="true"/><span className="sr-only">Language / Язык / Тіл</span><select value={locale} onChange={event => setLocale(event.target.value as Locale)} aria-label="Language / Язык / Тіл"><option value="kk">ҚАЗ</option><option value="ru">РУС</option><option value="en">ENG</option></select></label>
    <button className="theme-control" type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={themeLabel} title={themeLabel}>{theme === "light" ? <Moon size={18}/> : <Sun size={18}/>}</button>
  </div>;
}

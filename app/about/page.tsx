"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowDownLeft, CreditCard, LockKeyhole, RefreshCw, Sparkles, Wallet } from "lucide-react";
import { PreferencesControls } from "@/components/preferences-provider";

const features = [
  { icon: ArrowDownLeft, title: "Қаржы көрінісі", text: "Кіріс пен шығысты бір жерге тіркеп, 1, 3, 6 немесе 12 айды салыстырыңыз." },
  { icon: RefreshCw, title: "Жазылымдар", text: "Ай сайынғы төлемдер мен келесі төлем күндерін бақылаңыз." },
  { icon: Sparkles, title: "Үнемдеу жолдары", text: "Енгізген шығындарыңыз бойынша қарапайым жеке кеңестер алыңыз." },
];

export default function About() {
  return <div className="about-page"><header className="about-header"><Link className="about-logo" href="/"><BrandLogo /></Link><nav aria-label="Сайт навигациясы"><a href="#features">Мүмкіндіктер</a><a href="#security">Қауіпсіздік</a><Link href="/">Кабинетке өту</Link></nav><PreferencesControls/></header>
    <main><section className="about-hero"><div><p className="eyebrow">ЖЕКЕ ҚАРЖЫ АССИСТЕНТІ</p><h1>Ақшаңыз қайда жұмсалғанын <em>анық көріңіз.</em></h1><p>«Теңгерім» кіріс пен шығысты реттеп, тұрақты төлемдерді бақылауға көмектеседі. Қаржыңыз туралы шешімді өзіңіз қабылдайсыз.</p><Link className="primary-button" href="/">Қаржыны қарау</Link></div><div className="about-visual" aria-label="Қаржы көрсеткіштерінің үлгі көрінісі"><div className="visual-heading"><Wallet size={22}/><span>Айлық шолу</span></div><strong>+ 431 900 ₸</strong><small>Кіріс − шығыс</small><div className="visual-bars"><span/><span/><span/><span/><span/><span/></div><div className="visual-mini"><span>Азық-түлік</span><strong>28 500 ₸</strong></div><div className="visual-mini"><span>Жазылымдар</span><strong>5 080 ₸ / ай</strong></div></div></section>
    <section className="about-features" id="features"><p className="eyebrow">НЕ ІСТЕЙ АЛАСЫЗ?</p><h2>Күнделікті ақша қозғалысы — түсінікті түрде</h2><div className="feature-grid">{features.map(item => <article key={item.title}><span><item.icon size={23}/></span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></section>
    <section className="about-security" id="security"><div><p className="eyebrow">ҚАУІПСІЗДІК</p><h2>Қаржыңызды тіркеу үшін банк құпиясы қажет емес.</h2><p>Карта қосқанда тек банк атауы мен соңғы төрт санын енгізесіз. Толық карта нөмірі, CVV және SMS коды сұралмайды. Әр адамның жазбасы өз кабинетінде бөлек сақталады.</p></div><div className="security-list"><div><CreditCard size={21}/><span>Толық карта деректері сақталмайды</span></div><div><LockKeyhole size={21}/><span>Кіру жеке тіркелгі арқылы қорғалған</span></div><div><RefreshCw size={21}/><span>Жазылымды белгілеу төлем провайдерін өзгертпейді</span></div></div></section></main><footer className="about-footer"><BrandLogo light /><p>Жеке қаржыны түсінікті басқаруға арналған оқу жобасы.</p><Link href="/">Жеке кабинет</Link></footer></div>;
}

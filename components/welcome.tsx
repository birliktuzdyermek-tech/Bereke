import { Layers, Plus, Target } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Donut } from "@/components/donut";

const SAMPLE_SLICES = [
  { name: "Тұрғын үй", total: 300000, color: "#4F6A9E" },
  { name: "Азық-түлік", total: 164000, color: "#D2692F" },
  { name: "Сауда", total: 58000, color: "#B58A1C" },
  { name: "Тамақтану", total: 37000, color: "#1F8A84" },
];

/** First screen for someone who is not signed in: what the service does, in three steps. */
export function Welcome({ onRegister, onLogin, onSample }: { onRegister: () => void; onLogin: () => void; onSample: () => void }) {
  const steps = [
    { icon: Plus, title: "Операция қосыңыз", text: "Сома, санат, күні: екі қозғалыс" },
    { icon: Layers, title: "Санаттарды көріңіз", text: "Қай жерге көп кетіп жатыр" },
    { icon: Target, title: "Бюджет қойыңыз", text: "Айлық лимит қойып, шығынды бақылаңыз" },
  ];
  return <section className="welcome">
    <div className="welcome-copy">
      <BrandLogo/>
      <p className="eyebrow">ЖЕКЕ ҚАРЖЫ АССИСТЕНТІ</p>
      <h1>Ақшаңыз қайда кетіп жатқанын көріңіз</h1>
      <p className="welcome-lead">Кіріс пен шығысты тіркеңіз, санаттар бойынша талдаңыз, бюджет қойыңыз.</p>
      <ol className="welcome-steps">{steps.map(step => <li key={step.title}><span className="welcome-step-icon"><step.icon size={20}/></span><span><strong>{step.title}</strong><small>{step.text}</small></span></li>)}</ol>
      <div className="welcome-actions">
        <button className="primary-button" onClick={onRegister}>Тіркелу</button>
        <button className="auth-text-button" onClick={onLogin}>Кіру</button>
        <button className="text-button" onClick={onSample}>Үлгі деректерді қарау</button>
      </div>
    </div>
    <div className="welcome-art" aria-hidden="true">
      <div className="ov-hero welcome-hero"><span className="ov-hero-label">Осы кезеңдегі қалдық</span><strong className="ov-hero-num">1 086 000 ₸</strong></div>
      <div className="panel welcome-donut"><Donut slices={SAMPLE_SLICES} total={559000} caption="жалпы шығын"/></div>
    </div>
  </section>;
}

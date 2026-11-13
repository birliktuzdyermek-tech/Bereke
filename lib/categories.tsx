import { Car, Clapperboard, Gift, GraduationCap, HeartPulse, House, Shapes, ShoppingBag, ShoppingBasket, Tag, TrendingUp, Utensils, Wallet, type LucideIcon } from "lucide-react";

export type CategoryTone = "food" | "car" | "eat" | "rent" | "health" | "fun" | "edu" | "shop" | "other" | "pay" | "gift";
type CategoryStyle = { icon: LucideIcon; tone: CategoryTone };

const META: Record<string, CategoryStyle> = {
  "Азық-түлік": { icon: ShoppingBasket, tone: "food" },
  "Көлік": { icon: Car, tone: "car" },
  "Такси": { icon: Car, tone: "car" },
  "Тамақтану": { icon: Utensils, tone: "eat" },
  "Кафе": { icon: Utensils, tone: "eat" },
  "Тұрғын үй": { icon: House, tone: "rent" },
  "Денсаулық": { icon: HeartPulse, tone: "health" },
  "Ойын-сауық": { icon: Clapperboard, tone: "fun" },
  "Кино": { icon: Clapperboard, tone: "fun" },
  "Білім": { icon: GraduationCap, tone: "edu" },
  "Сауда": { icon: ShoppingBag, tone: "shop" },
  "Басқа": { icon: Shapes, tone: "other" },
  "Жалақы": { icon: Wallet, tone: "pay" },
  "Қосымша табыс": { icon: TrendingUp, tone: "pay" },
  "Сыйлық": { icon: Gift, tone: "gift" },
};

// Mid-tone colours that read on both the light and the dark theme (chart slices, legend dots).
const TONE_COLOR: Record<CategoryTone, string> = {
  food: "#D2692F", car: "#7A5AA6", eat: "#1F8A84", rent: "#4F6A9E", health: "#C2417A", fun: "#B04FA0",
  edu: "#3F7FBF", shop: "#B58A1C", other: "#6B7280", pay: "#2E8B5E", gift: "#D4577A",
};

export const categoryStyle = (name: string): CategoryStyle => META[name] ?? { icon: Tag, tone: "other" };
export const categoryColor = (name: string) => TONE_COLOR[categoryStyle(name).tone];

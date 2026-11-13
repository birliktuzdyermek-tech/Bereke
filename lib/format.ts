export const money = (n: number) => new Intl.NumberFormat("kk-KZ").format(n) + " ₸";
export const shortDate = (d: string) => { const [, m, day] = d.split("-").map(Number); return `${day} ${["қаң", "ақп", "нау", "сәу", "мам", "мау", "шіл", "там", "қыр", "қаз", "қар", "жел"][m - 1] || ""}`; };
export const today = () => new Date().toISOString().slice(0, 10);
// Category palette shared by the overview bars (Arna dashboard accents).
export const colors = ["#4F6A9E", "#C8612E", "#B58A1C", "#1F8A84", "#7A5C9E"];

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** "Бүгін", "Кеше" or a short date such as "5 қар" (translated by the text dictionary). */
export function dayLabel(txDate: string, now = new Date()) {
  if (txDate === isoDay(now)) return "Бүгін";
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return txDate === isoDay(yesterday) ? "Кеше" : shortDate(txDate);
}
/** Consecutive transactions sharing a date, in the order given (newest first from the API). */
export function groupByDay<T extends { txDate: string }>(items: T[], now = new Date()) {
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.key === item.txDate) last.items.push(item);
    else groups.push({ key: item.txDate, label: dayLabel(item.txDate, now), items: [item] });
  }
  return groups;
}

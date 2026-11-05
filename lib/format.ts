export const money = (n: number) => new Intl.NumberFormat("kk-KZ").format(n) + " ₸";
export const shortDate = (d: string) => { const [, m, day] = d.split("-").map(Number); return `${day} ${["қаң", "ақп", "нау", "сәу", "мам", "мау", "шіл", "там", "қыр", "қаз", "қар", "жел"][m - 1] || ""}`; };
export const today = () => new Date().toISOString().slice(0, 10);
// Category palette shared by the overview bars (Arna dashboard accents).
export const colors = ["#4F6A9E", "#C8612E", "#B58A1C", "#1F8A84", "#7A5C9E"];

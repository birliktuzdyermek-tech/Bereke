import type { Budget } from "@/components/budget-panel";

export type Tx = { id: number; merchant: string; category: string; amount: number; type: "income" | "expense"; txDate: string; cardId: number | null };
export type Sub = { id: number; merchant: string; monthlyAmount: number; nextPayment: string; status: "active" | "cancelled" };
export type Card = { id: number; bankName: string; last4: string };
export type Finance = { user: { name: string; email: string; phone?: string | null; provider?: "local" | "platform"; emailVerified?: boolean }; transactions: Tx[]; subscriptions: Sub[]; cards: Card[]; budgets: Budget[] };

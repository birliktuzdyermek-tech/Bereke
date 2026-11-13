import { CategoryBadge } from "@/components/category-badge";
import { money, shortDate } from "@/lib/format";
import type { Tx } from "@/lib/finance-types";

export function TransactionRow({ tx }: { tx: Tx }) {
  return <div className="transaction-row"><CategoryBadge name={tx.category}/><span className="tx-name"><strong>{tx.merchant}</strong><small>{tx.category} · {shortDate(tx.txDate)}</small></span><strong className={tx.type === "income" ? "tx-amount positive" : "tx-amount"}>{tx.type === "income" ? "+" : "−"}{money(tx.amount)}</strong></div>;
}

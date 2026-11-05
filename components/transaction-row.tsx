import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { money, shortDate } from "@/lib/format";
import type { Tx } from "@/lib/finance-types";

export function TransactionRow({ tx }: { tx: Tx }) {
  return <div className="transaction-row"><span className={tx.type === "income" ? "tx-icon tx-income" : "tx-icon"}>{tx.type === "income" ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}</span><span className="tx-name"><strong>{tx.merchant}</strong><small>{tx.category} · {shortDate(tx.txDate)}</small></span><strong className={tx.type === "income" ? "tx-amount positive" : "tx-amount"}>{tx.type === "income" ? "+" : "−"}{money(tx.amount)}</strong></div>;
}

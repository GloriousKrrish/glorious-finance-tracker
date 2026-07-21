import type { State } from "../store";
import { DocumentVaultEngine } from "./vault";

export interface SearchResultItem {
  id: string;
  type: "account" | "transaction" | "goal" | "budget" | "investment" | "loan" | "bill" | "document";
  title: string;
  subtitle: string;
  amount?: number;
  date?: string;
  url: string;
}

export class SearchEngine {
  public static query(state: State, queryText: string, workspaceId: string): SearchResultItem[] {
    const q = queryText.toLowerCase().trim();
    if (!q) return [];

    const results: SearchResultItem[] = [];

    // 1. Accounts
    state.accounts.forEach(a => {
      if (a.name.toLowerCase().includes(q) || (a.institution || "").toLowerCase().includes(q)) {
        results.push({
          id: a.id,
          type: "account",
          title: a.name,
          subtitle: `Account • ${a.institution || "Generic"} (${a.type})`,
          amount: a.balance,
          url: "/accounts"
        });
      }
    });

    // 2. Transactions
    state.transactions.forEach(t => {
      if (
        (t.merchant || "").toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.note || "").toLowerCase().includes(q)
      ) {
        results.push({
          id: t.id,
          type: "transaction",
          title: t.merchant || t.category,
          subtitle: `Transaction • ${t.category} (${t.kind})`,
          amount: t.amount,
          date: t.date,
          url: "/transactions"
        });
      }
    });

    // 3. Budgets
    state.budgets.forEach(b => {
      if (b.category.toLowerCase().includes(q)) {
        results.push({
          id: b.id,
          type: "budget",
          title: `${b.category} Budget`,
          subtitle: `Budget limit for ${b.period}`,
          amount: b.limit,
          url: "/budgets"
        });
      }
    });

    // 4. Investments
    state.investments.forEach(i => {
      if (i.name.toLowerCase().includes(q) || i.type.toLowerCase().includes(q)) {
        results.push({
          id: i.id,
          type: "investment",
          title: i.name,
          subtitle: `Investment • ${i.type} (${i.assetClass})`,
          amount: i.currentPrice * i.units,
          url: "/investments"
        });
      }
    });

    // 5. Loans
    state.loans.forEach(l => {
      if (l.name.toLowerCase().includes(q) || l.type.toLowerCase().includes(q)) {
        results.push({
          id: l.id,
          type: "loan",
          title: l.name,
          subtitle: `Loan Outstanding • Rate: ${l.rate}%`,
          amount: l.outstanding,
          url: "/loans"
        });
      }
    });

    // 6. Bills
    state.bills.forEach(b => {
      if (b.name.toLowerCase().includes(q) || b.category.toLowerCase().includes(q)) {
        results.push({
          id: b.id,
          type: "bill",
          title: b.name,
          subtitle: `Bill Due • Status: ${b.status}`,
          amount: b.amount,
          date: b.dueDate,
          url: "/bills"
        });
      }
    });

    // 7. Documents
    const documents = DocumentVaultEngine.getFiles(workspaceId);
    documents.forEach(d => {
      if (d.name.toLowerCase().includes(q) || d.folder.toLowerCase().includes(q) || d.tags.some(t => t.toLowerCase().includes(q))) {
        results.push({
          id: d.id,
          type: "document",
          title: d.name,
          subtitle: `Document Vault • ${d.folder} (v${d.version})`,
          date: d.uploadedAt.slice(0, 10),
          url: "/admin?tab=vault"
        });
      }
    });

    return results;
  }
}

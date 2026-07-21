import type { State, Transaction } from "./types";

export interface ReportFilters {
  dateRange?: { from: string; to: string };
  accountId?: string;
  category?: string;
  merchant?: string;
  kind?: string;
  status?: string;
  tags?: string[];
  minAmount?: number;
  maxAmount?: number;
}

export class FilterEngine {
  public static filterTransactions(transactions: Transaction[], filters: ReportFilters): Transaction[] {
    let result = [...transactions];

    if (filters.dateRange) {
      const { from, to } = filters.dateRange;
      if (from) {
        result = result.filter((t) => t.date >= from);
      }
      if (to) {
        result = result.filter((t) => t.date <= to);
      }
    }

    if (filters.accountId) {
      result = result.filter((t) => t.accountId === filters.accountId || t.toAccountId === filters.accountId);
    }

    if (filters.category) {
      result = result.filter((t) => t.category.toLowerCase() === filters.category!.toLowerCase());
    }

    if (filters.merchant) {
      result = result.filter((t) => t.merchant?.toLowerCase().includes(filters.merchant!.toLowerCase()));
    }

    if (filters.kind) {
      result = result.filter((t) => t.kind === filters.kind);
    }

    if (filters.status) {
      result = result.filter((t) => t.status === filters.status);
    }

    if (filters.tags && filters.tags.length > 0) {
      result = result.filter((t) => t.tags?.some((tag) => filters.tags!.includes(tag)));
    }

    if (filters.minAmount !== undefined) {
      result = result.filter((t) => t.amount >= filters.minAmount!);
    }

    if (filters.maxAmount !== undefined) {
      result = result.filter((t) => t.amount <= filters.maxAmount!);
    }

    return result;
  }

  /**
   * Returns a filtered subset of State based on filters.
   */
  public static filterState(state: State, filters: ReportFilters): State {
    const filteredTxns = this.filterTransactions(state.transactions ?? [], filters);
    
    return {
      ...state,
      transactions: filteredTxns,
      // If filtering by accounts, keep only those accounts
      accounts: filters.accountId
        ? (state.accounts ?? []).filter((a) => a.id === filters.accountId)
        : state.accounts,
      // If filtering by category, keep budgets matching that category
      budgets: filters.category
        ? (state.budgets ?? []).filter((b) => b.category.toLowerCase() === filters.category!.toLowerCase())
        : state.budgets,
    };
  }
}

import type { State, Loan, Budget, Goal } from "./types";
import { CalculationEngine } from "./calculations";

export class SelectorEngine {
  private static lastState: State | null = null;
  private static cachedDashboard: any = null;
  private static cachedLoans: Map<string, any> = new Map();
  private static cachedBudgets: Map<string, any> = new Map();
  private static cachedGoals: Map<string, any> = new Map();
  private static cachedInvestments: any = null;

  private static cachedTotalAccountBalance: number | null = null;

  private static cachedTxnsByAccount: Map<string, any> = new Map();
  private static cachedTxnsByCategory: Map<string, any> = new Map();
  private static cachedTxnsByMonth: Map<string, any> = new Map();
  private static cachedIncomeSummary: number | null = null;
  private static cachedExpenseSummary: number | null = null;
  private static cachedLatestTxns: any[] | null = null;
  private static cachedLinkedTxns: Map<string, any> = new Map();
  private static cachedSearchTxns: Map<string, any> = new Map();

  private static checkAndClearCache(state: State): void {
    if (this.lastState !== state) {
      this.lastState = state;
      this.cachedDashboard = null;
      this.cachedLoans.clear();
      this.cachedBudgets.clear();
      this.cachedGoals.clear();
      this.cachedInvestments = null;
      this.cachedTotalAccountBalance = null;

      this.cachedTxnsByAccount.clear();
      this.cachedTxnsByCategory.clear();
      this.cachedTxnsByMonth.clear();
      this.cachedIncomeSummary = null;
      this.cachedExpenseSummary = null;
      this.cachedLatestTxns = null;
      this.cachedLinkedTxns.clear();
      this.cachedSearchTxns.clear();
    }
  }

  public static getTotalAccountBalance(state: State): number {
    this.checkAndClearCache(state);
    if (this.cachedTotalAccountBalance === null) {
      this.cachedTotalAccountBalance = state.accounts.reduce((s, a) => s + a.balance, 0);
    }
    return this.cachedTotalAccountBalance;
  }

  public static getTransactionsByAccount(state: State, accountId: string) {
    this.checkAndClearCache(state);
    if (!this.cachedTxnsByAccount.has(accountId)) {
      this.cachedTxnsByAccount.set(
        accountId,
        state.transactions.filter((t) => t.accountId === accountId || t.toAccountId === accountId)
      );
    }
    return this.cachedTxnsByAccount.get(accountId);
  }

  public static getTransactionsByCategory(state: State, category: string) {
    this.checkAndClearCache(state);
    if (!this.cachedTxnsByCategory.has(category)) {
      this.cachedTxnsByCategory.set(
        category,
        state.transactions.filter((t) => t.category === category)
      );
    }
    return this.cachedTxnsByCategory.get(category);
  }

  public static getTransactionsByMonth(state: State, year: number, month: number) {
    this.checkAndClearCache(state);
    const key = `${year}-${month}`;
    if (!this.cachedTxnsByMonth.has(key)) {
      this.cachedTxnsByMonth.set(
        key,
        state.transactions.filter((t) => {
          const d = new Date(t.date);
          return d.getFullYear() === year && d.getMonth() + 1 === month;
        })
      );
    }
    return this.cachedTxnsByMonth.get(key);
  }

  public static getIncomeSummary(state: State): number {
    this.checkAndClearCache(state);
    if (this.cachedIncomeSummary === null) {
      this.cachedIncomeSummary = state.transactions
        .filter((t) => t.kind === "income" || t.kind === "refund" || t.kind === "interest" || t.kind === "dividend")
        .reduce((sum, t) => sum + t.amount, 0);
    }
    return this.cachedIncomeSummary;
  }

  public static getExpenseSummary(state: State): number {
    this.checkAndClearCache(state);
    if (this.cachedExpenseSummary === null) {
      this.cachedExpenseSummary = state.transactions
        .filter((t) => t.kind === "expense" || t.kind === "bill_payment" || t.kind === "loan_payment" || t.kind === "goal_contribution")
        .reduce((sum, t) => sum + t.amount, 0);
    }
    return this.cachedExpenseSummary;
  }

  public static getCashFlowSummary(state: State): number {
    return this.getIncomeSummary(state) - this.getExpenseSummary(state);
  }

  public static getLatestTransactions(state: State, limit: number = 5) {
    this.checkAndClearCache(state);
    if (this.cachedLatestTxns === null) {
      this.cachedLatestTxns = [...state.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return this.cachedLatestTxns.slice(0, limit);
  }

  public static getLinkedTransactions(state: State, entityId: string, entityType: "loan" | "goal" | "bill" | "investment") {
    this.checkAndClearCache(state);
    const key = `${entityType}-${entityId}`;
    if (!this.cachedLinkedTxns.has(key)) {
      this.cachedLinkedTxns.set(
        key,
        state.transactions.filter((t) => t.linkedEntityId === entityId && t.linkedEntityType === entityType)
      );
    }
    return this.cachedLinkedTxns.get(key);
  }

  public static searchTransactions(
    state: State,
    query: string,
    filters: { kind?: string; category?: string; accountId?: string } = {}
  ) {
    this.checkAndClearCache(state);
    const key = JSON.stringify({ query, filters });
    if (!this.cachedSearchTxns.has(key)) {
      let results = state.transactions;
      
      if (query) {
        const q = query.toLowerCase();
        results = results.filter(
          (t) =>
            (t.merchant || "").toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q) ||
            (t.note || "").toLowerCase().includes(q)
        );
      }

      if (filters.kind && filters.kind !== "all") {
        results = results.filter((t) => t.kind === filters.kind);
      }

      if (filters.category && filters.category !== "all") {
        results = results.filter((t) => t.category === filters.category);
      }

      if (filters.accountId && filters.accountId !== "all") {
        results = results.filter((t) => t.accountId === filters.accountId || t.toAccountId === filters.accountId);
      }

      this.cachedSearchTxns.set(key, results);
    }
    return this.cachedSearchTxns.get(key);
  }

  public static getDashboard(state: State) {
    this.checkAndClearCache(state);
    if (!this.cachedDashboard) {
      this.cachedDashboard = CalculationEngine.calculateDashboard(state);
    }
    return this.cachedDashboard;
  }

  public static getLoanMetrics(state: State, loan: Loan) {
    this.checkAndClearCache(state);
    if (!this.cachedLoans.has(loan.id)) {
      this.cachedLoans.set(loan.id, CalculationEngine.calculateLoan(loan, state.transactions));
    }
    return this.cachedLoans.get(loan.id);
  }

  public static getBudgetMetrics(state: State, budget: Budget) {
    this.checkAndClearCache(state);
    if (!this.cachedBudgets.has(budget.id)) {
      this.cachedBudgets.set(budget.id, CalculationEngine.calculateBudget(budget, state.transactions));
    }
    return this.cachedBudgets.get(budget.id);
  }

  public static getGoalMetrics(state: State, goal: Goal) {
    this.checkAndClearCache(state);
    if (!this.cachedGoals.has(goal.id)) {
      this.cachedGoals.set(goal.id, CalculationEngine.calculateGoal(goal, state.transactions));
    }
    return this.cachedGoals.get(goal.id);
  }

  public static getInvestmentMetrics(state: State) {
    this.checkAndClearCache(state);
    if (!this.cachedInvestments) {
      this.cachedInvestments = CalculationEngine.calculateInvestment(state.investments);
    }
    return this.cachedInvestments;
  }
}

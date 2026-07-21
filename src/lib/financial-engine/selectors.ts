import type { State, Loan, Budget, Goal, Transaction, Investment, Account } from "./types";
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

  // Loan Specific Caches
  private static cachedAllLoans: any[] | null = null;
  private static cachedActiveLoans: any[] | null = null;
  private static cachedClosedLoans: any[] | null = null;
  private static cachedLoansOutstandingSummary: number | null = null;
  private static cachedLoansEmiSummary: number | null = null;
  private static cachedDebtRatio: number | null = null;
  private static cachedUpcomingPayments: any[] | null = null;
  private static cachedInterestSummary: { paid: number; remaining: number; total: number } | null = null;

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

      // Clear Loan Caches
      this.cachedAllLoans = null;
      this.cachedActiveLoans = null;
      this.cachedClosedLoans = null;
      this.cachedLoansOutstandingSummary = null;
      this.cachedLoansEmiSummary = null;
      this.cachedDebtRatio = null;
      this.cachedUpcomingPayments = null;
      this.cachedInterestSummary = null;
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

  // --- LOAN SELECTORS ---
  public static getLoans(state: State) {
    this.checkAndClearCache(state);
    if (this.cachedAllLoans === null) {
      this.cachedAllLoans = state.loans.map((l) => {
        const metrics = this.getLoanMetrics(state, l);
        return {
          ...l,
          metrics,
          outstanding: metrics.outstandingBalance,
          emi: metrics.monthlyEmi,
        };
      });
    }
    return this.cachedAllLoans;
  }

  public static getActiveLoans(state: State) {
    this.checkAndClearCache(state);
    if (this.cachedActiveLoans === null) {
      this.cachedActiveLoans = this.getLoans(state).filter((l) => l.outstanding > 0);
    }
    return this.cachedActiveLoans;
  }

  public static getClosedLoans(state: State) {
    this.checkAndClearCache(state);
    if (this.cachedClosedLoans === null) {
      this.cachedClosedLoans = this.getLoans(state).filter((l) => l.outstanding <= 0);
    }
    return this.cachedClosedLoans;
  }

  public static getLoansOutstandingSummary(state: State): number {
    this.checkAndClearCache(state);
    if (this.cachedLoansOutstandingSummary === null) {
      this.cachedLoansOutstandingSummary = this.getLoans(state).reduce((sum, l) => sum + l.outstanding, 0);
    }
    return this.cachedLoansOutstandingSummary as number;
  }

  public static getLoansEmiSummary(state: State): number {
    this.checkAndClearCache(state);
    if (this.cachedLoansEmiSummary === null) {
      this.cachedLoansEmiSummary = this.getActiveLoans(state).reduce((sum, l) => sum + l.emi, 0);
    }
    return this.cachedLoansEmiSummary as number;
  }

  public static getDebtRatio(state: State): number {
    this.checkAndClearCache(state);
    if (this.cachedDebtRatio === null) {
      const dashboard = this.getDashboard(state);
      this.cachedDebtRatio = dashboard.totalAssets > 0 ? (dashboard.totalLiabilities / dashboard.totalAssets) * 100 : 0;
    }
    return this.cachedDebtRatio;
  }

  public static getUpcomingLoanPayments(state: State) {
    this.checkAndClearCache(state);
    if (this.cachedUpcomingPayments === null) {
      this.cachedUpcomingPayments = this.getActiveLoans(state).map((l) => ({
        loanId: l.id,
        name: l.name,
        amount: l.emi,
        dueDate: l.metrics.nextDueDate,
        type: l.type,
      })).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }
    return this.cachedUpcomingPayments;
  }

  public static getLoanInterestSummary(state: State) {
    this.checkAndClearCache(state);
    if (this.cachedInterestSummary === null) {
      let paid = 0;
      let remaining = 0;
      let total = 0;
      this.getLoans(state).forEach((l) => {
        paid += l.metrics.interestPaid;
        remaining += l.metrics.remainingInterest;
        total += l.metrics.totalInterest;
      });
      this.cachedInterestSummary = { paid, remaining, total };
    }
    return this.cachedInterestSummary;
  }

  public static getLoanRepayments(state: State, loanId: string) {
    const loan = state.loans.find((l) => l.id === loanId);
    if (!loan) return [];
    return state.transactions
      .filter((t) => t.linkedEntityId === loanId || (t.category === "EMI" && t.merchant?.toLowerCase().includes(loan.name.toLowerCase())))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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

  public static getBudgets(state: State): (Budget & { metrics: ReturnType<typeof CalculationEngine.calculateBudget> })[] {
    this.checkAndClearCache(state);
    return state.budgets.map((b) => ({
      ...b,
      metrics: this.getBudgetMetrics(state, b),
    }));
  }

  public static getActiveBudgets(state: State) {
    return this.getBudgets(state);
  }

  public static getBudgetsSpentSummary(state: State): number {
    return this.getBudgets(state).reduce((sum, b) => sum + b.metrics.spent, 0);
  }

  public static getBudgetsRemainingSummary(state: State): number {
    return this.getBudgets(state).reduce((sum, b) => sum + b.metrics.remaining, 0);
  }

  public static getBudgetsOverspendingSummary(state: State): number {
    return this.getBudgets(state).reduce((sum, b) => sum + b.metrics.overspending, 0);
  }

  public static getBudgetsForecastSummary(state: State): number {
    return this.getBudgets(state).reduce((sum, b) => sum + b.metrics.forecast, 0);
  }

  public static getBudgetsByCategory(state: State, category: string) {
    return this.getBudgets(state).filter((b) => b.category === category);
  }

  public static getBudgetsByPeriod(state: State, period: Budget["period"]) {
    return this.getBudgets(state).filter((b) => b.period === period);
  }

  public static getBudgetsHealthSummary(state: State): {
    Excellent: number;
    Good: number;
    Warning: number;
    Critical: number;
  } {
    const summary = { Excellent: 0, Good: 0, Warning: 0, Critical: 0 };
    this.getBudgets(state).forEach((b) => {
      summary[b.metrics.budgetHealth] = (summary[b.metrics.budgetHealth] || 0) + 1;
    });
    return summary;
  }

  public static getGoalMetrics(state: State, goal: Goal) {
    this.checkAndClearCache(state);
    if (!this.cachedGoals.has(goal.id)) {
      this.cachedGoals.set(goal.id, CalculationEngine.calculateGoal(goal, state.transactions));
    }
    return this.cachedGoals.get(goal.id)!;
  }

  public static getGoals(state: State) {
    this.checkAndClearCache(state);
    return state.goals.map((g) => ({
      ...g,
      metrics: this.getGoalMetrics(state, g),
    }));
  }

  public static getActiveGoals(state: State) {
    return this.getGoals(state).filter(
      (g) => !g.metrics.isCompleted && (g.status === undefined || g.status === "active")
    );
  }

  public static getCompletedGoals(state: State) {
    return this.getGoals(state).filter((g) => g.metrics.isCompleted || g.status === "completed");
  }

  public static getOverdueGoals(state: State) {
    return this.getGoals(state).filter((g) => g.metrics.isOverdue);
  }

  public static getPriorityGoals(state: State) {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return this.getActiveGoals(state).sort(
      (a, b) => (priorityOrder[a.priority || "medium"] ?? 2) - (priorityOrder[b.priority || "medium"] ?? 2)
    );
  }

  public static getGoalsSavingsSummary(state: State): number {
    return state.goals.reduce((sum, g) => sum + g.saved, 0);
  }

  public static getGoalsFundingGapSummary(state: State): number {
    return this.getGoals(state).reduce((sum, g) => sum + g.metrics.fundingGap, 0);
  }

  public static getGoalsForecastSummary(state: State): number {
    return this.getGoals(state).reduce((sum, g) => sum + g.metrics.goalForecast, 0);
  }

  public static getGoalsHealthSummary(state: State): {
    Excellent: number;
    Good: number;
    Warning: number;
    Critical: number;
  } {
    const summary = { Excellent: 0, Good: 0, Warning: 0, Critical: 0 };
    this.getGoals(state).forEach((g) => {
      const h = g.metrics.goalHealth as keyof typeof summary;
      summary[h] = (summary[h] || 0) + 1;
    });
    return summary;
  }

  public static getGoalContributions(state: State, goalId: string) {
    return state.transactions.filter(
      (t) =>
        (t.linkedEntityId === goalId && t.linkedEntityType === "goal") ||
        (t.kind === "goal_contribution" && t.linkedEntityId === goalId)
    );
  }

  public static getInvestmentDetailed(state: State) {
    this.checkAndClearCache(state);
    if (!this.cachedInvestments) {
      this.cachedInvestments = CalculationEngine.calculatePortfolioDetailed(state.investments, state.transactions);
    }
    return this.cachedInvestments;
  }

  public static getInvestments(state: State): any[] {
    return this.getInvestmentDetailed(state).investments;
  }

  public static getPortfolioSummary(state: State) {
    const detailed = this.getInvestmentDetailed(state);
    return {
      portfolioValue: detailed.portfolioValue,
      portfolioInvested: detailed.portfolioInvested,
      unrealizedPl: detailed.unrealizedPl,
      returnPercentage: detailed.returnPercentage,
      realizedPl: detailed.realizedPl,
      totalDividends: detailed.totalDividends,
      dividendYield: detailed.dividendYield,
      cagr: detailed.cagr,
      xirr: detailed.xirr,
      diversificationScore: detailed.diversificationScore,
      riskScore: detailed.riskScore,
      portfolioHealth: detailed.portfolioHealth,
      healthAlerts: detailed.healthAlerts
    };
  }

  public static getPortfolioAllocation(state: State) {
    return this.getInvestmentDetailed(state).portfolioAllocation;
  }

  public static getAssetAllocation(state: State) {
    return this.getInvestmentDetailed(state).assetAllocation;
  }

  public static getSectorAllocation(state: State) {
    return this.getInvestmentDetailed(state).sectorAllocation;
  }

  public static getTopGainers(state: State) {
    return this.getInvestmentDetailed(state).topGainers;
  }

  public static getTopLosers(state: State) {
    return this.getInvestmentDetailed(state).topLosers;
  }

  public static getDividendSummary(state: State) {
    const detailed = this.getInvestmentDetailed(state);
    const dividendTxns = state.transactions.filter(t => t.kind === "dividend");
    return {
      totalDividends: detailed.totalDividends,
      dividendYield: detailed.dividendYield,
      transactions: dividendTxns
    };
  }

  public static getRiskSummary(state: State) {
    const detailed = this.getInvestmentDetailed(state);
    let riskLevel: "Low" | "Medium" | "High" = "Medium";
    if (detailed.riskScore < 30) riskLevel = "Low";
    else if (detailed.riskScore > 70) riskLevel = "High";
    
    return {
      riskScore: detailed.riskScore,
      riskLevel,
      highRiskAssetCount: detailed.investments.filter((i: any) => i.units > 0 && (i.type === "crypto" || i.type === "stock")).length
    };
  }

  public static getReturnSummary(state: State) {
    const detailed = this.getInvestmentDetailed(state);
    return {
      unrealizedPl: detailed.unrealizedPl,
      realizedPl: detailed.realizedPl,
      totalGainLoss: detailed.unrealizedPl + detailed.realizedPl,
      returnPercentage: detailed.returnPercentage,
      cagr: detailed.cagr,
      xirr: detailed.xirr
    };
  }

  public static getInvestmentTimeline(state: State) {
    return this.getInvestmentDetailed(state).timeline;
  }

  public static getNetWorthContribution(state: State): number {
    const detailed = this.getInvestmentDetailed(state);
    const db = this.getDashboard(state);
    const netWorth = db.netWorth || 1;
    return (detailed.portfolioValue / Math.max(1, netWorth)) * 100;
  }

  public static getPortfolioHealth(state: State) {
    const detailed = this.getInvestmentDetailed(state);
    return {
      health: detailed.portfolioHealth,
      alerts: detailed.healthAlerts,
      diversificationScore: detailed.diversificationScore,
      riskScore: detailed.riskScore
    };
  }

  public static getInvestmentMetrics(state: State) {
    const detailed = this.getInvestmentDetailed(state);
    return {
      portfolioValue: detailed.portfolioValue,
      portfolioInvested: detailed.portfolioInvested,
      unrealizedPl: detailed.unrealizedPl,
      returnPercentage: detailed.returnPercentage,
    };
  }
}

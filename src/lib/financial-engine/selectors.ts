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

  private static checkAndClearCache(state: State): void {
    if (this.lastState !== state) {
      this.lastState = state;
      this.cachedDashboard = null;
      this.cachedLoans.clear();
      this.cachedBudgets.clear();
      this.cachedGoals.clear();
      this.cachedInvestments = null;
      this.cachedTotalAccountBalance = null;
    }
  }

  public static getTotalAccountBalance(state: State): number {
    this.checkAndClearCache(state);
    if (this.cachedTotalAccountBalance === null) {
      this.cachedTotalAccountBalance = state.accounts.reduce((s, a) => s + a.balance, 0);
    }
    return this.cachedTotalAccountBalance;
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

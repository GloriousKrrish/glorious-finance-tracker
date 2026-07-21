import type { State } from "./types";
import { CalculationEngine } from "./calculations";
import { SelectorEngine } from "./selectors";

export interface ForecastPoint {
  date: string;
  value: number;
}

export interface GoalForecast {
  monthsToComplete: number;
  completionDate: string;
  isPossible: boolean;
  requiredMonthlySavings: number;
}

export interface LoanForecast {
  monthsToPayoff: number;
  payoffDate: string;
  totalInterestPaid: number;
}

export interface BudgetForecast {
  daysRemaining: number;
  exhaustionDate: string;
  isExceededExpected: boolean;
}

export class ForecastEngine {
  /**
   * Forecasts Net Worth deterministically over N months based on average cash flow surplus and investment growth.
   */
  public static forecastNetWorth(state: State, months: number = 12): ForecastPoint[] {
    const db = CalculationEngine.calculateDashboard(state);
    const portfolio = SelectorEngine.getPortfolioSummary(state);

    const currentNetWorth = db.netWorth;
    const avgMonthlySurplus = Math.max(0, db.monthlyIncome - db.monthlyExpense);
    
    // Estimate a conservative 6% annual investment growth rate (0.5% monthly)
    const monthlyReturnRate = 0.005;
    let runningNetWorth = currentNetWorth;
    let runningInvestments = db.investmentBalance;

    const result: ForecastPoint[] = [];
    const now = new Date();

    for (let i = 1; i <= months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      
      // Calculate growth on investments
      const investmentGrowth = runningInvestments * monthlyReturnRate;
      runningInvestments += investmentGrowth;

      // Add surplus cash flow + investment growth to net worth
      runningNetWorth += avgMonthlySurplus + investmentGrowth;

      result.push({
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
        value: Math.round(runningNetWorth),
      });
    }

    return result;
  }

  /**
   * Forecasts Cash Flow deterministically based on average monthly income and expense metrics.
   */
  public static forecastCashFlow(state: State, months: number = 12): { date: string; income: number; expense: number }[] {
    const db = CalculationEngine.calculateDashboard(state);
    const result: { date: string; income: number; expense: number }[] = [];
    const now = new Date();

    for (let i = 1; i <= months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      result.push({
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
        income: Math.round(db.monthlyIncome),
        expense: Math.round(db.monthlyExpense),
      });
    }

    return result;
  }

  /**
   * Estimates completion timeline for a savings goal.
   */
  public static forecastGoal(state: State, goalId: string): GoalForecast {
    const goal = (state.goals ?? []).find((g) => g.id === goalId);
    if (!goal) {
      return { monthsToComplete: -1, completionDate: "—", isPossible: false, requiredMonthlySavings: 0 };
    }

    const db = CalculationEngine.calculateDashboard(state);
    const remaining = goal.target - goal.saved;
    if (remaining <= 0) {
      return { monthsToComplete: 0, completionDate: "Completed", isPossible: true, requiredMonthlySavings: 0 };
    }

    // Default to saving 10% of monthly surplus towards this specific goal, minimum ₹2000
    const surplus = db.monthlyIncome - db.monthlyExpense;
    const monthlySavingsAllocated = Math.max(2000, surplus * 0.2);

    const months = Math.ceil(remaining / monthlySavingsAllocated);
    const now = new Date();
    const completionDateObj = new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
    
    // Check target date feasibility
    let isPossible = true;
    let requiredMonthlySavings = monthlySavingsAllocated;
    
    if (goal.deadline) {
      const targetDateObj = new Date(goal.deadline);
      const diffTime = Math.max(0, targetDateObj.getTime() - now.getTime());
      const diffMonths = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30)));
      requiredMonthlySavings = remaining / diffMonths;
      
      if (months > diffMonths) {
        isPossible = false;
      }
    }

    return {
      monthsToComplete: months,
      completionDate: completionDateObj.toISOString().slice(0, 10),
      isPossible,
      requiredMonthlySavings,
    };
  }

  /**
   * Forecasts repayment schedule and payoff date for a loan.
   */
  public static forecastLoan(state: State, loanId: string): LoanForecast {
    const loan = (state.loans ?? []).find((l) => l.id === loanId);
    if (!loan) {
      return { monthsToPayoff: -1, payoffDate: "—", totalInterestPaid: 0 };
    }

    const metrics = CalculationEngine.calculateLoan(loan, state.transactions ?? []);
    const outstanding = metrics.outstandingBalance;
    if (outstanding <= 0) {
      return { monthsToPayoff: 0, payoffDate: "Paid Off", totalInterestPaid: 0 };
    }

    // Simple amortization estimate
    const monthlyRate = (loan.rate ?? 0) / 12 / 100;
    const emi = loan.emi ?? 0;

    if (emi <= outstanding * monthlyRate) {
      // EMI doesn't even cover monthly interest, loan will grow!
      return { monthsToPayoff: 999, payoffDate: "Infinite Burden (EMI < Interest)", totalInterestPaid: 9999999 };
    }

    let balance = outstanding;
    let months = 0;
    let totalInterest = 0;

    while (balance > 0 && months < 360) { // max 30 years cap to prevent infinite loop
      const interest = balance * monthlyRate;
      totalInterest += interest;
      const principalPaid = emi - interest;
      balance -= principalPaid;
      months++;
    }

    const now = new Date();
    const payoffDateObj = new Date(now.getFullYear(), now.getMonth() + months, now.getDate());

    return {
      monthsToPayoff: months,
      payoffDate: payoffDateObj.toISOString().slice(0, 10),
      totalInterestPaid: Math.round(totalInterest),
    };
  }

  /**
   * Forecasts how many days before a category budget is fully spent/exhausted.
   */
  public static forecastBudget(state: State, budgetId: string): BudgetForecast {
    const budget = (state.budgets ?? []).find((b) => b.id === budgetId);
    if (!budget) {
      return { daysRemaining: -1, exhaustionDate: "—", isExceededExpected: false };
    }

    const metrics = CalculationEngine.calculateBudget(budget, state.transactions ?? []);
    const spent = metrics.spent;
    const limit = budget.limit;

    if (spent >= limit) {
      return { daysRemaining: 0, exhaustionDate: "Exhausted", isExceededExpected: true };
    }

    // Calculate daily run rate
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysPassed = Math.max(1, Math.ceil((now.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24)));
    const dailyRate = spent / daysPassed;

    if (dailyRate <= 0) {
      return { daysRemaining: 30, exhaustionDate: "End of Month", isExceededExpected: false };
    }

    const remaining = limit - spent;
    const days = Math.round(remaining / dailyRate);
    const exhaustionDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);

    // If exhaustion happens before the month ends
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeftInMonth = lastDayOfMonth - now.getDate();

    return {
      daysRemaining: days,
      exhaustionDate: exhaustionDateObj.toISOString().slice(0, 10),
      isExceededExpected: days < daysLeftInMonth,
    };
  }
}

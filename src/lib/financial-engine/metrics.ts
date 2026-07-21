import type { State } from "./types";
import { CalculationEngine } from "./calculations";
import { SelectorEngine } from "./selectors";
import { FinancialHealthEngine } from "./health";

export type MetricType =
  | "net_worth"
  | "total_assets"
  | "total_liabilities"
  | "cash_flow"
  | "monthly_income"
  | "monthly_expense"
  | "savings_rate"
  | "expense_ratio"
  | "debt_ratio"
  | "debt_to_income"
  | "portfolio_return"
  | "portfolio_unrealized_pl"
  | "portfolio_cagr"
  | "diversification_score"
  | "budget_utilization"
  | "goal_progress"
  | "emergency_fund_coverage"
  | "liquidity_ratio"
  | "recurring_obligations"
  | "subscription_cost"
  | "financial_health_score"
  | "financial_wellness_grade";

export class MetricsRegistry {
  public static getMetric(state: State, metric: MetricType): any {
    const db = CalculationEngine.calculateDashboard(state);
    const portfolio = SelectorEngine.getPortfolioSummary(state);
    const activeLoans = SelectorEngine.getActiveLoans(state);
    const health = FinancialHealthEngine.calculateHealth(state);

    switch (metric) {
      case "net_worth":
        return db.netWorth;
      case "total_assets":
        return db.totalAssets;
      case "total_liabilities":
        return db.totalLiabilities;
      case "cash_flow":
        return db.monthlyIncome - db.monthlyExpense;
      case "monthly_income":
        return db.monthlyIncome;
      case "monthly_expense":
        return db.monthlyExpense;
      case "savings_rate":
        return db.savingsRate;
      case "expense_ratio":
        return db.monthlyIncome > 0 ? (db.monthlyExpense / db.monthlyIncome) * 100 : 0;
      case "debt_ratio":
        return db.totalAssets > 0 ? (db.totalLiabilities / db.totalAssets) * 100 : 0;
      case "debt_to_income": {
        const emis = activeLoans.reduce((sum, l) => sum + l.emi, 0);
        return db.monthlyIncome > 0 ? (emis / db.monthlyIncome) * 100 : 0;
      }
      case "portfolio_return":
        return portfolio.returnPercentage;
      case "portfolio_unrealized_pl":
        return portfolio.unrealizedPl;
      case "portfolio_cagr":
        // Approximate annualized return based on portfolio age and performance
        return portfolio.returnPercentage; // simplified representation of CAGR for current period
      case "diversification_score":
        return portfolio.diversificationScore;
      case "budget_utilization": {
        const budgets = state.budgets ?? [];
        if (budgets.length === 0) return 0;
        let totalLimit = 0;
        let totalSpent = 0;
        budgets.forEach((b) => {
          totalLimit += b.limit;
          totalSpent += CalculationEngine.calculateBudget(b, state.transactions ?? []).spent;
        });
        return totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
      }
      case "goal_progress": {
        const activeGoals = SelectorEngine.getActiveGoals(state);
        if (activeGoals.length === 0) return 100;
        return activeGoals.reduce((sum, g) => sum + g.metrics.progress, 0) / activeGoals.length;
      }
      case "emergency_fund_coverage": {
        const liquidBalance = (state.accounts ?? [])
          .filter((a) => a.type !== "credit_card" && a.type !== "investment")
          .reduce((sum, a) => sum + (a.balance ?? 0), 0);
        const averageExpense = Math.max(10000, db.monthlyExpense);
        return liquidBalance / averageExpense;
      }
      case "liquidity_ratio": {
        const liquidBalance = (state.accounts ?? [])
          .filter((a) => a.type !== "credit_card" && a.type !== "investment")
          .reduce((sum, a) => sum + (a.balance ?? 0), 0);
        return db.totalAssets > 0 ? (liquidBalance / db.totalAssets) * 100 : 0;
      }
      case "recurring_obligations":
        return SelectorEngine.getFinancialObligationSummary(state).monthlyTotal;
      case "subscription_cost":
        return SelectorEngine.getSubscriptionSummary(state).monthlyCost;
      case "financial_health_score":
        return health.overallScore;
      case "financial_wellness_grade":
        return health.wellnessGrade;
      default:
        throw new Error(`Unknown financial metric requested: ${metric}`);
    }
  }
}

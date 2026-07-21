import type { State } from "./types";
import { CalculationEngine } from "./calculations";
import { SelectorEngine } from "./selectors";

export interface FinancialHealthMetrics {
  overallScore: number;
  savingsRate: number;
  cashFlowScore: number;
  emergencyFundScore: number;
  debtHealth: number;
  investmentHealth: number;
  budgetHealth: number;
  goalProgressScore: number;
  recurringObligationScore: number;
  liquidityScore: number;
  diversificationScore: number;
  expenseStability: number;
  incomeStability: number;
  netWorthTrend: number;
  monthlyProgress: number;
  financialMomentum: number;
  wellnessGrade: string;
}

export class FinancialHealthEngine {
  public static calculateHealth(state: State): FinancialHealthMetrics {
    const db = CalculationEngine.calculateDashboard(state);
    const portfolio = SelectorEngine.getPortfolioSummary(state);
    const billsSummary = SelectorEngine.getFinancialObligationSummary(state);
    const activeLoans = SelectorEngine.getActiveLoans(state);

    const accounts = state.accounts ?? [];
    const transactions = state.transactions ?? [];
    const budgets = state.budgets ?? [];
    const goals = state.goals ?? [];
    const bills = state.bills ?? [];

    // 1. Savings Rate
    const savingsRate = db.savingsRate;

    // 2. Cash Flow Score (0-100)
    // Positive cash flow is good; higher ratio of savings to income is better.
    let cashFlowScore = 50;
    if (db.monthlyIncome > 0) {
      const surplusRatio = (db.monthlyIncome - db.monthlyExpense) / db.monthlyIncome;
      cashFlowScore = Math.round(Math.max(0, Math.min(100, 50 + surplusRatio * 50)));
    } else if (db.monthlyExpense > 0) {
      cashFlowScore = 0;
    }

    // 3. Emergency Fund Score (0-100)
    // Target: 6 months of average expenses in cash/liquid accounts.
    const averageExpense = Math.max(10000, db.monthlyExpense); // fallback to min 10k for calculation
    const liquidBalance = accounts
      .filter((a) => a.type !== "credit_card" && a.type !== "investment")
      .reduce((sum, a) => sum + (a.balance ?? 0), 0);
    const emergencyFundMonths = liquidBalance / averageExpense;
    const emergencyFundScore = Math.round(Math.max(0, Math.min(100, (emergencyFundMonths / 6) * 100)));

    // 4. Debt Health (0-100)
    // Based on Debt-to-Asset ratio and EMI-to-Income ratio.
    let debtHealth = 100;
    const totalAssets = db.totalAssets;
    const totalLiabilities = db.totalLiabilities;
    const monthlyIncome = db.monthlyIncome;

    if (totalAssets > 0) {
      const debtToAsset = totalLiabilities / totalAssets;
      // Subtract points for higher debt-to-asset
      debtHealth -= Math.min(50, debtToAsset * 100);
    }
    if (monthlyIncome > 0) {
      const emis = activeLoans.reduce((sum, l) => sum + l.emi, 0);
      const emiToIncome = emis / monthlyIncome;
      // Subtract points for high EMI burden (ideal is <30%)
      debtHealth -= Math.min(50, emiToIncome * 150);
    } else if (totalLiabilities > 0) {
      debtHealth -= 50;
    }
    debtHealth = Math.round(Math.max(10, Math.min(100, debtHealth)));

    // 5. Investment Health (0-100)
    // Based on return percentage and diversification score.
    const returnPct = portfolio.returnPercentage;
    const divScore = portfolio.diversificationScore;
    let investmentHealth = 50;
    if (state.investments && state.investments.length > 0) {
      const returnPoints = returnPct > 0 ? Math.min(50, returnPct * 2) : Math.max(-50, returnPct * 3);
      investmentHealth = Math.round(Math.max(10, Math.min(100, 50 + returnPoints + (divScore - 50) * 0.5)));
    }

    // 6. Budget Health (0-100)
    // Percentage of budgets that are not overspent.
    let budgetHealth = 100;
    if (budgets.length > 0) {
      let overspentCount = 0;
      budgets.forEach((b) => {
        const metrics = CalculationEngine.calculateBudget(b, transactions);
        if (metrics.spent > b.limit) {
          overspentCount++;
        }
      });
      budgetHealth = Math.round(((budgets.length - overspentCount) / budgets.length) * 100);
    }

    // 7. Goal Progress Score (0-100)
    // Weighted average progress of active goals.
    let goalProgressScore = 100;
    const activeGoals = SelectorEngine.getActiveGoals(state);
    if (activeGoals.length > 0) {
      const totalProgress = activeGoals.reduce((sum, g) => sum + g.metrics.progress, 0);
      goalProgressScore = Math.round(totalProgress / activeGoals.length);
    }

    // 8. Recurring Obligation Score (0-100)
    // Bills/subscriptions as percentage of monthly income (ideal is < 20% of income).
    let recurringObligationScore = 100;
    const monthlyObligations = billsSummary.monthlyTotal;
    if (monthlyIncome > 0) {
      const obligationRatio = monthlyObligations / monthlyIncome;
      recurringObligationScore = Math.round(Math.max(10, Math.min(100, 100 - obligationRatio * 200)));
    } else if (monthlyObligations > 0) {
      recurringObligationScore = 30;
    }

    // 9. Liquidity Score (0-100)
    // Ratio of liquid assets to total assets (target: 10% - 30% for safety but not dragging returns).
    let liquidityScore = 100;
    if (totalAssets > 0) {
      const liquidityRatio = liquidBalance / totalAssets;
      if (liquidityRatio < 0.1) {
        liquidityScore = Math.round(liquidityRatio * 10 * 100); // penalize low liquidity
      } else if (liquidityRatio > 0.4) {
        liquidityScore = Math.round(Math.max(50, 100 - (liquidityRatio - 0.4) * 100)); // penalize excessive cash drag
      }
    }

    // 10. Diversification Score (0-100)
    const diversificationScore = divScore;

    // 11. Expense Stability (0-100)
    // Computes MoM expense variation over the last 6 months.
    let expenseStability = 80;
    const monthlyExpenses = this.getPastMonthsSum(transactions, "expense", 6);
    if (monthlyExpenses.length >= 2) {
      const mean = monthlyExpenses.reduce((s, v) => s + v, 0) / monthlyExpenses.length;
      if (mean > 0) {
        const variance = monthlyExpenses.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / monthlyExpenses.length;
        const stdDev = Math.sqrt(variance);
        const cv = stdDev / mean; // coefficient of variation
        expenseStability = Math.round(Math.max(10, Math.min(100, 100 - cv * 100)));
      }
    }

    // 12. Income Stability (0-100)
    // Computes MoM income variation over the last 6 months.
    let incomeStability = 80;
    const monthlyIncomes = this.getPastMonthsSum(transactions, "income", 6);
    if (monthlyIncomes.length >= 2) {
      const mean = monthlyIncomes.reduce((s, v) => s + v, 0) / monthlyIncomes.length;
      if (mean > 0) {
        const variance = monthlyIncomes.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / monthlyIncomes.length;
        const stdDev = Math.sqrt(variance);
        const cv = stdDev / mean;
        incomeStability = Math.round(Math.max(10, Math.min(100, 100 - cv * 50))); // less penalty for income variation
      }
    }

    // 13. Net Worth Trend (relative MoM change, expressed as -100 to 100)
    let netWorthTrend = 0;
    if (totalAssets > 0) {
      // Approximate prior net worth by subtracting this month's cash flow
      const currentMonthCashFlow = db.monthlyIncome - db.monthlyExpense;
      const priorNetWorth = db.netWorth - currentMonthCashFlow;
      if (priorNetWorth > 0) {
        netWorthTrend = Math.round((currentMonthCashFlow / priorNetWorth) * 100);
      }
    }

    // 14. Monthly Progress (0-100)
    // A score based on completing monthly budgets, paying bills, making goal contributions.
    let monthlyProgress = 100;
    const totalObligations = bills.length;
    if (totalObligations > 0) {
      monthlyProgress = billsSummary.paymentSuccessRate;
    }

    // 15. Financial Momentum (0-100)
    // Combination of savings rate and net worth growth trend.
    const financialMomentum = Math.round(
      Math.max(10, Math.min(100, (savingsRate * 0.6) + (50 + netWorthTrend * 2) * 0.4))
    );

    // 16. Overall Financial Health Score (0-100)
    // Weighted combination of key components:
    // 25% Emergency Fund, 20% Debt Health, 15% Budget Health, 15% Savings Rate / Cash Flow, 15% Investment Health, 10% Goal Progress
    const overallScore = Math.round(
      (emergencyFundScore * 0.25) +
      (debtHealth * 0.20) +
      (budgetHealth * 0.15) +
      (cashFlowScore * 0.15) +
      (state.investments && state.investments.length > 0 ? investmentHealth * 0.15 : cashFlowScore * 0.15) +
      (activeGoals.length > 0 ? goalProgressScore * 0.10 : 80 * 0.10)
    );

    // 17. Financial Wellness Grade (A+, A, B, C, D, F)
    let wellnessGrade = "F";
    if (overallScore >= 95) wellnessGrade = "A+";
    else if (overallScore >= 88) wellnessGrade = "A";
    else if (overallScore >= 80) wellnessGrade = "B";
    else if (overallScore >= 70) wellnessGrade = "C";
    else if (overallScore >= 55) wellnessGrade = "D";

    return {
      overallScore,
      savingsRate,
      cashFlowScore,
      emergencyFundScore,
      debtHealth,
      investmentHealth,
      budgetHealth,
      goalProgressScore,
      recurringObligationScore,
      liquidityScore,
      diversificationScore,
      expenseStability,
      incomeStability,
      netWorthTrend,
      monthlyProgress,
      financialMomentum,
      wellnessGrade
    };
  }

  private static getPastMonthsSum(transactions: any[], kind: "income" | "expense", count: number): number[] {
    const sums: Record<string, number> = {};
    const now = new Date();
    
    // Initialize buckets
    for (let i = 0; i < count; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      sums[key] = 0;
    }

    transactions.forEach((t) => {
      if (t.kind !== kind || !t.date) return;
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (sums[key] !== undefined) {
        sums[key] += t.amount ?? 0;
      }
    });

    return Object.values(sums);
  }
}

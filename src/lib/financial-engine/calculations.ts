import type { State, Transaction, Loan, Budget, Goal, Investment, Account } from "./types";

export class CalculationEngine {
  // --- LOAN CALCULATIONS ---
  public static calculateLoan(loan: Loan, transactions: Transaction[]): {
    monthlyEmi: number;
    totalInterest: number;
    totalPayable: number;
    outstandingBalance: number;
    remainingTenure: number;
    progressPercent: number;
    nextDueDate: string;
  } {
    const monthlyRate = (loan.rate / 12) / 100;
    const emi = loan.emi || (loan.principal * monthlyRate * Math.pow(1 + monthlyRate, loan.tenureMonths)) / 
                            (Math.pow(1 + monthlyRate, loan.tenureMonths) - 1);
    const totalPayable = emi * loan.tenureMonths;
    const totalInterest = Math.max(0, totalPayable - loan.principal);
    const progressPercent = loan.principal > 0 ? ((loan.principal - loan.outstanding) / loan.principal) * 100 : 0;

    // Remaining tenure based on outstanding balance & EMI interest coverage
    let remainingTenure = loan.tenureMonths;
    if (loan.outstanding > 0 && emi > loan.outstanding * monthlyRate) {
      remainingTenure = Math.round(
        Math.log(emi / (emi - loan.outstanding * monthlyRate)) / Math.log(1 + monthlyRate)
      );
    } else if (loan.outstanding === 0) {
      remainingTenure = 0;
    }

    // Next due date assumption: 5th of the next month (or current month if not yet paid)
    const today = new Date();
    const nextDue = new Date(today.getFullYear(), today.getMonth(), 5);
    if (nextDue < today) {
      nextDue.setMonth(nextDue.getMonth() + 1);
    }

    return {
      monthlyEmi: Math.round(emi * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalPayable: Math.round(totalPayable * 100) / 100,
      outstandingBalance: loan.outstanding,
      remainingTenure: Math.max(0, remainingTenure),
      progressPercent: Math.min(100, Math.max(0, progressPercent)),
      nextDueDate: nextDue.toISOString().slice(0, 10),
    };
  }

  // --- BUDGET CALCULATIONS ---
  public static calculateBudget(budget: Budget, transactions: Transaction[]): {
    spent: number;
    remaining: number;
    overspending: number;
    utilization: number;
  } {
    const now = new Date();
    const spent = transactions
      .filter((t) => t.kind === "expense" && t.category === budget.category)
      .filter((t) => {
        const d = new Date(t.date);
        if (budget.period === "weekly") {
          const diffTime = Math.abs(now.getTime() - d.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays <= 7;
        }
        if (budget.period === "yearly") {
          return d.getFullYear() === now.getFullYear();
        }
        // default monthly
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, t) => s + t.amount, 0);

    return {
      spent,
      remaining: Math.max(0, budget.limit - spent),
      overspending: Math.max(0, spent - budget.limit),
      utilization: budget.limit > 0 ? (spent / budget.limit) * 100 : 0,
    };
  }

  // --- GOAL CALCULATIONS ---
  public static calculateGoal(goal: Goal, transactions: Transaction[]): {
    progress: number;
    fundingGap: number;
    estimatedCompletionMonths: number;
  } {
    const progress = goal.target > 0 ? (goal.saved / goal.target) * 100 : 0;
    const fundingGap = Math.max(0, goal.target - goal.saved);

    // Compute contribution velocity from the last 90 days to estimate completion
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const contributions = transactions
      .filter((t) => t.kind === "expense" && t.merchant === `Goal: ${goal.name}`)
      .filter((t) => new Date(t.date) >= ninetyDaysAgo);
    
    const totalContributed = contributions.reduce((s, t) => s + t.amount, 0);
    const monthlyRate = totalContributed / 3; // 3 months average
    const estimatedCompletionMonths = monthlyRate > 0 ? fundingGap / monthlyRate : Infinity;

    return {
      progress: Math.min(100, Math.max(0, progress)),
      fundingGap,
      estimatedCompletionMonths: isFinite(estimatedCompletionMonths) ? Math.round(estimatedCompletionMonths * 10) / 10 : -1,
    };
  }

  // --- INVESTMENT CALCULATIONS ---
  public static calculateInvestment(investments: Investment[]): {
    portfolioValue: number;
    portfolioInvested: number;
    unrealizedPl: number;
    returnPercentage: number;
  } {
    const portfolioValue = investments.reduce((sum, inv) => sum + inv.current, 0);
    const portfolioInvested = investments.reduce((sum, inv) => sum + inv.invested, 0);
    const unrealizedPl = portfolioValue - portfolioInvested;
    const returnPercentage = portfolioInvested > 0 ? (unrealizedPl / portfolioInvested) * 100 : 0;

    return {
      portfolioValue,
      portfolioInvested,
      unrealizedPl,
      returnPercentage,
    };
  }

  // --- GLOBAL DASHBOARD & NET WORTH ---
  public static calculateDashboard(state: State): {
    netWorth: number;
    totalAssets: number;
    totalLiabilities: number;
    cashBalance: number;
    investmentBalance: number;
    loanOutstanding: number;
    monthlyIncome: number;
    monthlyExpense: number;
    savingsRate: number;
    healthScore: number;
  } {
    const cashBalance = state.accounts
      .filter((a) => a.type !== "credit_card" && a.type !== "investment")
      .reduce((sum, a) => sum + a.balance, 0);

    const investmentBalance = state.investments.reduce((sum, i) => sum + i.current, 0);
    const loanOutstanding = state.loans.reduce((sum, l) => sum + l.outstanding, 0);
    
    // Credit card balances count as negative assets (liabilities)
    const ccLiabilities = state.accounts
      .filter((a) => a.type === "credit_card")
      .reduce((sum, a) => sum + Math.abs(a.balance), 0);

    const totalAssets = cashBalance + investmentBalance;
    const totalLiabilities = loanOutstanding + ccLiabilities;
    const netWorth = totalAssets - totalLiabilities;

    // Monthly Cash Flow
    const now = new Date();
    const currentMonthTx = state.transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const monthlyIncome = currentMonthTx.filter((t) => t.kind === "income").reduce((sum, t) => sum + t.amount, 0);
    const monthlyExpense = currentMonthTx.filter((t) => t.kind === "expense").reduce((sum, t) => sum + t.amount, 0);
    const savingsRate = monthlyIncome > 0 ? Math.max(0, ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100) : 0;

    // Financial Health Score Heuristics
    let score = 75;

    // 1. Savings Rate impact: up to +15 or -10
    if (savingsRate > 35) score += 15;
    else if (savingsRate > 20) score += 10;
    else if (savingsRate > 10) score += 5;
    else if (savingsRate === 0) score -= 10;

    // 2. Debt-to-Asset Ratio impact: up to +10 or -20
    if (totalAssets > 0 && totalLiabilities > 0) {
      const ratio = totalLiabilities / totalAssets;
      if (ratio <= 0.1) score += 10;
      else if (ratio <= 0.3) score += 5;
      else if (ratio > 0.5) score -= 20;
    } else if (totalLiabilities === 0) {
      score += 10;
    }

    // 3. Budgets overrun impact: -10 per exceeded budget
    const currentMonthExpenses = new Map<string, number>();
    currentMonthTx
      .filter((t) => t.kind === "expense")
      .forEach((t) => currentMonthExpenses.set(t.category, (currentMonthExpenses.get(t.category) || 0) + t.amount));

    state.budgets.forEach((b) => {
      const spent = currentMonthExpenses.get(b.category) || 0;
      if (spent > b.limit) {
        score -= 10;
      }
    });

    // 4. Goals progress impact: +5 per goal that is >50% funded
    state.goals.forEach((g) => {
      const pct = g.target ? (g.saved / g.target) * 100 : 0;
      if (pct >= 100) score += 5;
      else if (pct >= 50) score += 3;
    });

    const healthScore = Math.max(10, Math.min(100, score));

    return {
      netWorth,
      totalAssets,
      totalLiabilities,
      cashBalance,
      investmentBalance,
      loanOutstanding,
      monthlyIncome,
      monthlyExpense,
      savingsRate,
      healthScore,
    };
  }
}

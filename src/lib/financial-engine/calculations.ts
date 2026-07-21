import type { State, Transaction, Loan, Budget, Goal, Investment, Account, Bill } from "./types";

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
    principalPaid: number;
    interestPaid: number;
    remainingInterest: number;
    remainingPrincipal: number;
    loanHealth: "Excellent" | "Good" | "Overdue" | "Closed";
  } {
    const monthlyRate = (loan.rate / 12) / 100;
    const emi = loan.emi || (monthlyRate > 0 
      ? (loan.principal * monthlyRate * Math.pow(1 + monthlyRate, loan.tenureMonths)) / (Math.pow(1 + monthlyRate, loan.tenureMonths) - 1)
      : loan.principal / loan.tenureMonths);

    const totalPayable = emi * loan.tenureMonths;
    const totalInterest = Math.max(0, totalPayable - loan.principal);

    // Repayments from ledger
    const repayments = transactions
      .filter((t) => t.linkedEntityId === loan.id || (t.category === "EMI" && t.merchant?.toLowerCase().includes(loan.name.toLowerCase())))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let outstanding = loan.principal;
    let interestPaid = 0;
    let principalPaid = 0;

    for (const txn of repayments) {
      const interestPortion = outstanding * monthlyRate;
      const principalPortion = Math.max(0, txn.amount - interestPortion);
      interestPaid += interestPortion;
      principalPaid += principalPortion;
      outstanding = Math.max(0, outstanding - principalPortion);
    }

    const progressPercent = loan.principal > 0 ? (principalPaid / loan.principal) * 100 : 0;

    let remainingTenure = loan.tenureMonths;
    if (outstanding > 0 && emi > outstanding * monthlyRate) {
      remainingTenure = Math.round(
        Math.log(emi / (emi - outstanding * monthlyRate)) / Math.log(1 + monthlyRate)
      );
    } else if (outstanding === 0) {
      remainingTenure = 0;
    }

    const today = new Date();
    const nextDue = new Date(today.getFullYear(), today.getMonth(), 5);
    if (nextDue < today) {
      nextDue.setMonth(nextDue.getMonth() + 1);
    }

    // Heuristic loan health
    let loanHealth: "Excellent" | "Good" | "Overdue" | "Closed" = "Good";
    if (outstanding <= 0) {
      loanHealth = "Closed";
    } else {
      // Check if we missed the due date of current month (after 5th) and there are no payments this month
      const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const paidThisMonth = repayments.some((t) => new Date(t.date) >= startOfCurrentMonth);
      if (today.getDate() > 5 && !paidThisMonth) {
        loanHealth = "Overdue";
      } else if (progressPercent > 50) {
        loanHealth = "Excellent";
      }
    }

    return {
      monthlyEmi: Math.round(emi * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalPayable: Math.round(totalPayable * 100) / 100,
      outstandingBalance: Math.round(outstanding * 100) / 100,
      remainingTenure: Math.max(0, remainingTenure),
      progressPercent: Math.min(100, Math.max(0, progressPercent)),
      nextDueDate: nextDue.toISOString().slice(0, 10),
      principalPaid: Math.round(principalPaid * 100) / 100,
      interestPaid: Math.round(interestPaid * 100) / 100,
      remainingInterest: Math.round(Math.max(0, totalInterest - interestPaid) * 100) / 100,
      remainingPrincipal: Math.round(outstanding * 100) / 100,
      loanHealth,
    };
  }

  // --- BUDGET CALCULATIONS ---
  public static getBudgetCycleBounds(budget: Budget, refDate: Date = new Date()): { start: Date; end: Date } {
    const d = new Date(refDate);
    let start = new Date(d);
    let end = new Date(d);

    switch (budget.period) {
      case "daily":
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case "weekly": {
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Align to Monday
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      }
      case "biweekly": {
        if (budget.startDate) {
          const anchor = new Date(budget.startDate);
          anchor.setHours(0, 0, 0, 0);
          const msPerCycle = 14 * 24 * 60 * 60 * 1000;
          const diffMs = start.getTime() - anchor.getTime();
          const cycles = Math.floor(diffMs / msPerCycle);
          start = new Date(anchor.getTime() + cycles * msPerCycle);
          end = new Date(start.getTime() + msPerCycle - 1);
        } else {
          const day = start.getDay();
          const diff = start.getDate() - day + (day === 0 ? -6 : 1);
          start.setDate(diff);
          start.setHours(0, 0, 0, 0);
          end = new Date(start);
          end.setDate(start.getDate() + 13);
          end.setHours(23, 59, 59, 999);
        }
        break;
      }
      case "quarterly": {
        const month = start.getMonth();
        const quarterStartMonth = Math.floor(month / 3) * 3;
        start.setMonth(quarterStartMonth, 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setMonth(start.getMonth() + 3, 0);
        end.setHours(23, 59, 59, 999);
        break;
      }
      case "yearly":
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(11, 31);
        end.setHours(23, 59, 59, 999);
        break;
      case "custom":
        if (budget.startDate) {
          start = new Date(budget.startDate);
          start.setHours(0, 0, 0, 0);
        } else {
          start.setMonth(0, 1);
          start.setHours(0, 0, 0, 0);
        }
        if (budget.endDate) {
          end = new Date(budget.endDate);
          end.setHours(23, 59, 59, 999);
        } else {
          end = new Date(start);
          end.setMonth(start.getMonth() + 1);
          end.setHours(23, 59, 59, 999);
        }
        break;
      case "monthly":
      default:
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(start.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return { start, end };
  }

  // --- BUDGET CALCULATIONS ---
  public static calculateBudget(budget: Budget, transactions: Transaction[]): {
    spent: number;
    remaining: number;
    overspending: number;
    utilization: number;
    remainingDays: number;
    totalDays: number;
    daysElapsed: number;
    dailySpendingRate: number;
    projectedSpent: number;
    averageSpending: number;
    budgetHealth: "Excellent" | "Good" | "Warning" | "Critical";
    budgetTrend: "decreasing" | "stable" | "increasing";
    budgetVariance: number;
    forecast: number;
    cycleStart: string;
    cycleEnd: string;
  } {
    const bounds = this.getBudgetCycleBounds(budget);
    
    // Spent matches expense transactions in this category within bounds
    const spent = transactions
      .filter((t) => t.kind === "expense" && t.category === budget.category)
      .filter((t) => {
        const d = new Date(t.date);
        return d >= bounds.start && d <= bounds.end;
      })
      .reduce((s, t) => s + t.amount, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endCopy = new Date(bounds.end);
    endCopy.setHours(0, 0, 0, 0);

    const totalDiff = bounds.end.getTime() - bounds.start.getTime();
    const totalDays = Math.max(1, Math.ceil(totalDiff / (1000 * 60 * 60 * 24)));

    const diffTime = endCopy.getTime() - today.getTime();
    const remainingDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const daysElapsed = Math.max(1, totalDays - remainingDays);

    const dailySpendingRate = spent / daysElapsed;
    const projectedSpent = dailySpendingRate * totalDays;
    const averageSpending = dailySpendingRate;

    const remaining = Math.max(0, budget.limit - spent);
    const overspending = Math.max(0, spent - budget.limit);
    const utilization = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;

    let budgetHealth: "Excellent" | "Good" | "Warning" | "Critical" = "Excellent";
    if (utilization > 100) {
      budgetHealth = "Critical";
    } else if (utilization > 80) {
      budgetHealth = "Warning";
    } else if (utilization > 50) {
      budgetHealth = "Good";
    }

    const timeProgress = (daysElapsed / totalDays) * 100;
    const budgetTrend = (utilization - timeProgress) > 10 
      ? "increasing" 
      : (timeProgress - utilization) > 10 
        ? "decreasing" 
        : "stable";

    const budgetVariance = budget.limit - spent;
    const forecast = projectedSpent;

    return {
      spent,
      remaining,
      overspending,
      utilization,
      remainingDays,
      totalDays,
      daysElapsed,
      dailySpendingRate,
      projectedSpent,
      averageSpending,
      budgetHealth,
      budgetTrend,
      budgetVariance,
      forecast,
      cycleStart: bounds.start.toISOString().slice(0, 10),
      cycleEnd: bounds.end.toISOString().slice(0, 10),
    };
  }

  // --- GOAL CALCULATIONS ---
  public static calculateGoal(goal: Goal, transactions: Transaction[]) {
    const progress = goal.target > 0 ? (goal.saved / goal.target) * 100 : 0;
    const fundingGap = Math.max(0, goal.target - goal.saved);
    const isCompleted = goal.saved >= goal.target;

    // Deadline analysis
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(goal.deadline);
    deadline.setHours(0, 0, 0, 0);
    const daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    const monthsRemaining = Math.max(0, daysRemaining / 30.44);
    const isOverdue = !isCompleted && deadline < today;

    // Contribution history — match both legacy merchant format and linked entity transactions
    const allContributions = transactions.filter(
      (t) =>
        (t.kind === "expense" && t.merchant === `Goal: ${goal.name}`) ||
        (t.linkedEntityId === goal.id && t.linkedEntityType === "goal")
    );

    const contributionCount = allContributions.length;
    const totalContributed = allContributions.reduce((s, t) => s + t.amount, 0);

    // Average monthly contribution rate (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const recentContributions = allContributions.filter((t) => new Date(t.date) >= ninetyDaysAgo);
    const recentTotal = recentContributions.reduce((s, t) => s + t.amount, 0);
    const averageMonthlyContribution = recentTotal / 3;

    // Required monthly contribution to meet deadline
    const requiredMonthlyContribution = monthsRemaining > 0 ? fundingGap / monthsRemaining : fundingGap;

    // Estimated completion
    const estimatedCompletionMonths = averageMonthlyContribution > 0 ? fundingGap / averageMonthlyContribution : Infinity;

    // Goal health heuristic
    let goalHealth: "Excellent" | "Good" | "Warning" | "Critical" = "Excellent";
    if (isCompleted) {
      goalHealth = "Excellent";
    } else if (isOverdue) {
      goalHealth = "Critical";
    } else if (monthsRemaining > 0 && averageMonthlyContribution > 0) {
      const ratio = requiredMonthlyContribution / averageMonthlyContribution;
      if (ratio <= 1) goalHealth = "Excellent";
      else if (ratio <= 1.5) goalHealth = "Good";
      else if (ratio <= 3) goalHealth = "Warning";
      else goalHealth = "Critical";
    } else if (progress >= 75) {
      goalHealth = "Good";
    } else if (progress >= 25) {
      goalHealth = "Warning";
    } else {
      goalHealth = "Critical";
    }

    // Goal trend — compare recent 30-day rate vs prior 30-day rate
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const last30 = allContributions
      .filter((t) => new Date(t.date) >= thirtyDaysAgo)
      .reduce((s, t) => s + t.amount, 0);
    const prev30 = allContributions
      .filter((t) => { const d = new Date(t.date); return d >= sixtyDaysAgo && d < thirtyDaysAgo; })
      .reduce((s, t) => s + t.amount, 0);

    let goalTrend: "increasing" | "decreasing" | "stable" = "stable";
    if (last30 > prev30 * 1.1) goalTrend = "increasing";
    else if (last30 < prev30 * 0.9 && prev30 > 0) goalTrend = "decreasing";

    // Forecast — projected saved amount at deadline
    const goalForecast = averageMonthlyContribution > 0
      ? Math.min(goal.target, goal.saved + averageMonthlyContribution * monthsRemaining)
      : goal.saved;

    return {
      progress: Math.min(100, Math.max(0, progress)),
      fundingGap,
      estimatedCompletionMonths: isFinite(estimatedCompletionMonths)
        ? Math.round(estimatedCompletionMonths * 10) / 10
        : -1,
      requiredMonthlyContribution,
      averageMonthlyContribution,
      goalHealth,
      goalTrend,
      goalForecast,
      contributionCount,
      totalContributed,
      isOverdue,
      isCompleted,
      daysRemaining,
      monthsRemaining: Math.round(monthsRemaining * 10) / 10,
    };
  }

  // --- BILL & OBLIGATION CALCULATIONS ---
  public static calculateBills(bills: Bill[], transactions: Transaction[]): {
    upcomingBills: Bill[];
    paidBills: Bill[];
    overdueBills: Bill[];
    missedBills: Bill[];
    upcomingAmount: number;
    monthlyObligations: number;
    yearlyObligations: number;
    recurringCost: number;
    subscriptionCost: number;
    cashFlowImpact: number;
    financialObligationScore: number;
    paymentSuccessRate: number;
    latePaymentCount: number;
    totalObligationsCount: number;
  } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingBills: Bill[] = [];
    const paidBills: Bill[] = [];
    const overdueBills: Bill[] = [];
    const missedBills: Bill[] = [];

    let upcomingAmount = 0;
    let monthlyObligations = 0;
    let yearlyObligations = 0;
    let recurringCost = 0;
    let subscriptionCost = 0;

    const billPayments = transactions.filter(t => t.linkedEntityType === "bill");
    let latePaymentCount = 0;

    bills.forEach(bill => {
      const isPaid = bill.status === "paid" || bill.paid;
      const dueDate = new Date(bill.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      const amount = bill.amount;
      const frequency = bill.paymentFrequency || "monthly";

      let monthlyEquivalent = 0;
      let yearlyEquivalent = 0;

      switch (frequency) {
        case "daily":
          monthlyEquivalent = amount * 30;
          yearlyEquivalent = amount * 365;
          break;
        case "weekly":
          monthlyEquivalent = amount * 4.33;
          yearlyEquivalent = amount * 52;
          break;
        case "biweekly":
          monthlyEquivalent = amount * 2.16;
          yearlyEquivalent = amount * 26;
          break;
        case "monthly":
          monthlyEquivalent = amount;
          yearlyEquivalent = amount * 12;
          break;
        case "quarterly":
          monthlyEquivalent = amount / 3;
          yearlyEquivalent = amount * 4;
          break;
        case "half-yearly":
          monthlyEquivalent = amount / 6;
          yearlyEquivalent = amount * 2;
          break;
        case "yearly":
          monthlyEquivalent = amount / 12;
          yearlyEquivalent = amount;
          break;
        case "one-time":
        default:
          const isThisMonth = dueDate.getMonth() === today.getMonth() && dueDate.getFullYear() === today.getFullYear();
          monthlyEquivalent = isThisMonth ? amount : 0;
          yearlyEquivalent = amount;
          break;
      }

      monthlyObligations += monthlyEquivalent;
      yearlyObligations += yearlyEquivalent;

      if (frequency !== "one-time") {
        recurringCost += monthlyEquivalent;
      }

      const isSubscription = bill.category === "Streaming Subscription" || 
                             bill.category === "Membership" || 
                             (bill.metadata && bill.metadata.isSubscription);
      if (isSubscription) {
        subscriptionCost += monthlyEquivalent;
      }

      if (isPaid) {
        paidBills.push(bill);
        const paymentTx = billPayments.find(t => t.linkedEntityId === bill.id);
        if (paymentTx) {
          const payDate = new Date(paymentTx.date);
          payDate.setHours(0, 0, 0, 0);
          if (payDate > dueDate) {
            latePaymentCount++;
          }
        }
      } else {
        const timeDiff = dueDate.getTime() - today.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        if (daysDiff < 0) {
          const gracePeriod = bill.gracePeriod || 0;
          if (Math.abs(daysDiff) > gracePeriod) {
            missedBills.push(bill);
            bill.status = "missed";
          } else {
            overdueBills.push(bill);
            bill.status = "overdue";
          }
        } else {
          upcomingBills.push(bill);
          upcomingAmount += amount;
        }
      }
    });

    const totalObligationsCount = bills.length;
    const paymentSuccessRate = totalObligationsCount > 0 
      ? Math.max(0, 100 - ((missedBills.length + latePaymentCount) / totalObligationsCount) * 100) 
      : 100;

    let financialObligationScore = 100;
    financialObligationScore -= missedBills.length * 15;
    financialObligationScore -= overdueBills.length * 5;
    financialObligationScore -= latePaymentCount * 2;
    financialObligationScore = Math.max(10, Math.min(100, financialObligationScore));

    const cashFlowImpact = monthlyObligations;

    return {
      upcomingBills,
      paidBills,
      overdueBills,
      missedBills,
      upcomingAmount,
      monthlyObligations,
      yearlyObligations,
      recurringCost,
      subscriptionCost,
      cashFlowImpact,
      financialObligationScore,
      paymentSuccessRate,
      latePaymentCount,
      totalObligationsCount
    };
  }

  // --- INVESTMENT CALCULATIONS ---
  public static calculateInvestment(investments: Investment[]): {
    portfolioValue: number;
    portfolioInvested: number;
    unrealizedPl: number;
    returnPercentage: number;
  } {
    const portfolioValue = investments.reduce((sum, inv) => sum + ((inv.units ?? 0) > 0 ? (inv.units ?? 0) * (inv.currentPrice ?? 0) : (inv.current ?? 0)), 0);
    const portfolioInvested = investments.reduce((sum, inv) => sum + ((inv.units ?? 0) > 0 ? (inv.units ?? 0) * (inv.averageBuyPrice ?? 0) : (inv.invested ?? 0)), 0);
    const unrealizedPl = portfolioValue - portfolioInvested;
    const returnPercentage = portfolioInvested > 0 ? (unrealizedPl / portfolioInvested) * 100 : 0;

    return {
      portfolioValue,
      portfolioInvested,
      unrealizedPl,
      returnPercentage,
    };
  }

  public static calculateXIRRRaw(cashFlows: { date: Date; amount: number }[]): number {
    // Group by date (ignoring time) to prevent intraday/millisecond anomalies
    const grouped = new Map<number, number>();
    cashFlows.forEach(cf => {
      const d = new Date(cf.date);
      d.setHours(0, 0, 0, 0);
      const time = d.getTime();
      grouped.set(time, (grouped.get(time) || 0) + cf.amount);
    });

    const normalizedFlows = Array.from(grouped.entries())
      .map(([time, amount]) => ({ date: new Date(time), amount }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (normalizedFlows.length < 2) return 0;
    
    const hasPositive = normalizedFlows.some(cf => cf.amount > 0);
    const hasNegative = normalizedFlows.some(cf => cf.amount < 0);
    if (!hasPositive || !hasNegative) return 0;

    // Check if the total span is 0 days
    const t0 = normalizedFlows[0].date.getTime();
    const tn = normalizedFlows[normalizedFlows.length - 1].date.getTime();
    if (t0 === tn) return 0;

    const maxIter = 100;
    const tol = 1e-6;
    let r = 0.1;

    for (let iter = 0; iter < maxIter; iter++) {
      let f = 0;
      let df = 0;

      for (const cf of normalizedFlows) {
        const t = (cf.date.getTime() - t0) / (365 * 24 * 60 * 60 * 1000);
        const val = 1 + r;
        if (val <= 0) {
          r = -0.5;
          break;
        }
        f += cf.amount / Math.pow(val, t);
        df -= t * cf.amount / Math.pow(val, t + 1);
      }

      if (Math.abs(df) < 1e-12) break;

      const nextR = r - f / df;
      if (Math.abs(nextR - r) < tol) {
        return nextR;
      }
      r = nextR;
    }

    return r;
  }

  public static calculatePortfolioDetailed(investments: Investment[], transactions: Transaction[]) {
    // 1. Calculate values for each investment
    const processedInvestments = investments.map(inv => {
      const units = inv.units ?? 0;
      const currentPrice = inv.currentPrice ?? 0;
      const averageBuyPrice = inv.averageBuyPrice ?? 0;
      
      const currentValue = units > 0 ? units * currentPrice : (inv.current ?? 0);
      const totalInvested = units > 0 ? units * averageBuyPrice : (inv.invested ?? 0);
      const gainLoss = currentValue - totalInvested;
      const gainLossPercentage = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0;
      
      // Realized profit/loss for this investment from ledger
      const sales = transactions.filter(t => t.linkedEntityId === inv.id && t.kind === "investment_sale");
      const realizedPl = sales.reduce((sum, t) => sum + (t.metadata?.realizedGainLoss ?? 0), 0);
      
      // Dividends received
      const dividends = transactions.filter(t => t.linkedEntityId === inv.id && t.kind === "dividend");
      const totalDividends = dividends.reduce((sum, t) => sum + t.amount, 0);

      // Return object with derived properties populated
      return {
        ...inv,
        currentValue,
        totalInvested,
        gainLoss,
        gainLossPercentage,
        realizedPl,
        totalDividends,
        // Support legacy fields
        current: currentValue,
        invested: totalInvested,
      };
    });

    const activeInvestments = processedInvestments.filter(i => i.units > 0 || (i.units === undefined && i.currentValue > 0));

    // 2. Summary stats
    const portfolioValue = activeInvestments.reduce((sum, i) => sum + i.currentValue, 0);
    const portfolioInvested = activeInvestments.reduce((sum, i) => sum + i.totalInvested, 0);
    const unrealizedPl = portfolioValue - portfolioInvested;
    const returnPercentage = portfolioInvested > 0 ? (unrealizedPl / portfolioInvested) * 100 : 0;

    // Realized profits/losses from all transactions
    const totalRealizedPl = transactions
      .filter(t => t.kind === "investment_sale")
      .reduce((sum, t) => sum + (t.metadata?.realizedGainLoss ?? 0), 0);

    const totalDividends = transactions
      .filter(t => t.kind === "dividend")
      .reduce((sum, t) => sum + t.amount, 0);

    const dividendYield = portfolioInvested > 0 ? (totalDividends / portfolioInvested) * 100 : 0;

    // 3. CAGR and XIRR
    // CAGR
    let firstPurchaseDate: Date | null = null;
    transactions.forEach(t => {
      if ((t.kind === "investment_purchase" || t.kind === "investment_sale") && t.date) {
        const d = new Date(t.date);
        if (!firstPurchaseDate || d < firstPurchaseDate) {
          firstPurchaseDate = d;
        }
      }
    });

    // Fallback if no transactions
    if (!firstPurchaseDate && activeInvestments.length > 0) {
      activeInvestments.forEach(i => {
        if (i.purchaseDate) {
          const d = new Date(i.purchaseDate);
          if (!firstPurchaseDate || d < firstPurchaseDate) {
            firstPurchaseDate = d;
          }
        }
      });
    }

    const today = new Date();
    let years = 0;
    if (firstPurchaseDate) {
      const diffMs = today.getTime() - (firstPurchaseDate as Date).getTime();
      years = diffMs / (365 * 24 * 60 * 60 * 1000);
    }

    const cagr = (portfolioInvested > 0 && portfolioValue > 0 && years > 0.1)
      ? (Math.pow(portfolioValue / portfolioInvested, 1 / years) - 1) * 100
      : returnPercentage; // fallback to absolute return if short time or 0 value

    // XIRR
    const cashFlows: { date: Date; amount: number }[] = [];
    transactions.forEach(t => {
      if (t.kind === "investment_purchase") {
        cashFlows.push({ date: new Date(t.date), amount: -t.amount });
      } else if (t.kind === "investment_sale") {
        cashFlows.push({ date: new Date(t.date), amount: t.amount });
      } else if (t.kind === "dividend") {
        cashFlows.push({ date: new Date(t.date), amount: t.amount });
      }
    });

    // Add current portfolio valuation as a final cash inflow
    if (portfolioValue > 0) {
      cashFlows.push({ date: today, amount: portfolioValue });
    }

    // Sort cash flows by date
    cashFlows.sort((a, b) => a.date.getTime() - b.date.getTime());

    let xirr = 0;
    try {
      xirr = this.calculateXIRRRaw(cashFlows) * 100;
      if (xirr === 0) {
        xirr = cagr;
      }
    } catch (e) {
      xirr = cagr; // fallback
    }

    // 4. Allocations
    // Portfolio Allocation (holdings weight)
    const portfolioAllocation = activeInvestments.map(i => ({
      id: i.id,
      name: i.name,
      value: i.currentValue,
      percentage: portfolioValue > 0 ? (i.currentValue / portfolioValue) * 100 : 0
    })).sort((a, b) => b.value - a.value);

    // Asset Allocation
    const assetAllocMap = new Map<string, number>();
    activeInvestments.forEach(i => {
      const typeLabel = i.type;
      assetAllocMap.set(typeLabel, (assetAllocMap.get(typeLabel) || 0) + i.currentValue);
    });
    const assetAllocation = Array.from(assetAllocMap.entries()).map(([name, value]) => ({
      name,
      value,
      percentage: portfolioValue > 0 ? (value / portfolioValue) * 100 : 0
    })).sort((a, b) => b.value - a.value);

    // Sector Allocation
    const sectorAllocMap = new Map<string, number>();
    activeInvestments.forEach(i => {
      const sector = i.metadata?.sector || (i.tags && i.tags[0]) || "Other";
      sectorAllocMap.set(sector, (sectorAllocMap.get(sector) || 0) + i.currentValue);
    });
    const sectorAllocation = Array.from(sectorAllocMap.entries()).map(([name, value]) => ({
      name,
      value,
      percentage: portfolioValue > 0 ? (value / portfolioValue) * 100 : 0
    })).sort((a, b) => b.value - a.value);

    // 5. Diversification and Risk Scores
    // Diversification (HHI Index)
    let hhi = 0;
    if (portfolioValue > 0) {
      activeInvestments.forEach(i => {
        const weight = i.currentValue / portfolioValue;
        hhi += weight * weight;
      });
    }
    const diversificationScore = portfolioValue > 0 
      ? Math.round(Math.max(0, 100 - hhi * 100))
      : 100;

    // Risk Score (weighted)
    const riskWeights: Record<string, number> = {
      crypto: 95,
      stock: 75,
      commodity: 60,
      real_estate: 45,
      reit: 50,
      etf: 45,
      mutual_fund: 40,
      bond: 20,
      fd: 10,
      ppf: 5,
      nps: 20,
      gold: 25,
      silver: 25,
      custom: 50
    };

    let totalWeightedRisk = 0;
    if (portfolioValue > 0) {
      activeInvestments.forEach(i => {
        const weight = i.currentValue / portfolioValue;
        const risk = riskWeights[i.type] || 50;
        totalWeightedRisk += weight * risk;
      });
    }
    const riskScore = Math.round(totalWeightedRisk);

    // 6. Portfolio Health Status & Alerts
    let portfolioHealth: "Excellent" | "Good" | "Moderate" | "Risky" | "Needs Attention" = "Good";
    const healthAlerts: string[] = [];

    if (activeInvestments.length === 0) {
      portfolioHealth = "Moderate";
      healthAlerts.push("Portfolio is empty. Add your first holding to start tracking.");
    } else {
      if (diversificationScore < 30) {
        portfolioHealth = "Needs Attention";
        healthAlerts.push("Highly concentrated portfolio. Consider diversifying to reduce risk.");
      } else if (diversificationScore < 50) {
        portfolioHealth = "Moderate";
        healthAlerts.push("Moderately concentrated portfolio. A few assets hold the majority of the value.");
      }

      if (riskScore > 75) {
        portfolioHealth = "Risky";
        healthAlerts.push("High-risk portfolio. A large portion is allocated to volatile assets like stocks or crypto.");
      }

      activeInvestments.forEach(i => {
        if (portfolioValue > 0 && (i.currentValue / portfolioValue) > 0.3) {
          healthAlerts.push(`Concentration alert: "${i.name}" represents ${(i.currentValue / portfolioValue * 100).toFixed(1)}% of your portfolio.`);
        }
      });
    }

    if (healthAlerts.length === 0) {
      if (diversificationScore >= 70 && riskScore <= 50) {
        portfolioHealth = "Excellent";
      } else {
        portfolioHealth = "Good";
      }
    }

    const gainersLosers = [...activeInvestments].sort((a, b) => b.gainLossPercentage - a.gainLossPercentage);
    const topGainers = gainersLosers.filter(i => i.gainLoss > 0).slice(0, 3);
    const topLosers = [...gainersLosers].reverse().filter(i => i.gainLoss < 0).slice(0, 3);

    return {
      investments: processedInvestments,
      portfolioValue,
      portfolioInvested,
      unrealizedPl,
      returnPercentage,
      realizedPl: totalRealizedPl,
      totalDividends,
      dividendYield,
      cagr,
      xirr,
      diversificationScore,
      riskScore,
      portfolioHealth,
      healthAlerts,
      portfolioAllocation,
      assetAllocation,
      sectorAllocation,
      topGainers,
      topLosers,
      timeline: transactions
        .filter(t => t.linkedEntityType === "investment" || t.category === "Investments")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
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
    // Null-safety: coalesce all arrays to prevent crashes from legacy/partial state
    const accounts = state.accounts ?? [];
    const investments = state.investments ?? [];
    const loans = state.loans ?? [];
    const transactions = state.transactions ?? [];
    const budgets = state.budgets ?? [];
    const goals = state.goals ?? [];
    const bills = state.bills ?? [];

    const cashBalance = accounts
      .filter((a) => a.type !== "credit_card" && a.type !== "investment")
      .reduce((sum, a) => sum + (a.balance ?? 0), 0);

    const investmentBalance = investments.reduce((sum, inv) => sum + ((inv.units ?? 0) > 0 ? (inv.units ?? 0) * (inv.currentPrice ?? 0) : (inv.current ?? 0)), 0);
    const loanOutstanding = loans.reduce((sum, l) => {
      try {
        const metrics = CalculationEngine.calculateLoan(l, transactions);
        return sum + metrics.outstandingBalance;
      } catch (e) {
        console.error("[CalculationEngine] Error calculating loan:", l.id, e);
        return sum + (l.outstanding ?? 0);
      }
    }, 0);
    
    const ccLiabilities = accounts
      .filter((a) => a.type === "credit_card")
      .reduce((sum, a) => sum + Math.abs(a.balance ?? 0), 0);

    const totalAssets = cashBalance + investmentBalance;
    const totalLiabilities = loanOutstanding + ccLiabilities;
    const netWorth = totalAssets - totalLiabilities;

    const now = new Date();
    const currentMonthTx = transactions.filter((t) => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const monthlyIncome = currentMonthTx.filter((t) => t.kind === "income").reduce((sum, t) => sum + (t.amount ?? 0), 0);
    const monthlyExpense = currentMonthTx.filter((t) => t.kind === "expense").reduce((sum, t) => sum + (t.amount ?? 0), 0);
    const savingsRate = monthlyIncome > 0 ? Math.max(0, ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100) : 0;

    let score = 75;

    if (savingsRate > 35) score += 15;
    else if (savingsRate > 20) score += 10;
    else if (savingsRate > 10) score += 5;
    else if (savingsRate === 0) score -= 10;

    if (totalAssets > 0 && totalLiabilities > 0) {
      const ratio = totalLiabilities / totalAssets;
      if (ratio <= 0.1) score += 10;
      else if (ratio <= 0.3) score += 5;
      else if (ratio > 0.5) score -= 20;
    } else if (totalLiabilities === 0) {
      score += 10;
    }

    budgets.forEach((b) => {
      try {
        const metrics = CalculationEngine.calculateBudget(b, transactions);
        if (metrics.spent > b.limit) {
          score -= 10;
        }
      } catch (e) {
        console.error("[CalculationEngine] Error calculating budget:", b.id, e);
      }
    });

    goals.forEach((g) => {
      const pct = g.target ? (g.saved / g.target) * 100 : 0;
      if (pct >= 100) score += 5;
      else if (pct >= 50) score += 3;
    });

    bills.forEach((b) => {
      if (b.status === "missed") score -= 15;
      else if (b.status === "overdue") score -= 5;
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

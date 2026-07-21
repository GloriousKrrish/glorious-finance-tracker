import type { State } from "./types";
import { FilterEngine, type ReportFilters } from "./filters";
import { SelectorEngine } from "./selectors";
import { MetricsRegistry } from "./metrics";
import { formatINR } from "../format";

export interface ReportSection {
  title: string;
  headers: string[];
  rows: any[][];
}

export interface ReportPayload {
  title: string;
  subtitle: string;
  dateRange: { from: string; to: string };
  metrics: Record<string, any>;
  sections: ReportSection[];
  charts: {
    name: string;
    type: "line" | "area" | "bar" | "pie";
    data: any[];
  }[];
}

export class ReportEngine {
  public static generateReport(
    state: State,
    type:
      | "income"
      | "expense"
      | "cash_flow"
      | "net_worth"
      | "budget"
      | "goal"
      | "loan"
      | "investment"
      | "bills_subscriptions"
      | "tax_ready",
    filters: ReportFilters
  ): ReportPayload {
    // 1. Apply Filter Engine to state
    const filteredState = FilterEngine.filterState(state, filters);
    const txns = filteredState.transactions ?? [];
    
    // Resolve date range labels
    const fromDate = filters.dateRange?.from || (txns.length > 0 ? txns[txns.length - 1].date : new Date().toISOString().slice(0, 10));
    const toDate = filters.dateRange?.to || new Date().toISOString().slice(0, 10);
    const dateRange = { from: fromDate, to: toDate };

    switch (type) {
      case "income":
        return this.compileIncomeReport(filteredState, dateRange);
      case "expense":
        return this.compileExpenseReport(filteredState, dateRange);
      case "cash_flow":
        return this.compileCashFlowReport(filteredState, dateRange);
      case "net_worth":
        return this.compileNetWorthReport(filteredState, dateRange);
      case "budget":
        return this.compileBudgetReport(filteredState, dateRange);
      case "goal":
        return this.compileGoalReport(filteredState, dateRange);
      case "loan":
        return this.compileLoanReport(filteredState, dateRange);
      case "investment":
        return this.compileInvestmentReport(filteredState, dateRange);
      case "bills_subscriptions":
        return this.compileBillsReport(filteredState, dateRange);
      case "tax_ready":
        return this.compileTaxReport(filteredState, dateRange);
      default:
        throw new Error(`Report type not supported: ${type}`);
    }
  }

  private static compileIncomeReport(state: State, dateRange: { from: string; to: string }): ReportPayload {
    const txns = state.transactions ?? [];
    const incomeTxns = txns.filter((t) => t.kind === "income");
    const totalIncome = incomeTxns.reduce((sum, t) => sum + (t.amount ?? 0), 0);

    // Group by category
    const catMap = new Map<string, number>();
    incomeTxns.forEach((t) => catMap.set(t.category, (catMap.get(t.category) || 0) + (t.amount ?? 0)));

    const catRows = Array.from(catMap.entries()).map(([cat, val]) => [
      cat,
      formatINR(val),
      totalIncome > 0 ? `${((val / totalIncome) * 100).toFixed(1)}%` : "0%",
    ]);

    const ledgerRows = incomeTxns.map((t) => [
      t.date,
      t.category,
      t.merchant || "—",
      formatINR(t.amount),
    ]);

    return {
      title: "Income Distribution Statement",
      subtitle: "Detailed summary of all earned revenue and returns.",
      dateRange,
      metrics: {
        "Total Earned Income": formatINR(totalIncome),
        "Income Channels": catMap.size,
        "Total Transactions": incomeTxns.length,
      },
      sections: [
        { title: "Breakdown by Revenue Channel", headers: ["Category", "Amount", "Mix %"], rows: catRows },
        { title: "Ledger Entries", headers: ["Date", "Category", "Payer / Source", "Amount"], rows: ledgerRows },
      ],
      charts: [
        {
          name: "Income Channels Mix",
          type: "pie",
          data: Array.from(catMap.entries()).map(([name, value]) => ({ name, value })),
        },
      ],
    };
  }

  private static compileExpenseReport(state: State, dateRange: { from: string; to: string }): ReportPayload {
    const txns = state.transactions ?? [];
    const expenseTxns = txns.filter((t) => t.kind === "expense");
    const totalExpense = expenseTxns.reduce((sum, t) => sum + (t.amount ?? 0), 0);

    const catMap = new Map<string, number>();
    expenseTxns.forEach((t) => catMap.set(t.category, (catMap.get(t.category) || 0) + (t.amount ?? 0)));

    const catRows = Array.from(catMap.entries()).map(([cat, val]) => [
      cat,
      formatINR(val),
      totalExpense > 0 ? `${((val / totalExpense) * 100).toFixed(1)}%` : "0%",
    ]);

    const ledgerRows = expenseTxns.map((t) => [
      t.date,
      t.category,
      t.merchant || "—",
      formatINR(t.amount),
    ]);

    return {
      title: "Expense Distribution Statement",
      subtitle: "Detailed summary of all discretionary and fixed expense distributions.",
      dateRange,
      metrics: {
        "Total Expenses": formatINR(totalExpense),
        "Expense Categories": catMap.size,
        "Total Transactions": expenseTxns.length,
      },
      sections: [
        { title: "Breakdown by Category", headers: ["Category", "Amount", "Mix %"], rows: catRows },
        { title: "Ledger Entries", headers: ["Date", "Category", "Merchant", "Amount"], rows: ledgerRows },
      ],
      charts: [
        {
          name: "Expense Mix",
          type: "pie",
          data: Array.from(catMap.entries()).map(([name, value]) => ({ name, value })),
        },
      ],
    };
  }

  private static compileCashFlowReport(state: State, dateRange: { from: string; to: string }): ReportPayload {
    const txns = state.transactions ?? [];
    const income = txns.filter((t) => t.kind === "income").reduce((sum, t) => sum + (t.amount ?? 0), 0);
    const expense = txns.filter((t) => t.kind === "expense").reduce((sum, t) => sum + (t.amount ?? 0), 0);
    const netCashFlow = income - expense;
    const savingsRate = income > 0 ? (netCashFlow / income) * 100 : 0;

    // Monthly trends
    const trends = SelectorEngine.getMonthlyTrends(state);

    return {
      title: "Cash Flow & Savings Statement",
      subtitle: "Comparative evaluation of monthly earnings against outflows.",
      dateRange,
      metrics: {
        "Total Income": formatINR(income),
        "Total Expenses": formatINR(expense),
        "Net Cash Flow": formatINR(netCashFlow),
        "Savings Rate": `${savingsRate.toFixed(1)}%`,
      },
      sections: [
        {
          title: "Cash Flow Summary",
          headers: ["Activity Type", "Amount"],
          rows: [
            ["Operating Income", formatINR(income)],
            ["Operating Expenses", formatINR(expense)],
            ["Net Surplus / Deficit", formatINR(netCashFlow)],
          ],
        },
      ],
      charts: [
        {
          name: "Cash Flow Trend",
          type: "area",
          data: trends,
        },
      ],
    };
  }

  private static compileNetWorthReport(state: State, dateRange: { from: string; to: string }): ReportPayload {
    const nw = MetricsRegistry.getMetric(state, "net_worth");
    const assets = MetricsRegistry.getMetric(state, "total_assets");
    const liabilities = MetricsRegistry.getMetric(state, "total_liabilities");

    const assetRows = (state.accounts ?? [])
      .filter((a) => a.type !== "credit_card")
      .map((a) => [a.name, a.institution || "Local Wallet", formatINR(a.balance)]);

    const liabilityRows = (state.accounts ?? [])
      .filter((a) => a.type === "credit_card")
      .map((a) => [a.name, a.institution || "Credit Line", formatINR(a.balance)])
      .concat(
        (state.loans ?? []).map((l) => [
          l.name,
          l.type,
          formatINR(l.outstanding),
        ])
      );

    return {
      title: "Statement of Wealth (Net Worth)",
      subtitle: "Comprehensive snapshot of all balance sheets, holdings, and liabilities.",
      dateRange,
      metrics: {
        "Net Worth": formatINR(nw),
        "Total Assets": formatINR(assets),
        "Total Liabilities": formatINR(liabilities),
      },
      sections: [
        { title: "Asset Holdings", headers: ["Asset Name", "Institution", "Value"], rows: assetRows },
        { title: "Liabilities & Loans", headers: ["Liability Name", "Creditor", "Outstanding"], rows: liabilityRows },
      ],
      charts: [
        {
          name: "Wealth Distribution",
          type: "bar",
          data: [
            { name: "Assets", value: assets },
            { name: "Liabilities", value: liabilities },
          ],
        },
      ],
    };
  }

  private static compileBudgetReport(state: State, dateRange: { from: string; to: string }): ReportPayload {
    const budgets = state.budgets ?? [];
    const txns = state.transactions ?? [];

    const rows = budgets.map((b) => {
      const metrics = SelectorEngine.getBudgetMetrics(state, b);
      const remaining = b.limit - metrics.spent;
      const utilization = b.limit > 0 ? (metrics.spent / b.limit) * 100 : 0;
      return [
        b.category,
        formatINR(b.limit),
        formatINR(metrics.spent),
        formatINR(remaining),
        `${utilization.toFixed(0)}%`,
        remaining < 0 ? "Overspent" : "On Track",
      ];
    });

    return {
      title: "Budget Performance Review",
      subtitle: "Analysis of category budget utilization and variance.",
      dateRange,
      metrics: {
        "Total Budgets": budgets.length,
        "Overspent Categories": budgets.filter(
          (b) => SelectorEngine.getBudgetMetrics(state, b).spent > b.limit
        ).length,
      },
      sections: [
        {
          title: "Budget Performance Ledger",
          headers: ["Category", "Limit", "Spent", "Remaining", "Utilization", "Status"],
          rows,
        },
      ],
      charts: [
        {
          name: "Budget vs Spent",
          type: "bar",
          data: budgets.map((b) => {
            const metrics = SelectorEngine.getBudgetMetrics(state, b);
            return { name: b.category, limit: b.limit, spent: metrics.spent };
          }),
        },
      ],
    };
  }

  private static compileGoalReport(state: State, dateRange: { from: string; to: string }): ReportPayload {
    const goals = SelectorEngine.getGoals(state);

    const rows = goals.map((g) => {
      const remaining = g.target - g.saved;
      const progress = g.metrics.progress;
      return [
        g.name,
        formatINR(g.target),
        formatINR(g.saved),
        formatINR(remaining),
        `${progress.toFixed(0)}%`,
        g.metrics.goalHealth,
      ];
    });

    return {
      title: "Savings Goals Progress Report",
      subtitle: "Consolidated audit of long-term and short-term capital accumulation targets.",
      dateRange,
      metrics: {
        "Total Goals": goals.length,
        "Completed Goals": goals.filter((g) => g.metrics.isCompleted).length,
      },
      sections: [
        {
          title: "Financial Goal Ledger",
          headers: ["Goal Name", "Target Amount", "Saved Balance", "Funding Gap", "Progress", "Health"],
          rows,
        },
      ],
      charts: [
        {
          name: "Goal Progress Mix",
          type: "bar",
          data: goals.map((g) => ({ name: g.name, target: g.target, saved: g.saved })),
        },
      ],
    };
  }

  private static compileLoanReport(state: State, dateRange: { from: string; to: string }): ReportPayload {
    const loans = state.loans ?? [];
    const txns = state.transactions ?? [];

    const rows = loans.map((l) => {
      const metrics = SelectorEngine.getLoanMetrics(state, l);
      return [
        l.name,
        l.type,
        formatINR(l.principal),
        `${l.rate}%`,
        formatINR(l.emi),
        formatINR(metrics.outstandingBalance),
        `${metrics.repaymentProgress.toFixed(0)}%`,
      ];
    });

    return {
      title: "Amortization & Debt Ledger Report",
      subtitle: "Full audit of liabilities, interest burdens, and EMI obligations.",
      dateRange,
      metrics: {
        "Total Debt Outstanding": formatINR(SelectorEngine.getLoansOutstandingSummary(state)),
        "Active Loans": SelectorEngine.getActiveLoans(state).length,
        "Total Monthly EMI": formatINR(loans.reduce((sum, l) => sum + (l.emi ?? 0), 0)),
      },
      sections: [
        {
          title: "Loan Portfolio Summary",
          headers: ["Loan Name", "Lender", "Principal", "Interest Rate", "EMI", "Outstanding Balance", "Repaid %"],
          rows,
        },
      ],
      charts: [
        {
          name: "Debt Allocations",
          type: "bar",
          data: loans.map((l) => {
            const metrics = SelectorEngine.getLoanMetrics(state, l);
            return { name: l.name, outstanding: metrics.outstandingBalance };
          }),
        },
      ],
    };
  }

  private static compileInvestmentReport(state: State, dateRange: { from: string; to: string }): ReportPayload {
    const investments = SelectorEngine.getInvestmentDetailed(state);
    const summary = SelectorEngine.getPortfolioSummary(state);

    const rows = investments.map((i: any) => [
      i.name,
      i.assetClass,
      formatINR(i.invested),
      formatINR(i.current),
      formatINR(i.unrealizedPl),
      `${i.returnPercentage.toFixed(1)}%`,
    ]);

    return {
      title: "Wealth Portfolio Investment Statement",
      subtitle: "Asset allocation, returns, and valuation updates.",
      dateRange,
      metrics: {
        "Total Portfolio Value": formatINR(summary.portfolioValue),
        "Unrealised Returns": formatINR(summary.unrealizedPl),
        "Net Return Rate": `${summary.returnPercentage.toFixed(1)}%`,
        "Diversification Score": `${summary.diversificationScore}/100`,
      },
      sections: [
        {
          title: "Investment Assets Ledger",
          headers: ["Investment", "Asset Class", "Invested Capital", "Current Valuation", "Gain / Loss", "ROI %"],
          rows,
        },
      ],
      charts: [
        {
          name: "Asset Allocations",
          type: "pie",
          data: SelectorEngine.getAssetAllocation(state),
        },
      ],
    };
  }

  private static compileBillsReport(state: State, dateRange: { from: string; to: string }): ReportPayload {
    const bills = state.bills ?? [];
    const summary = SelectorEngine.getFinancialObligationSummary(state);
    const subSummary = SelectorEngine.getSubscriptionSummary(state);

    const recurringRows = bills.map((b) => [
      b.name,
      b.dueDate || "Recurring",
      b.category,
      formatINR(b.amount),
      b.autoPayEnabled ? "Auto" : "Manual",
      b.status || (b.paid ? "paid" : "pending"),
    ]);

    return {
      title: "Obligations & Recurring Bills Report",
      subtitle: "Statement of recurring liabilities, bills, and active subscriptions.",
      dateRange,
      metrics: {
        "Monthly Bills & Subs": formatINR(summary.monthlyTotal),
        "Subscription Costs": formatINR(subSummary.monthlyCost),
        "Upcoming Obligation Count": summary.upcomingCount,
        "Overdue Obligations": summary.overdueCount,
      },
      sections: [
        {
          title: "Recurring Liabilities Ledger",
          headers: ["Obligation Name", "Due Date", "Category", "Amount", "Billing", "Status"],
          rows: recurringRows,
        },
      ],
      charts: [
        {
          name: "Subscriptions Mix",
          type: "pie",
          data: bills
            .filter((b) => b.category === "Streaming Subscription" || b.category === "Membership" || b.metadata?.isSubscription)
            .map((b) => ({ name: b.name, value: b.amount })),
        },
      ],
    };
  }

  private static compileTaxReport(state: State, dateRange: { from: string; to: string }): ReportPayload {
    const txns = state.transactions ?? [];
    const totalIncome = txns.filter((t) => t.kind === "income").reduce((sum, t) => sum + (t.amount ?? 0), 0);
    
    // Simple mock calculation: 10% tax bracket proxy
    const estWithholding = totalIncome * 0.1;
    const netAfterEstimate = totalIncome - estWithholding;

    return {
      title: "Tax Exposure Review (Architecture Ready)",
      subtitle: "Basic estimate of tax bracket thresholds based on gross operating income.",
      dateRange,
      metrics: {
        "Gross Revenue Recorded": formatINR(totalIncome),
        "Estimated Liability (10% Proxy)": formatINR(estWithholding),
        "Estimated Net Post-Tax": formatINR(netAfterEstimate),
      },
      sections: [
        {
          title: "Estimated Deductions & Bracket Calculations",
          headers: ["Bracket Model", "Gross Revenue", "Est. Rate", "Liability"],
          rows: [
            ["Standard Proxy Bracket", formatINR(totalIncome), "10.0%", formatINR(estWithholding)],
          ],
        },
      ],
      charts: [
        {
          name: "Pre vs Post Tax",
          type: "bar",
          data: [
            { name: "Gross", value: totalIncome },
            { name: "Est Tax", value: estWithholding },
            { name: "Net Est", value: netAfterEstimate },
          ],
        },
      ],
    };
  }
}

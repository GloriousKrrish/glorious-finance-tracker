import type { State, Transaction, Goal, Loan, Budget } from "./types";
import { MetricsRegistry, type MetricType } from "./metrics";
import { SelectorEngine } from "./selectors";
import { ForecastEngine } from "./forecast";
import { FinancialHealthEngine } from "./health";
import { CalculationEngine } from "./calculations";
import { formatINR } from "../format";

// --- TYPES ---

export interface DeterministicInsight {
  id: string;
  type: "success" | "warning" | "info" | "danger";
  category: "cash_flow" | "budget" | "emergency" | "debt" | "portfolio" | "general";
  title: string;
  message: string;
}

export interface Recommendation {
  id: string;
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  action: string;
  impact: string;
  referenceMetric?: string;
}

export interface FinancialRisk {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  remedy: string;
}

export interface FinancialOpportunity {
  id: string;
  title: string;
  description: string;
  benefit: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface ScenarioInput {
  salaryIncreasePercent?: number;
  expenseDecreasePercent?: number;
  purchaseVehicleAmount?: number;
  closeLoanId?: string;
  increaseSipAmount?: number;
  pauseInvestments?: boolean;
  medicalExpense?: number;
}

export interface ScenarioResult {
  currentMetrics: Record<string, any>;
  scenarioMetrics: Record<string, any>;
  difference: Record<string, number>;
  insights: string[];
}

export interface GoalPlan {
  goalId: string;
  name: string;
  target: number;
  saved: number;
  monthsRemaining: number;
  monthsToComplete: number;
  isPossible: boolean;
  recommendedMonthlySavings: number;
  fundingGap: number;
  prioritizedRank: number;
}

// --- CENTRAL INTEL MODULE ---

export class ContextEngine {
  /**
   * Aggregates all relevant financial metrics and predictions to provide clean, structured context for AI calls.
   * AI never reads raw transaction logs or state arrays, protecting security and optimizing token count.
   */
  public static buildAiContext(state: State): string {
    const netWorth = MetricsRegistry.getMetric(state, "net_worth");
    const assets = MetricsRegistry.getMetric(state, "total_assets");
    const liabilities = MetricsRegistry.getMetric(state, "total_liabilities");
    const cashFlow = MetricsRegistry.getMetric(state, "cash_flow");
    const income = MetricsRegistry.getMetric(state, "monthly_income");
    const expense = MetricsRegistry.getMetric(state, "monthly_expense");
    const savingsRate = MetricsRegistry.getMetric(state, "savings_rate");
    const emergencyFund = MetricsRegistry.getMetric(state, "emergency_fund_coverage");
    const healthScore = MetricsRegistry.getMetric(state, "financial_health_score");
    const wellnessGrade = MetricsRegistry.getMetric(state, "financial_wellness_grade");

    const activeGoals = SelectorEngine.getActiveGoals(state);
    const activeLoans = SelectorEngine.getActiveLoans(state);
    const budgetUtilization = MetricsRegistry.getMetric(state, "budget_utilization");

    // Gather insights, risks, and opportunities
    const insights = InsightEngine.getInsights(state);
    const risks = RiskEngine.getRisks(state);
    const opportunities = OpportunityEngine.getOpportunities(state);

    const context = {
      timestamp: new Date().toISOString(),
      key_metrics: {
        financial_health_score: `${healthScore}/100`,
        financial_wellness_grade: wellnessGrade,
        net_worth: formatINR(netWorth),
        total_assets: formatINR(assets),
        total_liabilities: formatINR(liabilities),
        monthly_income: formatINR(income),
        monthly_expense: formatINR(expense),
        monthly_cash_flow: formatINR(cashFlow),
        savings_rate: `${savingsRate.toFixed(1)}%`,
        emergency_fund_months: `${emergencyFund.toFixed(1)} months`,
        overall_budget_utilization: `${budgetUtilization.toFixed(0)}%`,
      },
      goals: activeGoals.map((g) => ({
        name: g.name,
        target: formatINR(g.target),
        saved: formatINR(g.saved),
        progress: `${g.metrics.progress.toFixed(0)}%`,
        health: g.metrics.goalHealth,
        deadline: g.deadline,
      })),
      loans: activeLoans.map((l) => ({
        name: l.name,
        outstanding: formatINR(l.outstanding),
        emi: formatINR(l.emi),
        interest_rate: `${l.rate}%`,
      })),
      active_insights: insights.map((i) => `[${i.type.toUpperCase()}] ${i.title}: ${i.message}`),
      detected_risks: risks.map((r) => `[${r.severity.toUpperCase()}] ${r.title}: ${r.description}`),
      identified_opportunities: opportunities.map((o) => `[${o.difficulty.toUpperCase()}] ${o.title}: ${o.description}`),
    };

    return JSON.stringify(context, null, 2);
  }

  /**
   * Builds an intent-sliced context payload containing only metrics relevant to the classified intent.
   * Prevents dumping full state logs while ensuring maximum precision and minimal token consumption.
   */
  public static buildIntentSlicedContext(state: State, intent: string): string {
    const netWorth = MetricsRegistry.getMetric(state, "net_worth");
    const income = MetricsRegistry.getMetric(state, "monthly_income");
    const expense = MetricsRegistry.getMetric(state, "monthly_expense");
    const cashFlow = MetricsRegistry.getMetric(state, "cash_flow");
    const savingsRate = MetricsRegistry.getMetric(state, "savings_rate");
    const healthScore = MetricsRegistry.getMetric(state, "financial_health_score");

    const baseHeader = {
      timestamp: new Date().toISOString(),
      user_type: state.profile?.userType ?? "personal",
      financial_health_score: `${healthScore}/100`,
      net_worth: formatINR(netWorth),
    };

    let slice: Record<string, any> = {};

    switch (intent) {
      case "Budget":
      case "Expense":
      case "Income":
      case "CashFlow":
      case "Savings": {
        const budgets = SelectorEngine.getBudgets(state);
        slice = {
          monthly_income: formatINR(income),
          monthly_expense: formatINR(expense),
          monthly_cash_flow: formatINR(cashFlow),
          savings_rate: `${savingsRate.toFixed(1)}%`,
          budget_utilization: `${MetricsRegistry.getMetric(state, "budget_utilization").toFixed(0)}%`,
          budget_categories: budgets.map((b) => ({
            category: b.category,
            limit: formatINR(b.limit),
            spent: formatINR(b.metrics.spent),
            utilization: `${b.metrics.utilization.toFixed(0)}%`,
            status: b.metrics.spent > b.limit ? "OVERSPENT" : "OK",
          })),
        };
        break;
      }

      case "Loan":
      case "Debt": {
        const activeLoans = SelectorEngine.getActiveLoans(state);
        slice = {
          total_liabilities: formatINR(MetricsRegistry.getMetric(state, "total_liabilities")),
          debt_to_asset_ratio: `${(MetricsRegistry.getMetric(state, "debt_ratio") * 100).toFixed(1)}%`,
          active_loans: activeLoans.map((l) => ({
            name: l.name,
            outstanding: formatINR(l.outstanding),
            emi: formatINR(l.emi),
            interest_rate: `${l.rate}%`,
            institution: l.institution,
          })),
        };
        break;
      }

      case "Investment":
      case "Portfolio":
      case "MutualFund":
      case "Stocks":
      case "Gold": {
        const portfolio = SelectorEngine.getPortfolioSummary(state);
        slice = {
          total_portfolio_value: formatINR(portfolio.portfolioValue),
          total_invested: formatINR(portfolio.portfolioInvested),
          unrealized_gain_loss: formatINR(portfolio.unrealizedPl),
          asset_allocation: [],
          holdings_summary: (state.investments ?? []).map((inv) => ({
            name: inv.name,
            asset_class: inv.assetClass,
            current_value: formatINR(inv.current ?? 0),
            invested_amount: formatINR(inv.invested ?? 0),
          })),
        };
        break;
      }

      case "Tax":
      case "GST": {
        const totalExp = SelectorEngine.getExpenseSummary(state);
        slice = {
          annualized_income: formatINR(income * 12),
          annualized_expense: formatINR(totalExp * 12),
          estimated_tax_deductions_available: {
            section_80c_limit: "₹1,50,000",
            section_80d_limit: "₹25,000",
            section_80ccd_1b_nps_limit: "₹50,000",
          },
        };
        break;
      }

      case "Goals":
      case "Retirement": {
        const activeGoals = SelectorEngine.getActiveGoals(state);
        slice = {
          emergency_fund_coverage: `${MetricsRegistry.getMetric(state, "emergency_fund_coverage").toFixed(1)} months`,
          goals: activeGoals.map((g) => ({
            name: g.name,
            target: formatINR(g.target),
            saved: formatINR(g.saved),
            progress: `${g.metrics.progress.toFixed(0)}%`,
            health: g.metrics.goalHealth,
          })),
        };
        break;
      }

      default: {
        slice = {
          monthly_income: formatINR(income),
          monthly_expense: formatINR(expense),
          monthly_cash_flow: formatINR(cashFlow),
          savings_rate: `${savingsRate.toFixed(1)}%`,
          active_loans_count: SelectorEngine.getActiveLoans(state).length,
          active_goals_count: SelectorEngine.getActiveGoals(state).length,
        };
      }
    }

    return JSON.stringify({ ...baseHeader, ...slice }, null, 2);
  }
}

export class InsightEngine {
  /**
   * Returns deterministic insights based on financial ratios.
   */
  public static getInsights(state: State): DeterministicInsight[] {
    const insights: DeterministicInsight[] = [];
    const nw = MetricsRegistry.getMetric(state, "net_worth");
    const cashFlow = MetricsRegistry.getMetric(state, "cash_flow");
    const savingsRate = MetricsRegistry.getMetric(state, "savings_rate");
    const emFund = MetricsRegistry.getMetric(state, "emergency_fund_coverage");
    const budgets = state.budgets ?? [];

    // 1. Net worth milestone
    if (nw > 1000000) {
      insights.push({
        id: "nw_millionaire",
        type: "success",
        category: "general",
        title: "Net Worth Milestone",
        message: `Congratulations! Your net worth of ${formatINR(nw)} exceeds ₹10 Lakhs.`,
      });
    } else if (nw > 0) {
      insights.push({
        id: "nw_positive",
        type: "info",
        category: "general",
        title: "Positive Net Worth",
        message: `Your net worth is positive at ${formatINR(nw)}.`,
      });
    }

    // 2. Cash Flow
    if (cashFlow < 0) {
      insights.push({
        id: "cash_flow_neg",
        type: "danger",
        category: "cash_flow",
        title: "Deficit Spending",
        message: `Your monthly expenses exceed income by ${formatINR(Math.abs(cashFlow))}.`,
      });
    } else if (savingsRate >= 30) {
      insights.push({
        id: "savings_rate_high",
        type: "success",
        category: "cash_flow",
        title: "Excellent Savings Margin",
        message: `You are saving ${savingsRate.toFixed(0)}% of your income, well above the recommended 20%.`,
      });
    }

    // 3. Emergency Fund
    if (emFund < 3) {
      insights.push({
        id: "em_fund_low",
        type: "warning",
        category: "emergency",
        title: "Low Reserves",
        message: `Your emergency reserve covers only ${emFund.toFixed(1)} months of expenses. Aim for 3-6 months.`,
      });
    }

    // 4. Budgets overruns
    budgets.forEach((b) => {
      const spent = SelectorEngine.getBudgetMetrics(state, b).spent;
      if (spent > b.limit) {
        insights.push({
          id: `budget_over_${b.id}`,
          type: "danger",
          category: "budget",
          title: "Budget Exceeded",
          message: `Category "${b.category}" exceeded limit by ${formatINR(spent - b.limit)}.`,
        });
      }
    });

    return insights;
  }
}

export class RecommendationEngine {
  /**
   * Recommends adjustments based on metrics and forecast timelines.
   */
  public static getRecommendations(state: State): Recommendation[] {
    const recs: Recommendation[] = [];
    const emFund = MetricsRegistry.getMetric(state, "emergency_fund_coverage");
    const dti = MetricsRegistry.getMetric(state, "debt_to_income");
    const savingsRate = MetricsRegistry.getMetric(state, "savings_rate");
    const subCost = MetricsRegistry.getMetric(state, "subscription_cost");
    const activeLoans = SelectorEngine.getActiveLoans(state);

    if (emFund < 3) {
      recs.push({
        id: "rec_em_fund",
        priority: "high",
        title: "Fortify Emergency Buffer",
        action: "Allocate a portion of your monthly savings to cash reserves until 3 months of coverage is reached.",
        impact: "Reduces risk of debt during sudden job loss or medical crises.",
        referenceMetric: `Emergency Reserve: ${emFund.toFixed(1)} Months`,
      });
    }

    if (dti > 40) {
      recs.push({
        id: "rec_dti_high",
        priority: "critical",
        title: "Debt Consolidation",
        action: "Pause discretionary spending and pay down high-interest loans first using the debt avalanche model.",
        impact: "Lowers monthly interest leakage and improves borrowability score.",
        referenceMetric: `Debt-to-Income: ${dti.toFixed(1)}%`,
      });
    }

    if (savingsRate < 15) {
      recs.push({
        id: "rec_savings_rate",
        priority: "medium",
        title: "Review Discretionary Spending",
        action: "Perform a subscription sweep and cap eating out/entertainment to increase savings rate to 20%.",
        impact: "Unlocks more capital for investment and retirement goals.",
        referenceMetric: `Savings Rate: ${savingsRate.toFixed(1)}%`,
      });
    }

    if (subCost > 5000) {
      recs.push({
        id: "rec_subscription",
        priority: "low",
        title: "Audit Active Subscriptions",
        action: "Audit unused memberships or recurring apps to reclaim idle cash.",
        impact: "Instantly improves cash flow without lifestyle sacrifices.",
        referenceMetric: `Subscription Costs: ${formatINR(subCost)}/mo`,
      });
    }

    // Debt prepayment recommendation
    if (activeLoans.length > 0 && savingsRate > 25) {
      const highestRateLoan = [...activeLoans].sort((a, b) => b.rate - a.rate)[0];
      recs.push({
        id: "rec_prepay_loan",
        priority: "medium",
        title: `Prepay Loan: ${highestRateLoan.name}`,
        action: `Use surplus cash to make principal prepayments on your highest interest loan (${highestRateLoan.rate}%).`,
        impact: "Compounding interest savings on outstanding principal.",
        referenceMetric: `Outstanding: ${formatINR(highestRateLoan.outstanding)}`,
      });
    }

    return recs;
  }
}

export class RiskEngine {
  /**
   * Audits health and lists potential risks with critical indicators.
   */
  public static getRisks(state: State): FinancialRisk[] {
    const risks: FinancialRisk[] = [];
    const cashFlow = MetricsRegistry.getMetric(state, "cash_flow");
    const dti = MetricsRegistry.getMetric(state, "debt_to_income");
    const emFund = MetricsRegistry.getMetric(state, "emergency_fund_coverage");
    const bills = state.bills ?? [];

    if (cashFlow < 0) {
      risks.push({
        id: "risk_neg_cashflow",
        severity: "critical",
        title: "Cash Burn Status",
        description: "You are spending more than you earn, which leads to capital depletion or credit reliance.",
        remedy: "Cut all discretionary budgets immediately by 30% and audit bank drafts.",
      });
    }

    if (dti > 45) {
      risks.push({
        id: "risk_high_dti",
        severity: "high",
        title: "Extreme Debt Burden",
        description: "Over 45% of your gross monthly income is committed to servicing debt (EMIs).",
        remedy: "Refinance high-interest loans, extend tenure if needed, or sell non-performing assets to prepay.",
      });
    }

    if (emFund < 1.5) {
      risks.push({
        id: "risk_low_liquidity",
        severity: "high",
        title: "Critical Liquidity Shortage",
        description: "You have less than 1.5 months of survival expenses in liquid assets.",
        remedy: "Transfer ₹5000/mo to a separate liquid mutual fund or savings vault.",
      });
    }

    const overdueCount = bills.filter((b) => b.status === "overdue").length;
    if (overdueCount > 0) {
      risks.push({
        id: "risk_overdue_bills",
        severity: "critical",
        title: "Overdue Financial Obligations",
        description: `You have ${overdueCount} overdue bills which could damage your credit score (CIBIL).`,
        remedy: "Pay these bills immediately or set up automatic sweep autopayments.",
      });
    }

    return risks;
  }
}

export class OpportunityEngine {
  /**
   * Highlights wealth acceleration opportunities.
   */
  public static getOpportunities(state: State): FinancialOpportunity[] {
    const opportunities: FinancialOpportunity[] = [];
    const savingsRate = MetricsRegistry.getMetric(state, "savings_rate");
    const emFund = MetricsRegistry.getMetric(state, "emergency_fund_coverage");
    const loans = state.loans ?? [];

    if (savingsRate > 30) {
      opportunities.push({
        id: "opp_invest_sip",
        title: "Unutilized Investment Capacity",
        description: "You possess high surplus savings which could be put to work in systematic equity/mutual fund plans.",
        benefit: "Accelerates compound wealth growth and matches long-term goals faster.",
        difficulty: "easy",
      });
    }

    if (emFund > 8) {
      opportunities.push({
        id: "opp_cash_drag",
        title: "Emergency Cash Drag",
        description: "You hold more than 8 months of expenses in low-yield cash. This is losing purchasing power to inflation.",
        benefit: "Moving excess cash to short-term corporate bonds or mutual funds increases return yield.",
        difficulty: "medium",
      });
    }

    if (loans.some((l) => l.rate > 12)) {
      opportunities.push({
        id: "opp_refinance",
        title: "Loan Interest Refinance",
        description: "One or more of your loans has interest rates exceeding 12%. Check if you qualify for bank balance transfers.",
        benefit: "Reduces monthly EMI and overall principal cost.",
        difficulty: "hard",
      });
    }

    return opportunities;
  }
}

export class ScenarioEngine {
  /**
   * Simulates financial adjustments on a copy of the state.
   * NEVER alters live state.
   */
  public static simulate(state: State, input: ScenarioInput): ScenarioResult {
    // 1. Deep clone state
    const simulated: State = JSON.parse(JSON.stringify(state));

    const currentMetrics = {
      netWorth: MetricsRegistry.getMetric(state, "net_worth"),
      cashFlow: MetricsRegistry.getMetric(state, "cash_flow"),
      savingsRate: MetricsRegistry.getMetric(state, "savings_rate"),
      healthScore: MetricsRegistry.getMetric(state, "financial_health_score"),
    };

    const simulatedInsights: string[] = [];

    // 2. Apply Scenario adjustments
    if (input.salaryIncreasePercent && input.salaryIncreasePercent > 0) {
      const multiplier = 1 + input.salaryIncreasePercent / 100;
      // Find all income transactions and inflate them
      simulated.transactions = (simulated.transactions ?? []).map((t) => {
        if (t.kind === "income") {
          return { ...t, amount: t.amount * multiplier };
        }
        return t;
      });
      simulatedInsights.push(`Systematic salary increase of ${input.salaryIncreasePercent}% applied to income streams.`);
    }

    if (input.expenseDecreasePercent && input.expenseDecreasePercent > 0) {
      const multiplier = 1 - input.expenseDecreasePercent / 100;
      simulated.transactions = (simulated.transactions ?? []).map((t) => {
        if (t.kind === "expense") {
          return { ...t, amount: t.amount * multiplier };
        }
        return t;
      });
      simulatedInsights.push(`Discretionary spending trimmed by ${input.expenseDecreasePercent}%.`);
    }

    if (input.purchaseVehicleAmount && input.purchaseVehicleAmount > 0) {
      // Vehicle adds a temporary liability of 80% value and subtracts 20% down payment from accounts
      const downPayment = input.purchaseVehicleAmount * 0.2;
      const loanAmount = input.purchaseVehicleAmount * 0.8;

      if (simulated.accounts && simulated.accounts.length > 0) {
        simulated.accounts[0].balance = Math.max(0, (simulated.accounts[0].balance ?? 0) - downPayment);
      }

      simulated.loans = [
        ...(simulated.loans ?? []),
        {
          id: "sim_loan_vehicle",
          name: "Simulated Vehicle Loan",
          type: "car",
          principal: loanAmount,
          outstanding: loanAmount,
          rate: 9, // typical rate
          emi: (loanAmount * 0.02), // simple EMI approximation
          tenureMonths: 60,
          startDate: new Date().toISOString().slice(0, 10),
        },
      ];
      simulatedInsights.push(`Vehicle purchase simulated: Downpayment of ${formatINR(downPayment)} paid, loan of ${formatINR(loanAmount)} added.`);
    }

    if (input.closeLoanId) {
      const loanIndex = (simulated.loans ?? []).findIndex((l) => l.id === input.closeLoanId);
      if (loanIndex !== -1) {
        const payoffAmount = simulated.loans[loanIndex].outstanding;
        // Deduct payoff amount from bank account balance
        if (simulated.accounts && simulated.accounts.length > 0) {
          simulated.accounts[0].balance = Math.max(0, (simulated.accounts[0].balance ?? 0) - payoffAmount);
        }
        // Remove loan
        simulated.loans.splice(loanIndex, 1);
        simulatedInsights.push(`Loan payoff simulated: Settled loan debt. Account balance reduced.`);
      }
    }

    if (input.increaseSipAmount && input.increaseSipAmount > 0) {
      // Adds a recurring expense transaction
      simulated.transactions = [
        ...(simulated.transactions ?? []),
        {
          id: "sim_sip_txn",
          accountId: "sim-account",
          amount: input.increaseSipAmount,
          kind: "expense",
          category: "Investment Outflow",
          date: new Date().toISOString().slice(0, 10),
          status: "cleared",
        },
      ];
      simulatedInsights.push(`SIP contributions boosted by ${formatINR(input.increaseSipAmount)}/mo.`);
    }

    if (input.pauseInvestments) {
      // Zero out investment values
      simulated.investments = [];
      simulatedInsights.push(`Asset liquidations simulated: paused investment contributions.`);
    }

    if (input.medicalExpense && input.medicalExpense > 0) {
      if (simulated.accounts && simulated.accounts.length > 0) {
        simulated.accounts[0].balance = Math.max(0, (simulated.accounts[0].balance ?? 0) - input.medicalExpense);
      }
      simulatedInsights.push(`Emergency healthcare expense of ${formatINR(input.medicalExpense)} paid from cash accounts.`);
    }

    const scenarioMetrics = {
      netWorth: MetricsRegistry.getMetric(simulated, "net_worth"),
      cashFlow: MetricsRegistry.getMetric(simulated, "cash_flow"),
      savingsRate: MetricsRegistry.getMetric(simulated, "savings_rate"),
      healthScore: MetricsRegistry.getMetric(simulated, "financial_health_score"),
    };

    const difference = {
      netWorth: scenarioMetrics.netWorth - currentMetrics.netWorth,
      cashFlow: scenarioMetrics.cashFlow - currentMetrics.cashFlow,
      savingsRate: scenarioMetrics.savingsRate - currentMetrics.savingsRate,
      healthScore: scenarioMetrics.healthScore - currentMetrics.healthScore,
    };

    return {
      currentMetrics,
      scenarioMetrics,
      difference,
      insights: simulatedInsights,
    };
  }
}

export class GoalPlanner {
  /**
   * Plans goals contribution paths and detects conflict schedules.
   */
  public static planGoals(state: State): GoalPlan[] {
    const goals = SelectorEngine.getGoals(state);
    const db = CalculationEngine.calculateDashboard(state);
    const surplus = db.monthlyIncome - db.monthlyExpense;

    return goals.map((g, idx) => {
      const forecast = ForecastEngine.forecastGoal(state, g.id);
      const fundingGap = g.target - g.saved;

      return {
        goalId: g.id,
        name: g.name,
        target: g.target,
        saved: g.saved,
        monthsRemaining: forecast.monthsToComplete,
        monthsToComplete: forecast.monthsToComplete,
        isPossible: forecast.isPossible,
        recommendedMonthlySavings: Math.round(forecast.requiredMonthlySavings),
        fundingGap: Math.max(0, fundingGap),
        prioritizedRank: idx + 1,
      };
    });
  }
}

export class FinancialCoach {
  /**
   * Generates simple explanations of financial topics grounded in user values.
   */
  public static getExplanation(topic: string, state: State): string {
    const dti = MetricsRegistry.getMetric(state, "debt_to_income");
    const emFund = MetricsRegistry.getMetric(state, "emergency_fund_coverage");
    const health = MetricsRegistry.getMetric(state, "financial_health_score");
    const grade = MetricsRegistry.getMetric(state, "financial_wellness_grade");

    switch (topic.toLowerCase()) {
      case "debt_ratio":
        return `Your current Debt-to-Income (DTI) ratio is ${dti.toFixed(1)}%. This means you spend ${dti.toFixed(1)}% of your gross monthly cash inflow servicing debts. A DTI below 35% is considered healthy, while ratios above 45% represent high debt burdens.`;
      case "emergency_fund":
        return `Your Emergency Fund currently covers ${emFund.toFixed(1)} months of average outflows. Standard planning recommends maintaining a buffer of 3 to 6 months of expenses in a liquid account to protect against unexpected life events.`;
      case "health_score":
        return `Your overall Financial Health Score is ${health}/100 (Grade: ${grade}). This composite index evaluates your liquidity, savings margin, budget utilization, debt leverage, and investment diversification metrics.`;
      default:
        return "Select a core financial metric to read a grounded explanation relative to your personal finances.";
    }
  }
}

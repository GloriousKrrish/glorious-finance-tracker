import type { State } from "../store";
import { SelectorEngine } from "../financial-engine";

export interface CopilotRecommendation {
  id: string;
  category: "budget" | "debt" | "tax" | "investment" | "emergency";
  priority: "high" | "medium" | "low";
  title: string;
  actionableStep: string;
  groundedMetric: string;
}

export class RecommendationEngine {
  public static generateRecommendations(state: State): CopilotRecommendation[] {
    const recs: CopilotRecommendation[] = [];

    // 1. Check Emergency Fund / Liquidity
    const dashboard = SelectorEngine.getDashboard(state);
    const monthlyExpenses = SelectorEngine.getExpenseSummary(state);
    const recommendedEmergency = monthlyExpenses * 6;

    if (dashboard.liquidBalance < recommendedEmergency && monthlyExpenses > 0) {
      const gap = recommendedEmergency - dashboard.liquidBalance;
      recs.push({
        id: "rec_emergency",
        category: "emergency",
        priority: "high",
        title: "Build Emergency Reserve",
        actionableStep: `Target setting aside ₹${gap.toLocaleString("en-IN")} into a high-liquidity sweep-in FD or Savings account to cover 6 months of expenses.`,
        groundedMetric: `Current Liquid Balance: ₹${dashboard.liquidBalance.toLocaleString("en-IN")} vs Target: ₹${recommendedEmergency.toLocaleString("en-IN")}`
      });
    }

    // 2. Check Overbudget Categories
    const budgets = SelectorEngine.getBudgets(state);
    const overspentBudgets = budgets.filter(b => b.metrics.spent > b.limit);
    if (overspentBudgets.length > 0) {
      const firstOver = overspentBudgets[0];
      recs.push({
        id: `rec_budget_${firstOver.id}`,
        category: "budget",
        priority: "high",
        title: `Realign ${firstOver.category} Budget`,
        actionableStep: `Pause discretionary expenses in ${firstOver.category} until the next billing cycle.`,
        groundedMetric: `${firstOver.category} spent ₹${firstOver.metrics.spent.toLocaleString("en-IN")} against limit ₹${firstOver.limit.toLocaleString("en-IN")}`
      });
    }

    // 3. Check High-Interest Loans
    const activeLoans = SelectorEngine.getActiveLoans(state);
    const highInterestLoans = activeLoans.filter(l => l.rate >= 10);
    if (highInterestLoans.length > 0) {
      const loan = highInterestLoans[0];
      recs.push({
        id: `rec_loan_${loan.id}`,
        category: "debt",
        priority: "high",
        title: `Prepay High-Interest ${loan.name}`,
        actionableStep: `Consider prepaying ₹5,000 extra monthly to significantly compress loan tenure and interest outgo.`,
        groundedMetric: `Current Rate: ${loan.rate}% p.a. • Outstanding: ₹${loan.outstanding.toLocaleString("en-IN")}`
      });
    }

    // 4. Investment SIP Check
    const portfolio = SelectorEngine.getPortfolioAnalysis(state);
    if (portfolio.portfolioValue > 0) {
      recs.push({
        id: "rec_sip_rebalance",
        category: "investment",
        priority: "medium",
        title: "Maintain Disciplined Equity SIPs",
        actionableStep: "Keep monthly automated SIPs running across diversified broad-market index or flexi-cap funds.",
        groundedMetric: `Current Investment Portfolio: ₹${portfolio.portfolioValue.toLocaleString("en-IN")} across ${state.investments?.length ?? 0} holdings`
      });
    }

    return recs;
  }
}

import type { State } from "../store";
import { DomainGuard, type DomainGuardCheck } from "./domain-guard";
import { IntentEngine, type FinanceIntent } from "./intent-engine";
import { FinanceKnowledgeBase, type KnowledgeArticle } from "./knowledge-base";
import { CacheEngine } from "./cache-engine";
import { AICostOptimizer } from "./cost-optimizer";
import { FinancialCoaches, type CoachType } from "./financial-coaches";
import { ResponseValidator } from "./response-validator";
import { CitationEngine, type CitationRef } from "./citation-engine";
import { ContextEngine, SelectorEngine, MetricsRegistry } from "../financial-engine";
import { callCopilotGemini } from "./copilot-server";
import { formatINR } from "../format";

export interface CopilotResponse {
  answerText: string;
  intent: FinanceIntent;
  domainCheck: DomainGuardCheck;
  source: "local_kb" | "local_cache" | "gemini_llm" | "local_fallback";
  tokensUsed: number;
  tokensSaved: number;
  citations: CitationRef[];
  kbArticle?: KnowledgeArticle;
}

export class RAGEngine {
  public static async processCopilotQuery(
    userMessage: string,
    state: State,
    coachType: CoachType = "wealth_coach"
  ): Promise<CopilotResponse> {
    const text = userMessage.trim();

    // ── Stage 1: Domain Guard ──────────────────────────────────────────
    const domainCheck = DomainGuard.checkDomain(text);
    if (!domainCheck.isFinanceRelated) {
      return {
        answerText: domainCheck.refusalMessage || "I specialize in finance and financial planning. I can't assist with unrelated topics.",
        intent: "NonFinance",
        domainCheck,
        source: "local_kb",
        tokensUsed: 0,
        tokensSaved: 1000,
        citations: []
      };
    }

    // ── Stage 2: Intent Classification ─────────────────────────────────
    const intent = IntentEngine.classifyIntent(text);

    // ── Stage 3: Local Knowledge Base (0 tokens) ───────────────────────
    const kbMatch = FinanceKnowledgeBase.searchKnowledgeBase(text);
    if (kbMatch) {
      AICostOptimizer.recordQueryEvent("kb_hit", 0, 1200);
      const answer = `### ${kbMatch.title}\n\n${kbMatch.details}\n\n*Summary:* ${kbMatch.summary}`;
      const validated = ResponseValidator.validateResponse(answer);
      const citations = CitationEngine.extractCitations(validated.sanitizedResponse, kbMatch.title);

      return {
        answerText: validated.sanitizedResponse,
        intent,
        domainCheck,
        source: "local_kb",
        tokensUsed: 0,
        tokensSaved: 1200,
        citations,
        kbArticle: kbMatch
      };
    }

    // ── Stage 4: Response Cache (0 tokens) ─────────────────────────────
    const cached = CacheEngine.getCachedResponse(text);
    if (cached) {
      AICostOptimizer.recordQueryEvent("cache_hit", 0, 1000);
      const validated = ResponseValidator.validateResponse(cached.response);
      const citations = CitationEngine.extractCitations(validated.sanitizedResponse);

      return {
        answerText: validated.sanitizedResponse,
        intent,
        domainCheck,
        source: "local_cache",
        tokensUsed: 0,
        tokensSaved: 1000,
        citations
      };
    }

    // ── Stage 5: Build system prompt with coach + Financial OS context ─
    const coach = FinancialCoaches.getCoach(coachType);
    const aiContext = ContextEngine.buildAiContext(state);

    const systemPrompt = `${coach.systemInstruction}

CRITICAL RULE: You MUST NEVER calculate Net Worth, Cash Flow, Savings Rate, Debt Ratios, or Forecasts yourself. These values are deterministically pre-calculated by the Financial Operating System and supplied in the context below. You are a presentation and advisory layer: your job is to explain these metrics, identify trends, answer questions, and offer friendly, concise, non-regulated coaching. Never invent or estimate numbers.

The user's classified intent is: ${intent}. Focus your response on this topic area using the relevant Financial OS data below.

FINANCIAL CONTEXT (JSON):
${aiContext}`;

    // ── Stage 6: Server-side Gemini API call ───────────────────────────
    let answerContent = "";
    let tokensUsed = 0;

    try {
      const geminiResult = await callCopilotGemini({
        data: { userMessage: text, systemPrompt }
      });

      if (geminiResult.content) {
        answerContent = geminiResult.content;
        tokensUsed = geminiResult.tokensUsed;
      } else if (geminiResult.error) {
        console.warn("[RAGEngine] Gemini unavailable:", geminiResult.error);
      }
    } catch (err) {
      console.error("[RAGEngine] Server function call error:", err);
    }

    // ── Stage 7: If Gemini succeeded, cache + return ───────────────────
    if (answerContent) {
      // Only cache actual Gemini responses — never cache fallbacks
      CacheEngine.setCachedResponse(text, answerContent, intent);
      AICostOptimizer.recordQueryEvent("api_call", tokensUsed, 0);

      const validated = ResponseValidator.validateResponse(answerContent);
      const citations = CitationEngine.extractCitations(validated.sanitizedResponse);

      return {
        answerText: validated.sanitizedResponse,
        intent,
        domainCheck,
        source: "gemini_llm",
        tokensUsed,
        tokensSaved: 0,
        citations
      };
    }

    // ── Stage 8: Intent-aware fallback (no Gemini available) ───────────
    // Instead of a single generic summary, produce a response
    // grounded in Financial OS data relevant to the user's intent.
    const fallbackAnswer = this.buildIntentAwareFallback(intent, text, state);

    // Do NOT cache fallback responses — they should be replaced
    // by a real Gemini response once the key becomes available.
    AICostOptimizer.recordQueryEvent("api_call", 0, 0);

    const validated = ResponseValidator.validateResponse(fallbackAnswer);
    const citations = CitationEngine.extractCitations(validated.sanitizedResponse);

    return {
      answerText: validated.sanitizedResponse,
      intent,
      domainCheck,
      source: "local_fallback",
      tokensUsed: 0,
      tokensSaved: 0,
      citations
    };
  }

  // ── Intent-Aware Fallback Generator ────────────────────────────────
  // Pulls relevant Financial OS data based on the classified intent,
  // so even without Gemini, the response is specific to the question.
  private static buildIntentAwareFallback(
    intent: FinanceIntent,
    userQuery: string,
    state: State
  ): string {
    const fmt = (n: number) => formatINR(n);

    try {
      switch (intent) {
        case "Budget": {
          const budgets = SelectorEngine.getBudgets(state);
          const util = MetricsRegistry.getMetric(state, "budget_utilization");
          const overspent = budgets.filter(b => b.metrics.spent > b.limit);
          const lines = budgets.slice(0, 5).map(
            b => `• **${b.category}:** ${fmt(b.metrics.spent)} spent of ${fmt(b.limit)} limit (${b.metrics.utilizationPercent.toFixed(0)}%)`
          );
          return `### Budget Overview\n\n**Overall Utilization:** ${util.toFixed(0)}%\n**Overspent Categories:** ${overspent.length}\n\n${lines.join("\n")}\n\n${overspent.length > 0 ? `⚠️ ${overspent.map(b => b.category).join(", ")} ${overspent.length === 1 ? "is" : "are"} over budget this period.` : "✅ All categories are within budget limits."}`;
        }

        case "Expense": {
          const totalExp = SelectorEngine.getExpenseSummary(state);
          const totalInc = SelectorEngine.getIncomeSummary(state);
          return `### Expense Summary\n\n• **Total Expenses:** ${fmt(totalExp)}\n• **Total Income:** ${fmt(totalInc)}\n• **Net Cash Flow:** ${fmt(totalInc - totalExp)}\n\nReview your Transactions page for a detailed category breakdown.`;
        }

        case "Income": {
          const income = SelectorEngine.getIncomeSummary(state);
          const savingsRate = MetricsRegistry.getMetric(state, "savings_rate");
          return `### Income Summary\n\n• **Monthly Income:** ${fmt(income)}\n• **Savings Rate:** ${savingsRate.toFixed(1)}%\n\nA healthy savings rate is typically 20% or above. Review the Reports page for income trends over time.`;
        }

        case "Loan":
        case "Debt": {
          const loans = SelectorEngine.getActiveLoans(state);
          if (loans.length === 0) return "### Loans & Debt\n\nYou have no active loans recorded in the Financial OS. If you have outstanding debts, add them in the Loans section for EMI tracking and prepayment analysis.";
          const lines = loans.map(
            l => `• **${l.name}:** Outstanding ${fmt(l.outstanding)} at ${l.rate}% p.a. • EMI ${fmt(l.emi)}`
          );
          return `### Active Loans\n\n${lines.join("\n")}\n\n**Total Outstanding:** ${fmt(loans.reduce((s, l) => s + l.outstanding, 0))}\n**Total Monthly EMI:** ${fmt(loans.reduce((s, l) => s + l.emi, 0))}`;
        }

        case "Investment":
        case "Portfolio":
        case "MutualFund":
        case "Stocks":
        case "Gold": {
          const portfolio = SelectorEngine.getPortfolioSummary(state);
          return `### Investment Portfolio\n\n• **Total Invested:** ${fmt(portfolio.totalInvested)}\n• **Current Value:** ${fmt(portfolio.totalCurrent)}\n• **Unrealized P&L:** ${fmt(portfolio.totalCurrent - portfolio.totalInvested)}\n• **Holdings:** ${state.investments.length} positions\n\nVisit the Investments page for detailed asset allocation and performance analysis.`;
        }

        case "Tax":
        case "GST": {
          return `### Tax & GST\n\nYour financial data is available for tax planning. Key considerations:\n\n• Review Section 80C utilization (PPF, ELSS, NPS, EPF)\n• Check your applicable tax regime (Old vs New) on the Tax page\n• For GST queries, ensure your GSTIN is linked in Business Settings\n\nFor detailed tax impact analysis, the Gemini AI advisor provides personalized recommendations when available.`;
        }

        case "Goals": {
          const goals = SelectorEngine.getActiveGoals(state);
          if (goals.length === 0) return "### Financial Goals\n\nNo active goals found. Create savings goals in the Goals section to track progress toward milestones like Emergency Fund, Vacation, or Home Down Payment.";
          const lines = goals.slice(0, 5).map(
            g => `• **${g.name}:** ${fmt(g.saved)} of ${fmt(g.target)} (${g.metrics.progress.toFixed(0)}%) — ${g.metrics.goalHealth}`
          );
          return `### Active Goals\n\n${lines.join("\n")}\n\nVisit the Goals page for contribution history and forecast projections.`;
        }

        case "CashFlow": {
          const income = SelectorEngine.getIncomeSummary(state);
          const expense = SelectorEngine.getExpenseSummary(state);
          const flow = income - expense;
          return `### Cash Flow Analysis\n\n• **Inflows:** ${fmt(income)}\n• **Outflows:** ${fmt(expense)}\n• **Net Cash Flow:** ${fmt(flow)}\n• **Status:** ${flow >= 0 ? "✅ Positive — surplus available for savings & investments" : "⚠️ Negative — expenses exceed income this period"}\n\nReview the Reports page for monthly cash flow trends.`;
        }

        case "Savings": {
          const savingsRate = MetricsRegistry.getMetric(state, "savings_rate");
          const emergencyMonths = MetricsRegistry.getMetric(state, "emergency_fund_coverage");
          return `### Savings Overview\n\n• **Savings Rate:** ${savingsRate.toFixed(1)}%\n• **Emergency Fund Coverage:** ${emergencyMonths.toFixed(1)} months of expenses\n\n**Benchmarks:**\n• Healthy savings rate: ≥ 20%\n• Emergency fund target: 3–6 months\n\n${emergencyMonths < 3 ? "⚠️ Consider building your emergency reserve to at least 3 months of essential expenses." : "✅ Emergency fund coverage meets the recommended minimum."}`;
        }

        case "Retirement": {
          return `### Retirement Planning\n\nKey retirement instruments in India:\n\n• **NPS Tier-1:** Extra ₹50,000 deduction under 80CCD(1B)\n• **PPF:** EEE status, 15-year lock-in, up to ₹1.5L under 80C\n• **EPF:** Employer-matched retirement savings\n\nVisit the Planning page to set a retirement corpus target and track your projected readiness. For personalized corpus calculations, the Gemini AI advisor provides detailed projections when available.`;
        }

        case "Insurance": {
          return `### Insurance Guidance\n\n**Recommended Coverage:**\n• **Term Life:** 10–15× annual income\n• **Health Insurance:** ₹10L+ base cover with Super Top-up\n• **Critical Illness:** Consider if family history warrants it\n\nReview your Financial Health Index on the dashboard — insurance coverage impacts your overall financial health score.`;
        }

        case "Greeting": {
          const healthScore = MetricsRegistry.getMetric(state, "financial_health_score");
          return `Hello! 👋 I'm your Financial Copilot.\n\nYour Financial Health Score is currently **${healthScore.toFixed(0)}/100**. Ask me anything about your budget, investments, loans, taxes, or savings — I'm here to help you make informed financial decisions.`;
        }

        case "Help": {
          return `### What I Can Help With\n\nI'm the GloriousFinance Financial Copilot. I can assist with:\n\n• 💰 **Budgets** — utilization, overspending alerts, category limits\n• 📊 **Investments** — portfolio analysis, SIP vs Lumpsum, asset allocation\n• 🏦 **Loans** — EMI tracking, prepayment strategies, debt ratios\n• 📋 **Tax** — Old vs New regime, 80C deductions, GST\n• 🎯 **Goals** — progress tracking, funding gaps, forecasts\n• 💵 **Cash Flow** — income vs expenses, savings rate\n• 🏥 **Insurance** — coverage recommendations\n• 🏖️ **Retirement** — NPS, PPF, corpus planning\n\nJust type your question and I'll respond with data from your Financial OS!`;
        }

        case "Forecast":
        case "Reports": {
          const dashboard = SelectorEngine.getDashboard(state);
          return `### Reports & Forecasting\n\n• **Net Worth:** ${fmt(dashboard.netWorth)}\n• **Health Score:** ${dashboard.healthScore}/100\n\nDetailed reports including net worth forecasts, cash flow projections, and expense breakdowns are available on the **Reports** page. The Forecast engine projects 6-month trajectories based on your current financial patterns.`;
        }

        case "Accounting":
        case "BusinessFinance": {
          return `### Business Finance\n\nFor business accounting and GST compliance:\n\n• Track invoices and vendor payments in the Transactions ledger\n• Ensure your GSTIN is registered for Input Tax Credit (ITC) tracking\n• Review cash vs accrual accounting methods on the Reports page\n\nFor detailed business finance analysis, the Gemini AI advisor provides guidance when available.`;
        }

        default: {
          // GeneralFinance or unclassified — provide a broad but grounded summary
          const dashboard = SelectorEngine.getDashboard(state);
          const healthScore = MetricsRegistry.getMetric(state, "financial_health_score");
          return `### Financial Summary\n\nHere's a snapshot from your Financial OS:\n\n• **Net Worth:** ${fmt(dashboard.netWorth)}\n• **Health Score:** ${healthScore.toFixed(0)}/100\n• **Monthly Income:** ${fmt(SelectorEngine.getIncomeSummary(state))}\n• **Monthly Expenses:** ${fmt(SelectorEngine.getExpenseSummary(state))}\n• **Active Loans:** ${SelectorEngine.getActiveLoans(state).length}\n• **Active Goals:** ${SelectorEngine.getActiveGoals(state).length}\n\nAsk me about a specific topic — budgets, investments, loans, taxes, or savings — for detailed analysis grounded in your data.`;
        }
      }
    } catch (err) {
      console.error("[RAGEngine] Fallback builder error:", err);
      return "I encountered an issue reading your financial data. Please try rephrasing your question or check the Dashboard for your latest metrics.";
    }
  }
}

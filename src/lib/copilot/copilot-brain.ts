import type { State } from "../store";
import { SelectorEngine, MetricsRegistry, ContextEngine } from "../financial-engine";
import { DomainGuard, type DomainGuardCheck } from "./domain-guard";
import { IntentEngine, type FinanceIntent } from "./intent-engine";
import { FinanceKnowledgeBase, type KnowledgeArticle } from "./knowledge-base";
import { CacheEngine } from "./cache-engine";
import { FinancialCoaches, type CoachType } from "./financial-coaches";
import { ResponseValidator } from "./response-validator";
import { CitationEngine, type CitationRef } from "./citation-engine";
import { callCopilotGemini, type CopilotChatHistoryMessage } from "./copilot-server";
import { formatINR } from "../format";

// ── User-Facing Response Badges (NO Provider Terms Exposed) ─────────────────
export type UserFacingLabel =
  | "Based on your financial data"
  | "Educational guidance"
  | "Personalized financial analysis"
  | "General financial knowledge";

export interface CopilotBrainResult {
  answerText: string;
  userFacingLabel: UserFacingLabel;
  isFollowUpRequired: boolean;
  citations: CitationRef[];
  intent: FinanceIntent;
  domainCheck: DomainGuardCheck;
}

// ── Goal Types ──────────────────────────────────────────────────────────────
export type CopilotGoalType =
  | "tax_planning"
  | "investment_advice"
  | "loan_optimization"
  | "budget_analysis"
  | "retirement_planning"
  | "insurance_guidance"
  | "definition_explanation"
  | "greeting_help"
  | "general_finance";

// ── 1. Goal Detector ────────────────────────────────────────────────────────
export class GoalDetector {
  public static detectGoal(query: string, intent: FinanceIntent): CopilotGoalType {
    const q = query.toLowerCase();
    if (intent === "Greeting" || intent === "Help") return "greeting_help";
    if (intent === "Tax" || intent === "GST" || /\b(save tax|tax planning|80c|regime)\b/i.test(q)) return "tax_planning";
    if (intent === "Investment" || intent === "Portfolio" || intent === "MutualFund" || intent === "Stocks" || intent === "Gold") return "investment_advice";
    if (intent === "Loan" || intent === "Debt" || /\b(prepay|emi|interest rate|mortgage)\b/i.test(q)) return "loan_optimization";
    if (intent === "Budget" || intent === "Expense" || intent === "Income" || intent === "CashFlow") return "budget_analysis";
    if (intent === "Retirement") return "retirement_planning";
    if (intent === "Insurance") return "insurance_guidance";
    if (/\b(what is|explain|define|meaning|difference between)\b/i.test(q)) return "definition_explanation";
    return "general_finance";
  }
}

// ── 2. Memory Manager ───────────────────────────────────────────────────────
export class MemoryManager {
  private static SESSION_KEY = "gf_copilot_memory_session";

  public static getSessionMemory(): Record<string, any> {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  public static updateSessionMemory(key: string, value: any): void {
    const mem = this.getSessionMemory();
    mem[key] = value;
    mem.lastUpdated = new Date().toISOString();
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(mem));
  }

  public static clearMemory(): void {
    localStorage.removeItem(this.SESSION_KEY);
  }
}

// ── 3. Missing Information Analyzer ─────────────────────────────────────────
export class MissingInfoAnalyzer {
  public static analyzeMissingInformation(
    goal: CopilotGoalType,
    state: State,
    userQuery: string,
    history: CopilotChatHistoryMessage[]
  ): { isMissing: boolean; questions: string[] } {
    const q = userQuery.toLowerCase();
    const historyText = history.map((h) => h.content.toLowerCase()).join(" ");
    const fullText = `${q} ${historyText}`;

    // If user asked a simple definition or general query, no follow-up needed
    if (goal === "definition_explanation" || goal === "greeting_help") {
      return { isMissing: false, questions: [] };
    }

    const missingQuestions: string[] = [];

    if (goal === "tax_planning") {
      const hasIncome = (state.transactions ?? []).some((t) => t.kind === "income") || /\b(salary|lakh|per year|income is)\b/i.test(fullText);
      const hasRegime = /\b(old regime|new regime)\b/i.test(fullText);

      if (!hasIncome) {
        missingQuestions.push("What is your total estimated annual income (e.g. ₹12 Lakhs)?");
      }
      if (!hasRegime) {
        missingQuestions.push("Are you currently filing taxes under the Old or New Tax Regime?");
      }
    } else if (goal === "investment_advice") {
      const hasHorizon = /\b(years|short term|long term|months)\b/i.test(fullText);
      const hasRisk = /\b(conservative|moderate|aggressive|risk)\b/i.test(fullText);

      if (!hasHorizon) {
        missingQuestions.push("What is your expected investment horizon (e.g., 3 years, 5 years, or 10+ years)?");
      }
      if (!hasRisk) {
        missingQuestions.push("What is your risk tolerance (Conservative, Moderate, or Aggressive)?");
      }
    } else if (goal === "loan_optimization") {
      const hasLoanInState = (state.loans ?? []).length > 0;
      const hasMentionedLoan = /\b(home loan|car loan|personal loan|interest rate|lakh)\b/i.test(fullText);

      if (!hasLoanInState && !hasMentionedLoan) {
        missingQuestions.push("Could you share your current loan outstanding balance, interest rate (e.g. 8.5%), and monthly EMI?");
      }
    }

    // Only prompt for missing info if user hasn't provided details and this is their first question in the session
    const isFirstQuestionInSession = history.length <= 1;
    const shouldAsk = isFirstQuestionInSession && missingQuestions.length > 0;

    return {
      isMissing: shouldAsk,
      questions: missingQuestions,
    };
  }
}

// ── 4. Financial OS & Planning Connector ────────────────────────────────────
export class FinancialOSConnector {
  public static getDirectAnswer(goal: CopilotGoalType, state: State, query: string): string | null {
    const q = query.toLowerCase();

    if (goal === "budget_analysis" && /\b(budget|utilization|spending)\b/i.test(q)) {
      const budgets = SelectorEngine.getBudgets(state);
      const util = MetricsRegistry.getMetric(state, "budget_utilization");
      const overspent = budgets.filter((b) => b.metrics.spent > b.limit);

      if (budgets.length === 0) {
        return "You have no active budget caps configured in your Financial OS. You can set category limits in the Budgets section.";
      }

      const categoryLines = budgets.slice(0, 4).map(
        (b) => `• **${b.category}:** ${formatINR(b.metrics.spent)} spent of ${formatINR(b.limit)} limit (${b.metrics.utilizationPercent.toFixed(0)}%)`
      );

      return `### Budget Utilization Analysis\n\n**Overall Utilization:** ${util.toFixed(0)}%\n\n${categoryLines.join("\n")}\n\n${overspent.length > 0 ? `⚠️ **Attention Required:** ${overspent.map((b) => b.category).join(", ")} ${overspent.length === 1 ? "has" : "have"} exceeded budget limits.` : "✅ All categories are operating within defined limits."}`;
    }

    if (goal === "loan_optimization" && /\b(my loans|outstanding|emi total)\b/i.test(q)) {
      const loans = SelectorEngine.getActiveLoans(state);
      if (loans.length === 0) {
        return "You currently have zero active loans recorded in your Financial OS ledger.";
      }

      const totalOutstanding = SelectorEngine.getLoansOutstandingSummary(state);
      const totalEmi = SelectorEngine.getLoansEmiSummary(state);

      const loanLines = loans.map((l) => `• **${l.name}:** Outstanding ${formatINR(l.outstanding)} @ ${l.rate}% p.a. (EMI: ${formatINR(l.emi)})`);

      return `### Active Obligations & Loans Summary\n\n• **Total Outstanding Debt:** ${formatINR(totalOutstanding)}\n• **Monthly EMI Commitments:** ${formatINR(totalEmi)}\n\n${loanLines.join("\n")}`;
    }

    if (goal === "investment_advice" && /\b(my portfolio|my investments|holdings)\b/i.test(q)) {
      const summary = SelectorEngine.getPortfolioSummary(state);
      if (summary.totalInvested === 0 && summary.totalCurrent === 0) {
        return "No investment holdings are currently tracked in your Financial OS ledger. You can add mutual funds, stocks, or gold in the Investments section.";
      }

      const gainLoss = summary.totalCurrent - summary.totalInvested;
      return `### Investment Portfolio Summary\n\n• **Total Invested Capital:** ${formatINR(summary.totalInvested)}\n• **Current Market Value:** ${formatINR(summary.totalCurrent)}\n• **Unrealized P&L:** ${gainLoss >= 0 ? "+" : ""}${formatINR(gainLoss)}\n• **Asset Positions:** ${state.investments?.length ?? 0} holdings`;
    }

    return null; // Delegate to Knowledge Engine or Server AI
  }
}

// ── 5. Central Financial Copilot Brain Orchestrator ─────────────────────────
export class FinancialCopilotBrain {
  public static async processQuery(
    userQuery: string,
    state: State,
    coachType: CoachType = "wealth_coach",
    history: CopilotChatHistoryMessage[] = []
  ): Promise<CopilotBrainResult> {
    const text = userQuery.trim();

    // ── 1. Domain Guard Check ──────────────────────────────────────────
    const domainCheck = DomainGuard.checkDomain(text);
    if (!domainCheck.isFinanceRelated) {
      return {
        answerText: domainCheck.refusalMessage || "I specialize in finance and financial planning. I can't assist with unrelated topics.",
        userFacingLabel: "Educational guidance",
        isFollowUpRequired: false,
        citations: [],
        intent: "NonFinance",
        domainCheck,
      };
    }

    // ── 2. Intent & Goal Detection ─────────────────────────────────────
    const intent = IntentEngine.classifyIntent(text);
    const goal = GoalDetector.detectGoal(text, intent);

    // ── 3. Missing Information Check (Follow-Up Question Flow) ─────────
    const missingAnalysis = MissingInfoAnalyzer.analyzeMissingInformation(goal, state, text, history);
    if (missingAnalysis.isMissing && missingAnalysis.questions.length > 0) {
      const qList = missingAnalysis.questions.map((q, idx) => `**Question ${idx + 1}:** ${q}`).join("\n\n");
      const promptText = `I would be glad to guide you with your financial planning.\n\nTo provide tailored advice, I need a few key details:\n\n${qList}\n\nOnce you share these, I will generate a personalized analysis for you!`;

      return {
        answerText: promptText,
        userFacingLabel: "Personalized financial analysis",
        isFollowUpRequired: true,
        citations: [],
        intent,
        domainCheck,
      };
    }

    // ── 4. Direct Financial OS Grounded Answer Decision ───────────────
    const directOSAnswer = FinancialOSConnector.getDirectAnswer(goal, state, text);
    if (directOSAnswer) {
      const validated = ResponseValidator.validateResponse(directOSAnswer);
      const citations = CitationEngine.extractCitations(validated.sanitizedResponse);

      return {
        answerText: validated.sanitizedResponse,
        userFacingLabel: "Based on your financial data",
        isFollowUpRequired: false,
        citations,
        intent,
        domainCheck,
      };
    }

    // ── 5. Knowledge Base Lookup Decision ──────────────────────────────
    const kbArticle = FinanceKnowledgeBase.searchKnowledgeBase(text);
    if (kbArticle) {
      const answer = `### ${kbArticle.title}\n\n${kbArticle.details}\n\n*Summary:* ${kbArticle.summary}`;
      const validated = ResponseValidator.validateResponse(answer);
      const citations = CitationEngine.extractCitations(validated.sanitizedResponse, kbArticle.title);

      // Cache Knowledge Base hit
      CacheEngine.setCachedResponse(text, validated.sanitizedResponse, intent, "knowledge_base");

      return {
        answerText: validated.sanitizedResponse,
        userFacingLabel: "Educational guidance",
        isFollowUpRequired: false,
        citations,
        intent,
        domainCheck,
      };
    }

    // ── 6. Response Cache Lookup Decision ─────────────────────────────
    const cached = CacheEngine.getCachedResponse(text);
    if (cached) {
      const validated = ResponseValidator.validateResponse(cached.response);
      const citations = CitationEngine.extractCitations(validated.sanitizedResponse);

      return {
        answerText: validated.sanitizedResponse,
        userFacingLabel: cached.source === "knowledge_base" ? "Educational guidance" : "Personalized financial analysis",
        isFollowUpRequired: false,
        citations,
        intent,
        domainCheck,
      };
    }

    // ── 7. Server-Side AI Orchestrator Execution ────────────────────────
    let aiContent = "";
    try {
      const serverRes = await callCopilotGemini({
        data: {
          userMessage: text,
          history,
          state,
          intent,
          coachType,
        },
      });

      if (serverRes.content) {
        aiContent = serverRes.content;
      }
    } catch (err) {
      console.error("[CopilotBrain] Server execution error:", err);
    }

    // ── 8. Success Response Flow ───────────────────────────────────────
    if (aiContent) {
      // Cache verified AI response
      CacheEngine.setCachedResponse(text, aiContent, intent, "gemini_llm");

      const validated = ResponseValidator.validateResponse(aiContent);
      const citations = CitationEngine.extractCitations(validated.sanitizedResponse);

      return {
        answerText: validated.sanitizedResponse,
        userFacingLabel: "Personalized financial analysis",
        isFollowUpRequired: false,
        citations,
        intent,
        domainCheck,
      };
    }

    // ── 9. Intent-Aware Local Fallback Flow (No Provider Exposure) ────
    const fallbackText = this.generateDynamicFallback(goal, intent, state);
    const validated = ResponseValidator.validateResponse(fallbackText);
    const citations = CitationEngine.extractCitations(validated.sanitizedResponse);

    return {
      answerText: validated.sanitizedResponse,
      userFacingLabel: "Based on your financial data",
      isFollowUpRequired: false,
      citations,
      intent,
      domainCheck,
    };
  }

  private static generateDynamicFallback(goal: CopilotGoalType, intent: FinanceIntent, state: State): string {
    const netWorth = MetricsRegistry.getMetric(state, "net_worth");
    const healthScore = MetricsRegistry.getMetric(state, "financial_health_score");
    const income = MetricsRegistry.getMetric(state, "monthly_income");
    const expense = SelectorEngine.getExpenseSummary(state);

    if (goal === "budget_analysis") {
      const budgets = SelectorEngine.getBudgets(state);
      return `### Budget Analysis\n\n• **Monthly Income:** ${formatINR(income)}\n• **Monthly Expenses:** ${formatINR(expense)}\n• **Net Cash Flow:** ${formatINR(income - expense)}\n• **Active Budgets:** ${budgets.length} configured categories\n\nAll metrics are derived from your Financial OS ledger.`;
    }

    if (goal === "loan_optimization") {
      const loans = SelectorEngine.getActiveLoans(state);
      return `### Debt & Loan Summary\n\n• **Active Loans:** ${loans.length}\n• **Total Outstanding:** ${formatINR(SelectorEngine.getLoansOutstandingSummary(state))}\n• **Monthly EMIs:** ${formatINR(SelectorEngine.getLoansEmiSummary(state))}\n\nReview your Loans page for individual interest rates and repayment strategies.`;
    }

    if (goal === "investment_advice") {
      const portfolio = SelectorEngine.getPortfolioSummary(state);
      return `### Portfolio Overview\n\n• **Invested Capital:** ${formatINR(portfolio.totalInvested)}\n• **Current Value:** ${formatINR(portfolio.totalCurrent)}\n• **Tracked Positions:** ${state.investments?.length ?? 0} holdings`;
    }

    if (goal === "tax_planning") {
      return `### Tax Planning Guidance\n\nKey tax optimization avenues:\n\n• **Section 80C:** Up to ₹1.5 Lakhs (PPF, ELSS, EPF, Home Loan Principal)\n• **Section 80D:** Up to ₹25,000–₹50,000 for Health Insurance\n• **Section 80CCD(1B):** Additional ₹50,000 for NPS Tier-1\n\nCheck the Planning menu to simulate Old vs New Tax Regime savings.`;
    }

    return `### Financial Overview\n\n• **Net Worth Position:** ${formatINR(netWorth)}\n• **Financial Health Index:** ${healthScore.toFixed(0)}/100\n• **Monthly Income:** ${formatINR(income)}\n• **Monthly Expenses:** ${formatINR(expense)}\n\nYour metrics are grounded in your Financial OS ledger. Ask a specific question on budgets, loans, or investments for detailed advice.`;
  }
}

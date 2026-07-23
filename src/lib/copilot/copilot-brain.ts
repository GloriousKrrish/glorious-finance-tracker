import type { State } from "../store";
import { SelectorEngine, MetricsRegistry, ContextEngine } from "../financial-engine";
import {
  InsightEngine,
  RiskEngine,
  OpportunityEngine,
  RecommendationEngine as IntelRecommendationEngine,
  GoalPlanner,
  ForecastEngine,
  ScenarioEngine,
  TaxEngine,
} from "../financial-engine";
import { DomainGuard, type DomainGuardCheck } from "./domain-guard";
import { IntentEngine, type FinanceIntent } from "./intent-engine";
import { FinanceKnowledgeBase } from "./knowledge-base";
import { FinancialCoaches, type CoachType } from "./financial-coaches";
import { ResponseValidator } from "./response-validator";
import { CitationEngine, type CitationRef } from "./citation-engine";
import { callCopilotGemini, type CopilotChatHistoryMessage } from "./copilot-server";
import { formatINR } from "../format";

// ══════════════════════════════════════════════════════════════════════════════
// USER-FACING LABELS (ZERO PROVIDER LEAKAGE)
// ══════════════════════════════════════════════════════════════════════════════
export type UserFacingLabel =
  | "Based on your financial data"
  | "Educational guidance"
  | "Personalized financial analysis"
  | "General financial knowledge";

// ══════════════════════════════════════════════════════════════════════════════
// PLANNING GOAL TYPES
// ══════════════════════════════════════════════════════════════════════════════
export type PlanningGoal =
  | "tax_saving_plan"
  | "investment_strategy"
  | "house_purchase_plan"
  | "retirement_planning"
  | "debt_elimination"
  | "emergency_fund"
  | "insurance_review"
  | "education_planning"
  | "vehicle_purchase"
  | "marriage_planning"
  | "business_planning"
  | "fire_independence"
  | "wealth_growth"
  | "estate_planning"
  | "budget_optimization"
  | "definition_explanation"
  | "greeting_help"
  | "general_finance";

// ══════════════════════════════════════════════════════════════════════════════
// WORKFLOW STATE
// ══════════════════════════════════════════════════════════════════════════════
export type WorkflowPhase = "idle" | "collecting_info" | "analyzing" | "plan_ready";

export interface WorkflowState {
  activeGoal: PlanningGoal;
  phase: WorkflowPhase;
  questionsAsked: number;
  questionsTotal: number;
  pendingQuestions: WorkflowQuestion[];
}

export interface WorkflowQuestion {
  id: string;
  question: string;
  factKey: string;
  options?: string[];
}

// ══════════════════════════════════════════════════════════════════════════════
// EXTRACTED FACTS
// ══════════════════════════════════════════════════════════════════════════════
export interface ExtractedFacts {
  annualIncome?: number;
  monthlyIncome?: number;
  employmentType?: "salaried" | "self_employed" | "business" | "freelance";
  taxRegime?: "old" | "new" | "not_sure";
  has80CInvestments?: boolean;
  hasHealthInsurance?: boolean;
  hasNPS?: boolean;
  hasHomeLoan?: boolean;
  homeLoanInterest?: number;
  riskTolerance?: "conservative" | "moderate" | "aggressive";
  investmentHorizon?: string;
  monthlyInvestable?: number;
  currentAge?: number;
  retirementAge?: number;
  dependents?: number;
  targetAmount?: number;
  existingCorpus?: number;
  monthlyExpenses?: number;
  [key: string]: any;
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTION PLAN
// ══════════════════════════════════════════════════════════════════════════════
export interface ActionPlanItem {
  priority: number;
  title: string;
  description: string;
  estimatedBenefit?: string;
  timeline?: string;
}

export interface ActionPlan {
  goalTitle: string;
  summary: string;
  currentPosition: string;
  items: ActionPlanItem[];
  expectedOutcome: string;
  risks: string[];
  nextSteps: string[];
}

// ══════════════════════════════════════════════════════════════════════════════
// COPILOT BRAIN RESULT
// ══════════════════════════════════════════════════════════════════════════════
export interface CopilotBrainResult {
  answerText: string;
  userFacingLabel: UserFacingLabel;
  isFollowUpRequired: boolean;
  citations: CitationRef[];
  intent: FinanceIntent;
  domainCheck: DomainGuardCheck;
  workflowState?: WorkflowState;
  extractedFacts?: ExtractedFacts;
  actionPlan?: ActionPlan;
  followUpOptions?: string[];
}

export type CopilotGoalType = PlanningGoal;

// ══════════════════════════════════════════════════════════════════════════════
// 1. GOAL DETECTOR
// ══════════════════════════════════════════════════════════════════════════════
export class GoalDetector {
  public static detectGoal(query: string, _intent: FinanceIntent): PlanningGoal {
    const q = query.toLowerCase().trim();

    // Greetings & help
    if (/^(hi|hello|hey|greetings|good morning|good evening|thanks?|thank you)\b/i.test(q)) {
      return "greeting_help";
    }
    if (/^(help|what can you do|features|instructions|options)\b/i.test(q)) {
      return "greeting_help";
    }

    // ── PRIORITY 1: TAXATION ──
    if (
      /\b(tax|taxation|income tax|80c|80d|section 80|nps|tds|tax regime|old regime|new regime|save tax|tax saving|plan.*tax|tax.*plan|my tax|pay tax|lower.*tax|reduce.*tax|minimize.*tax|tax slab|tax liability|tax calculation|tax deduction)\b/i.test(q)
    ) {
      return "tax_saving_plan";
    }

    // ── PRIORITY 2: INVESTMENTS ──
    if (
      /\b(invest|sip|mutual fund|stocks?|portfolio|asset allocation|where (to |should i )?invest|etf|equity|start investing|monthly invest|grow money|grow wealth|compound)\b/i.test(q)
    ) {
      return "investment_strategy";
    }

    // ── PRIORITY 3: HOUSE PURCHASE ──
    if (
      /\b(buy (a )?house|buy (a )?home|purchase (a )?(flat|apartment|property)|home loan|down payment|real estate|housing)\b/i.test(q)
    ) {
      return "house_purchase_plan";
    }

    // ── PRIORITY 4: RETIREMENT ──
    if (
      /\b(retire|retirement|pension|ppf|epf|retire at|corpus for retirement|post.?retirement|annuity)\b/i.test(q)
    ) {
      return "retirement_planning";
    }

    // ── PRIORITY 5: DEBT & LOANS ──
    if (
      /\b(debt free|pay off|pay down|eliminate debt|reduce debt|snowball|avalanche|close (my )?loan|prepay|clear (my )?loan|free from emi|my loan|my emi)\b/i.test(q)
    ) {
      return "debt_elimination";
    }

    // ── PRIORITY 6: EMERGENCY FUND ──
    if (
      /\b(emergency fund|contingency|rainy day|liquid (savings?|fund)|safety net|survival fund)\b/i.test(q)
    ) {
      return "emergency_fund";
    }

    // ── PRIORITY 7: INSURANCE ──
    if (
      /\b(insurance|term (life )?plan|mediclaim|health (insurance|cover)|life cover|lic|premium|risk cover|super top.?up)\b/i.test(q)
    ) {
      return "insurance_review";
    }

    // ── PRIORITY 8: EDUCATION ──
    if (/\b(child('s)? education|college fund|education planning|school fees|university|higher education)\b/i.test(q)) {
      return "education_planning";
    }

    // ── PRIORITY 9: VEHICLE ──
    if (/\b(buy (a )?(car|bike|vehicle|scooter)|car loan|vehicle loan|auto loan)\b/i.test(q)) {
      return "vehicle_purchase";
    }

    // ── PRIORITY 10: MARRIAGE ──
    if (/\b(marriage|wedding|marriage planning|wedding fund|save for (my )?wedding)\b/i.test(q)) {
      return "marriage_planning";
    }

    // ── PRIORITY 11: FIRE ──
    if (/\b(fire|financial independence|early retirement|financially free|passive income|live off investments)\b/i.test(q)) {
      return "fire_independence";
    }

    // ── PRIORITY 12: WEALTH GROWTH ──
    if (/\b(increase (my )?wealth|grow (my )?net worth|wealth (building|growth|creation)|become (a )?crorepati|1 crore)\b/i.test(q)) {
      return "wealth_growth";
    }

    // ── PRIORITY 13: BUDGET OPTIMIZATION ──
    if (/\b(budget|overspend|cut expenses|where.s my money|50.?30.?20|category limit|utilization)\b/i.test(q)) {
      return "budget_optimization";
    }

    // ── PRIORITY 14: DEFINITIONS ──
    if (/\b(what is|what are|explain|define|meaning of|tell me about|difference between|how does .+ work)\b/i.test(q)) {
      return "definition_explanation";
    }

    return "general_finance";
  }

  public static getGoalDisplayName(goal: PlanningGoal): string {
    const names: Record<PlanningGoal, string> = {
      tax_saving_plan: "Tax Saving Plan",
      investment_strategy: "Investment Strategy",
      house_purchase_plan: "House Purchase Plan",
      retirement_planning: "Retirement Planning",
      debt_elimination: "Debt Elimination Plan",
      emergency_fund: "Emergency Fund Strategy",
      insurance_review: "Insurance Review",
      education_planning: "Education Planning",
      vehicle_purchase: "Vehicle Purchase Plan",
      marriage_planning: "Marriage Planning",
      business_planning: "Business Planning",
      fire_independence: "Financial Independence (FIRE)",
      wealth_growth: "Wealth Growth Strategy",
      estate_planning: "Estate Planning",
      budget_optimization: "Budget Optimization",
      definition_explanation: "Financial Concept",
      greeting_help: "Welcome",
      general_finance: "Financial Advisory",
    };
    return names[goal] || "Financial Advisory";
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. FACT EXTRACTOR
// ══════════════════════════════════════════════════════════════════════════════
export class FactExtractor {
  public static extractFacts(text: string, existing: ExtractedFacts): ExtractedFacts {
    const updated = { ...existing };
    const q = text.toLowerCase();

    // ── Income extraction ──
    const lakhMatch = text.match(/([\d,.]+)\s*(?:lakhs?|lacs?|l|cr|crore|k)\b/i);
    const genericNumberMatch = text.match(/(?:salary|gross|ctc|income|earn|make|get|sal)\s*(?:is|was|of)?\s*(?:₹|rs\.?|inr)?\s*([\d,.]+)/i);

    if (lakhMatch) {
      let val = parseFloat(lakhMatch[1].replace(/,/g, ""));
      const rawMatchStr = lakhMatch[0].toLowerCase();
      if (rawMatchStr.includes("l") || rawMatchStr.includes("lac") || rawMatchStr.includes("lakh")) {
        val *= 100000;
      } else if (rawMatchStr.includes("cr")) {
        val *= 10000000;
      } else if (rawMatchStr.includes("k")) {
        val *= 1000;
      }

      if (val >= 100000) {
        updated.annualIncome = val;
        updated.monthlyIncome = Math.round(val / 12);
      }
    } else if (genericNumberMatch) {
      let val = parseFloat(genericNumberMatch[1].replace(/,/g, ""));
      if (val > 0 && val < 500) {
        val *= 100000;
      }
      if (val >= 100000) {
        updated.annualIncome = val;
        updated.monthlyIncome = Math.round(val / 12);
      } else if (val >= 10000) {
        updated.monthlyIncome = val;
        updated.annualIncome = val * 12;
      }
    }

    if (!updated.annualIncome) {
      const lDirect = text.match(/\b(\d+(?:\.\d+)?)\s*l\b/i);
      if (lDirect) {
        const val = parseFloat(lDirect[1]) * 100000;
        updated.annualIncome = val;
        updated.monthlyIncome = Math.round(val / 12);
      }
    }

    // ── Monthly Investable ──
    const investMatch = text.match(/(?:invest|save)\s*(?:₹|rs\.?|inr)?\s*([\d,.]+)\s*(?:monthly|per month|p\.?m\.?|\/mo)/i);
    if (investMatch) {
      const val = parseFloat(investMatch[1].replace(/,/g, ""));
      if (val > 0) updated.monthlyInvestable = val;
    }

    // ── Employment type ──
    if (/\b(salaried|salary|employee|gross)\b/i.test(q)) updated.employmentType = "salaried";
    else if (/\b(self[- ]?employed|freelanc(e|er|ing)|consultant)\b/i.test(q)) updated.employmentType = "self_employed";
    else if (/\b(business(man|woman)?|entrepreneur|proprietor)\b/i.test(q)) updated.employmentType = "business";

    // ── Tax regime ──
    if (/\b(old\s+(tax\s+)?regime|old)\b/i.test(q)) updated.taxRegime = "old";
    else if (/\b(new\s+(tax\s+)?regime|new)\b/i.test(q)) updated.taxRegime = "new";
    else if (/\b(not\s+sure|don'?t\s+know|unsure)\b/i.test(q)) updated.taxRegime = "not_sure";

    // ── 80C / Investments ──
    if (/\b(80c|section 80c|ppf|elss|epf|lic|nsc)\b/i.test(q)) updated.has80CInvestments = true;
    if (/\b(no\s+80c|haven'?t\s+invested|no\s+investments?\s+under)\b/i.test(q)) updated.has80CInvestments = false;

    // ── Health Insurance ──
    if (/\b(health\s+insurance|mediclaim|medical\s+insurance)\b/i.test(q)) {
      if (/\b(no|don'?t|do\s+not|haven'?t)\b/i.test(q)) updated.hasHealthInsurance = false;
      else updated.hasHealthInsurance = true;
    }

    // ── NPS ──
    if (/\b(nps|national\s+pension)\b/i.test(q)) {
      if (/\b(no|don'?t|do\s+not)\b/i.test(q)) updated.hasNPS = false;
      else updated.hasNPS = true;
    }

    // ── Risk Tolerance ──
    if (/\b(conservative|low\s+risk|safe)\b/i.test(q)) updated.riskTolerance = "conservative";
    else if (/\b(moderate|medium\s+risk|balanced)\b/i.test(q)) updated.riskTolerance = "moderate";
    else if (/\b(aggressive|high\s+risk|maximum\s+growth)\b/i.test(q)) updated.riskTolerance = "aggressive";

    // ── Investment Horizon ──
    const horizonMatch = text.match(/\b(\d+)\s*(?:year|yr)s?\b/i);
    if (horizonMatch) updated.investmentHorizon = `${horizonMatch[1]} years`;

    // ── Age ──
    const ageMatch = text.match(/\b(?:i'?m|i\s+am|my\s+age\s+is|age)\s*:?\s*(\d{2})\b/i);
    if (ageMatch) updated.currentAge = parseInt(ageMatch[1]);

    return updated;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. MISSING INFO ANALYZER
// ══════════════════════════════════════════════════════════════════════════════
export class MissingInfoAnalyzer {
  private static REQUIRED_FACTS: Record<string, WorkflowQuestion[]> = {
    tax_saving_plan: [
      { id: "tq1", question: "What is your total annual gross income (salary / CTC)?", factKey: "annualIncome" },
      { id: "tq2", question: "Which tax regime are you currently using?", factKey: "taxRegime", options: ["Old Regime", "New Regime", "Not Sure"] },
      { id: "tq3", question: "Have you already made any investments under Section 80C this year (PPF, ELSS, EPF, LIC)?", factKey: "has80CInvestments", options: ["Yes", "No", "Not Sure"] },
      { id: "tq4", question: "Do you have Health Insurance (Mediclaim) for yourself or your family?", factKey: "hasHealthInsurance", options: ["Yes", "No"] },
      { id: "tq5", question: "Do you have an active NPS (National Pension System) Tier-1 account?", factKey: "hasNPS", options: ["Yes", "No"] },
    ],
    investment_strategy: [
      { id: "iq1", question: "How much would you like to invest monthly?", factKey: "monthlyInvestable" },
      { id: "iq2", question: "What is your risk tolerance?", factKey: "riskTolerance", options: ["Conservative (Low Risk)", "Moderate (Balanced)", "Aggressive (High Growth)"] },
      { id: "iq3", question: "What is your investment horizon?", factKey: "investmentHorizon", options: ["Short-term (1-3 yrs)", "Medium-term (3-7 yrs)", "Long-term (7+ yrs)"] },
    ],
    house_purchase_plan: [
      { id: "hq1", question: "What is the target property value?", factKey: "targetAmount" },
      { id: "hq2", question: "How much down payment have you saved?", factKey: "existingCorpus" },
    ],
    retirement_planning: [
      { id: "rq1", question: "What is your current age?", factKey: "currentAge" },
      { id: "rq2", question: "At what age do you plan to retire?", factKey: "retirementAge" },
    ],
    debt_elimination: [],
    emergency_fund: [],
    insurance_review: [],
    education_planning: [],
    wealth_growth: [],
    fire_independence: [],
    budget_optimization: [],
    vehicle_purchase: [],
    marriage_planning: [],
    business_planning: [],
    estate_planning: [],
    definition_explanation: [],
    greeting_help: [],
    general_finance: [],
  };

  public static getMissingQuestions(
    goal: PlanningGoal,
    facts: ExtractedFacts,
    state: State
  ): WorkflowQuestion[] {
    const schema = this.REQUIRED_FACTS[goal] || [];
    if (schema.length === 0) return [];

    const missing: WorkflowQuestion[] = [];

    for (const q of schema) {
      const factValue = facts[q.factKey];
      if (factValue !== undefined && factValue !== null && factValue !== "") continue;

      if (q.factKey === "annualIncome" || q.factKey === "monthlyIncome") {
        const osIncome = MetricsRegistry.getMetric(state, "monthly_income");
        if (osIncome > 0) {
          facts.monthlyIncome = osIncome;
          facts.annualIncome = osIncome * 12;
          continue;
        }
      }

      missing.push(q);
    }

    return missing;
  }

  public static getTotalQuestions(goal: PlanningGoal): number {
    return (this.REQUIRED_FACTS[goal] || []).length;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. MEMORY MANAGER
// ══════════════════════════════════════════════════════════════════════════════
export class MemoryManager {
  private static SESSION_KEY = "gf_copilot_memory_session";
  private static FACTS_KEY = "gf_copilot_extracted_facts";
  private static WORKFLOW_KEY = "gf_copilot_workflow_state";

  public static getFacts(): ExtractedFacts {
    try {
      const raw = localStorage.getItem(this.FACTS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  public static saveFacts(facts: ExtractedFacts): void {
    localStorage.setItem(this.FACTS_KEY, JSON.stringify(facts));
  }

  public static getWorkflowState(): WorkflowState | null {
    try {
      const raw = localStorage.getItem(this.WORKFLOW_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public static saveWorkflowState(ws: WorkflowState): void {
    localStorage.setItem(this.WORKFLOW_KEY, JSON.stringify(ws));
  }

  public static clearWorkflow(): void {
    localStorage.removeItem(this.WORKFLOW_KEY);
  }

  public static clearMemory(): void {
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.FACTS_KEY);
    localStorage.removeItem(this.WORKFLOW_KEY);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. FINANCIAL OS CONNECTOR — Data Database Layer (No Automatic Metric Dumps)
// ══════════════════════════════════════════════════════════════════════════════
export class FinancialOSConnector {
  public static buildGoalContext(goal: PlanningGoal, state: State, facts: ExtractedFacts): string {
    const parts: string[] = [];

    const income = MetricsRegistry.getMetric(state, "monthly_income");
    const expense = SelectorEngine.getExpenseSummary(state);
    const cashFlow = MetricsRegistry.getMetric(state, "cash_flow");

    parts.push(`CASH FLOW: Monthly Income ${formatINR(income)}, Monthly Expense ${formatINR(expense)}, Surplus ${formatINR(cashFlow)}`);

    if (goal === "tax_saving_plan") {
      const annualIncome = facts.annualIncome || income * 12 || 1700000;
      const taxPlan = TaxEngine.calculateIndiaTax(annualIncome, {
        sec80C: facts.has80CInvestments ? 150000 : 0,
        sec80D: facts.hasHealthInsurance ? 25000 : 0,
        sec80CCD: facts.hasNPS ? 50000 : 0,
        sec24b: 0,
        hra: 0,
        other: 0,
      });

      parts.push(`TAX ENGINE CALCULATIONS (Gross Income: ${formatINR(annualIncome)}):`);
      parts.push(`• New Regime Tax: ${formatINR(taxPlan.newRegimeResult.totalTax)}`);
      parts.push(`• Old Regime Tax: ${formatINR(taxPlan.oldRegimeResult.totalTax)}`);
      parts.push(`• Tax Savings with Optimal Regime (${taxPlan.optimalRegime.toUpperCase()}): ${formatINR(taxPlan.taxSavingsWithOptimalRegime)}`);
    }

    return parts.join("\n");
  }

  public static getDirectDataAnswer(goal: PlanningGoal, state: State, query: string): string | null {
    const q = query.toLowerCase();

    // Portfolio direct query
    if (/\b(my portfolio|my investments?|holdings|what do i own|how is my portfolio)\b/i.test(q)) {
      const summary = SelectorEngine.getPortfolioSummary(state);
      if (summary.portfolioInvested === 0 && summary.portfolioValue === 0) {
        return "You don't have any investment holdings recorded in your ledger yet. Would you like me to help you build an investment strategy?";
      }

      const gain = summary.unrealizedPl;
      return `Based on your ledger, your portfolio is currently valued at **${formatINR(summary.portfolioValue)}** across **${state.investments?.length ?? 0} holdings**.\n\n• **Total Invested Capital:** ${formatINR(summary.portfolioInvested)}\n• **Unrealized P&L:** ${gain >= 0 ? "+" : ""}${formatINR(gain)}\n\nWould you like me to review your asset allocation or recommend rebalancing options?`;
    }

    // Loan direct query
    if (/\b(my loans?|outstanding|my emi)\b/i.test(q)) {
      const loans = SelectorEngine.getActiveLoans(state);
      if (loans.length === 0) return "You currently have zero active loans recorded in your ledger.";

      const totalOut = SelectorEngine.getLoansOutstandingSummary(state);
      const totalEmi = SelectorEngine.getLoansEmiSummary(state);

      const lines = loans.map((l) => `• **${l.name}:** ${formatINR(l.outstanding)} @ ${l.rate}% p.a. (EMI: ${formatINR(l.emi)})`);
      return `Here is your current loan summary:\n\n• **Total Outstanding Debt:** ${formatINR(totalOut)}\n• **Monthly EMI Commitments:** ${formatINR(totalEmi)}\n\n${lines.join("\n")}`;
    }

    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. CENTRAL FINANCIAL COPILOT BRAIN — Conversational Orchestrator
// ══════════════════════════════════════════════════════════════════════════════
// 6. CENTRAL FINANCIAL COPILOT BRAIN — Conversational Orchestrator
// ══════════════════════════════════════════════════════════════════════════════
export class FinancialCopilotBrain {
  public static async processQuery(
    userQuery: string,
    state: State,
    coachType: CoachType = "wealth_coach",
    history: CopilotChatHistoryMessage[] = []
  ): Promise<CopilotBrainResult> {
    const text = userQuery.trim();

    // ── STEP 0: Domain & Scope Check ──
    const domainCheck = DomainGuard.checkDomain(text);
    const intent = IntentEngine.classifyIntent(text);
    const goal = GoalDetector.detectGoal(text, intent);

    // ── STEP 1: Fact Extraction & Memory ──
    const existingFacts = MemoryManager.getFacts();
    const updatedFacts = FactExtractor.extractFacts(text, existingFacts);

    for (const msg of history) {
      if (msg.role === "user") {
        Object.assign(updatedFacts, FactExtractor.extractFacts(msg.content, updatedFacts));
      }
    }
    MemoryManager.saveFacts(updatedFacts);

    // ── STEP 2: General Non-Finance Questions (Python, Elon Musk, etc.) ──
    if (domainCheck.isGeneralKnowledge) {
      return await this.executeAIReasoning(text, goal, state, updatedFacts, coachType, history, intent, domainCheck);
    }

    // ── STEP 3: Natural Greetings ──
    if (goal === "greeting_help") {
      const greeting = `Hello! I'm your AI Financial Advisor. I'm here to assist you with wealth management, tax optimization, investment strategies, loans, or retirement planning. How can I help you today?`;

      return {
        answerText: greeting,
        userFacingLabel: "Educational guidance",
        isFollowUpRequired: false,
        citations: [],
        intent,
        domainCheck,
      };
    }

    // ── STEP 4: Personal Financial Data Queries (Portfolio, Loans, Budgets) ──
    if (domainCheck.isPersonalFinanceDataRequired) {
      const directAnswer = FinancialOSConnector.getDirectDataAnswer(goal, state, text);
      if (directAnswer) {
        const validated = ResponseValidator.validateResponse(directAnswer);
        const citations = CitationEngine.extractCitations(validated.sanitizedResponse);

        return {
          answerText: validated.sanitizedResponse,
          userFacingLabel: "Personalized financial analysis",
          isFollowUpRequired: false,
          citations,
          intent,
          domainCheck,
          extractedFacts: updatedFacts,
        };
      }
    }

    // ── STEP 5: Advisory Follow-Up Question Flow ──
    const isAdvisoryGoal = ![
      "definition_explanation",
      "greeting_help",
      "general_finance",
      "budget_optimization",
    ].includes(goal);

    if (isAdvisoryGoal && domainCheck.isPersonalFinanceDataRequired) {
      const missingQuestions = MissingInfoAnalyzer.getMissingQuestions(goal, updatedFacts, state);

      if (missingQuestions.length > 0) {
        const totalQuestions = MissingInfoAnalyzer.getTotalQuestions(goal);
        const answeredCount = totalQuestions - missingQuestions.length;
        const nextQuestion = missingQuestions[0];

        let response = "";

        if (goal === "tax_saving_plan") {
          response = `I'd be happy to help you create a personalized tax optimization strategy.`;
          if (updatedFacts.annualIncome) {
            response += `\n\n**Known Details:**\n✓ Annual Income: ${formatINR(updatedFacts.annualIncome)}`;
          }
          response += `\n\nTo give you an exact calculation, I just need a couple more details.\n\n**Question ${answeredCount + 1}:** ${nextQuestion.question}`;
        } else if (goal === "investment_strategy") {
          response = `I can help you construct a tailored investment strategy.`;
          if (updatedFacts.monthlyInvestable) {
            response += `\n\n**Known Details:**\n✓ Monthly Investable: ${formatINR(updatedFacts.monthlyInvestable)}`;
          }
          response += `\n\nTo recommend the ideal asset allocation, let me ask:\n\n**Question ${answeredCount + 1}:** ${nextQuestion.question}`;
        } else {
          const knownFacts = this.formatKnownFacts(updatedFacts);
          response = `I can help you build your financial plan.`;
          if (knownFacts) {
            response += `\n\nFrom our conversation so far:\n${knownFacts}`;
          }
          response += `\n\n**Question ${answeredCount + 1}:** ${nextQuestion.question}`;
        }

        const workflowState: WorkflowState = {
          activeGoal: goal,
          phase: "collecting_info",
          questionsAsked: answeredCount + 1,
          questionsTotal: totalQuestions,
          pendingQuestions: missingQuestions,
        };
        MemoryManager.saveWorkflowState(workflowState);

        return {
          answerText: response,
          userFacingLabel: "Personalized financial analysis",
          isFollowUpRequired: true,
          citations: [],
          intent,
          domainCheck,
          workflowState,
          extractedFacts: updatedFacts,
          followUpOptions: nextQuestion.options,
        };
      }
    }

    // ── STEP 6: AI Conversational Reasoning (Server Call or Natural Fallback) ──
    return await this.executeAIReasoning(text, goal, state, updatedFacts, coachType, history, intent, domainCheck);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI REASONING & NATURAL ADVISORY FALLBACK
  // ═══════════════════════════════════════════════════════════════════════════
  private static async executeAIReasoning(
    query: string,
    goal: PlanningGoal,
    state: State,
    facts: ExtractedFacts,
    coachType: CoachType,
    history: CopilotChatHistoryMessage[],
    intent: FinanceIntent,
    domainCheck: DomainGuardCheck
  ): Promise<CopilotBrainResult> {
    const goalContext = domainCheck.isPersonalFinanceDataRequired
      ? FinancialOSConnector.buildGoalContext(goal, state, facts)
      : "General knowledge / world finance question. No personal ledger data needed.";
    const goalName = GoalDetector.getGoalDisplayName(goal);

    let aiContent = "";

    try {
      const serverRes = await callCopilotGemini({
        data: {
          userMessage: query,
          history,
          state,
          intent,
          coachType,
          goalContext,
          goalType: goal,
          goalName,
          extractedFacts: facts,
        },
      });

      if (serverRes.content) {
        aiContent = serverRes.content;
      }
    } catch (err) {
      console.error("[CopilotBrain] Server AI execution error:", err);
    }

    if (aiContent) {
      const validated = ResponseValidator.validateResponse(aiContent);
      const citations = CitationEngine.extractCitations(validated.sanitizedResponse);
      MemoryManager.clearWorkflow();

      return {
        answerText: validated.sanitizedResponse,
        userFacingLabel: domainCheck.isPersonalFinanceDataRequired ? "Personalized financial analysis" : "Educational guidance",
        isFollowUpRequired: false,
        citations,
        intent,
        domainCheck,
        extractedFacts: facts,
      };
    }

    // ── Natural Conversational Fallback ──
    return this.generateNaturalConversationalFallback(query, goal, state, facts, intent, domainCheck);
  }

  private static generateNaturalConversationalFallback(
    query: string,
    goal: PlanningGoal,
    state: State,
    facts: ExtractedFacts,
    intent: FinanceIntent,
    domainCheck: DomainGuardCheck
  ): CopilotBrainResult {
    const q = query.toLowerCase().trim();
    let answer = "";

    // ── Harmless General Non-Finance Questions (Python, Elon Musk, etc.) ──
    if (domainCheck.isGeneralKnowledge) {
      if (q.includes("python")) {
        answer = `Python is a popular, high-level programming language known for its simple syntax, versatility, and readability. It is widely used in data analysis, financial modeling, machine learning, web development, and automation.\n\n*Note: While I can answer general knowledge questions, my primary expertise is in financial planning, taxation, wealth management, and investment advisory! Feel free to ask any financial questions.*`;
      } else if (q.includes("elon musk")) {
        answer = `Elon Musk is a prominent technology entrepreneur and business magnate. He is the CEO of Tesla, CEO and CTO of SpaceX, owner of X (formerly Twitter), and founder of Neuralink and The Boring Company.\n\n*Note: While I can answer general knowledge questions, my primary expertise is in financial planning, taxation, wealth management, and investment advisory! Feel free to ask any financial questions.*`;
      } else if (q.includes("machine learning")) {
        answer = `Machine learning is a subfield of artificial intelligence (AI) focused on building algorithms that learn patterns from data to make predictions or decisions without being explicitly programmed.\n\n*Note: While I can answer general knowledge questions, my primary expertise is in financial planning, taxation, wealth management, and investment advisory! Feel free to ask any financial questions.*`;
      } else {
        answer = `That is an interesting general question! I'd be happy to answer concisely, but please remember my core specialization is as your personal AI Financial Advisor. Feel free to ask me about tax planning, investments, SIPs, loans, or wealth management anytime!`;
      }
    }
    // ── Concept Questions (SIP, Gold, Inflation, ETF, Buffett, etc.) ──
    else if (q.includes("sip") || q.includes("systematic investment")) {
      answer = `**Systematic Investment Plan (SIP)** is a method of investing a fixed sum of money into mutual funds at regular intervals (monthly or quarterly).\n\n**Key Advantages:**\n• **Rupee Cost Averaging:** You buy more fund units when prices are low and fewer units when prices are high, lowering your average cost per unit over time.\n• **Disciplined Compounding:** Small regular investments benefit immensely from the power of compounding over long investment horizons.\n• **Eliminates Market Timing:** You don't need to guess market tops or bottoms.\n\nWould you like help deciding between SIP vs Lumpsum or calculating potential SIP returns for a specific goal?`;
    } else if (q.includes("gold") || q.includes("buy gold")) {
      answer = `Investing in gold serves as a classical hedge against inflation and currency devaluation, providing portfolio stability during market downturns.\n\n**Best Ways to Invest in Gold:**\n1. **Sovereign Gold Bonds (SGBs):** Issued by the RBI, offering 2.5% annual interest + capital gains exemption if held to maturity.\n2. **Gold ETFs / Gold Mutual Funds:** Highly liquid, transparent pricing tracking 24k physical gold prices without storage hassle.\n3. **Physical Gold:** Bars or coins (carries making charges and storage overhead).\n\n**Financial Advisor Rule of Thumb:** Allocate **5% to 10%** of your total portfolio to gold to balance risk without hindering long-term equity growth.`;
    } else if (q.includes("inflation")) {
      answer = `**Inflation** is the rate at which the general level of prices for goods and services rises, eroding the purchasing power of your money over time.\n\n**Impact on Your Money:**\nIf inflation is 6% per year, an item costing ₹100 today will cost ₹106 next year. Keeping cash in low-yield savings accounts (2-3%) means losing real purchasing power every year.\n\n**How to Beat Inflation:**\n• **Equities & Mutual Funds:** Historically deliver 12-15% CAGR, beating 6% inflation.\n• **Real Estate & Gold:** Act as tangible inflation hedges.\n• **Avoid Cash Hoarding:** Maintain an emergency fund in liquid assets, but invest surplus cash into inflation-beating assets.`;
    } else if (q.includes("etf") || q.includes("exchange traded fund")) {
      answer = `An **Exchange Traded Fund (ETF)** is a basket of securities (stocks, bonds, or commodities) that trades on a stock exchange just like an individual stock.\n\n**ETF vs Mutual Fund:**\n• **Trading:** ETFs trade live on stock exchanges throughout market hours; Mutual Funds trade once daily at end-of-day NAV.\n• **Cost:** ETFs generally have lower expense ratios (0.05% - 0.20%) compared to active mutual funds.\n• **Requirements:** You need a Demat and Trading account to buy ETFs.`;
    } else if (q.includes("buffett") || q.includes("warren buffett")) {
      answer = `**Warren Buffett's Investing Philosophy** centers on **Value Investing** and long-term wealth compounding:\n\n1. **Economic Moats:** Invest in companies with durable competitive advantages (strong brands, high switching costs, scale).\n2. **Margin of Safety:** Buy great businesses when their market price is significantly below their intrinsic value.\n3. **Long Holding Periods:** *"Our favorite holding period is forever."*\n4. **Low-Cost Index Funds for Most Investors:** Buffett strongly recommends that non-professional investors regularly buy low-cost S&P 500 or broad index funds.`;
    } else if (goal === "tax_saving_plan") {
      const annualInc = facts.annualIncome || 1700000;
      const taxPlan = TaxEngine.calculateIndiaTax(annualInc, {
        sec80C: facts.has80CInvestments ? 150000 : 0,
        sec80D: facts.hasHealthInsurance ? 25000 : 0,
        sec80CCD: facts.hasNPS ? 50000 : 0,
        sec24b: 0,
        hra: 0,
        other: 0,
      });

      answer = `Here is a tax comparison based on an annual gross income of **${formatINR(annualInc)}**:\n\n`;
      answer += `• **New Tax Regime (Default):** Total Tax: **${formatINR(taxPlan.newRegimeResult.totalTax)}** *(Includes ₹75,000 Standard Deduction)*\n`;
      answer += `• **Old Tax Regime:** Total Tax: **${formatINR(taxPlan.oldRegimeResult.totalTax)}**\n\n`;
      answer += `💡 **Recommendation:** The **${taxPlan.optimalRegime.toUpperCase()} Tax Regime** is currently more tax-efficient for you, saving **${formatINR(taxPlan.taxSavingsWithOptimalRegime)}**.\n\n`;
      answer += `**Key Tax Saving Avenues:**\n`;
      answer += `• **Section 80C (Up to ₹1.5L):** ELSS Mutual Funds, PPF, or EPF.\n`;
      answer += `• **Section 80D (Up to ₹75K):** Health insurance premiums for self and parents.\n`;
      answer += `• **Section 80CCD(1B) (₹50K):** Exclusive NPS Tier-1 deduction.`;
    } else if (goal === "investment_strategy") {
      const amount = facts.monthlyInvestable || 20000;
      answer = `Investing **${formatINR(amount)} monthly** is an effective way to build long-term wealth.\n\n`;
      answer += `**Suggested Asset Allocation:**\n`;
      answer += `• **Flexi-Cap / Index Funds (60%):** ${formatINR(amount * 0.6)}/mo for core market exposure.\n`;
      answer += `• **Mid-Cap & Small-Cap Funds (25%):** ${formatINR(amount * 0.25)}/mo for growth.\n`;
      answer += `• **Debt / Liquid Funds (15%):** ${formatINR(amount * 0.15)}/mo for stability.\n\n`;
      answer += `Assuming a conservative 12% CAGR, a ${formatINR(amount)} monthly SIP over 10 years accumulates to approximately **₹46.4 Lakhs**.`;
    } else {
      answer = `I'd be happy to assist you! As your AI Financial Advisor, I can help you analyze investments, compare tax regimes, optimize debt, or plan for major life goals. What would you like to explore today?`;
    }

    const validated = ResponseValidator.validateResponse(answer);
    const citations = CitationEngine.extractCitations(validated.sanitizedResponse);

    return {
      answerText: validated.sanitizedResponse,
      userFacingLabel: domainCheck.isPersonalFinanceDataRequired ? "Personalized financial analysis" : "Educational guidance",
      isFollowUpRequired: false,
      citations,
      intent,
      domainCheck,
      extractedFacts: facts,
    };
  }

  private static formatKnownFacts(facts: ExtractedFacts): string {
    const lines: string[] = [];
    if (facts.annualIncome) lines.push(`✓ **Annual Income:** ${formatINR(facts.annualIncome)}`);
    if (facts.employmentType) lines.push(`✓ **Employment:** ${facts.employmentType}`);
    if (facts.taxRegime) lines.push(`✓ **Tax Regime:** ${facts.taxRegime}`);
    if (facts.has80CInvestments !== undefined) lines.push(`✓ **80C Investments:** ${facts.has80CInvestments ? "Yes" : "No"}`);
    if (facts.monthlyInvestable) lines.push(`✓ **Monthly Investment:** ${formatINR(facts.monthlyInvestable)}`);
    return lines.join("\n");
  }
}


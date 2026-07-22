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
      if (summary.totalInvested === 0 && summary.totalCurrent === 0) {
        return "You don't have any investment holdings recorded in your ledger yet. Would you like me to help you build an investment strategy?";
      }

      const gain = summary.totalCurrent - summary.totalInvested;
      return `Based on your ledger, your portfolio is currently valued at **${formatINR(summary.totalCurrent)}** across **${state.investments?.length ?? 0} holdings**.\n\n• **Total Invested Capital:** ${formatINR(summary.totalInvested)}\n• **Unrealized P&L:** ${gain >= 0 ? "+" : ""}${formatINR(gain)}\n\nWould you like me to review your asset allocation or recommend rebalancing options?`;
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
export class FinancialCopilotBrain {
  public static async processQuery(
    userQuery: string,
    state: State,
    coachType: CoachType = "wealth_coach",
    history: CopilotChatHistoryMessage[] = []
  ): Promise<CopilotBrainResult> {
    const text = userQuery.trim();

    // ── STEP 0: Domain Guard Check ──
    const domainCheck = DomainGuard.checkDomain(text);
    if (!domainCheck.isFinanceRelated) {
      return {
        answerText: "I specialize exclusively in personal finance, investments, tax planning, and financial management. I can't assist with sports or non-financial topics, but feel free to ask me anything about your money or investments!",
        userFacingLabel: "General financial knowledge",
        isFollowUpRequired: false,
        citations: [],
        intent: "NonFinance",
        domainCheck,
      };
    }

    // ── STEP 1: Goal Detection ──
    const intent = IntentEngine.classifyIntent(text);
    const goal = GoalDetector.detectGoal(text, intent);

    // ── STEP 2: Fact Extraction ──
    const existingFacts = MemoryManager.getFacts();
    const updatedFacts = FactExtractor.extractFacts(text, existingFacts);

    for (const msg of history) {
      if (msg.role === "user") {
        Object.assign(updatedFacts, FactExtractor.extractFacts(msg.content, updatedFacts));
      }
    }

    MemoryManager.saveFacts(updatedFacts);

    // ── STEP 3: Natural Greetings ──
    if (goal === "greeting_help") {
      const greeting = `Hello! I'm your Financial Copilot. How can I assist you with your money, investments, or taxes today?`;

      return {
        answerText: greeting,
        userFacingLabel: "Based on your financial data",
        isFollowUpRequired: false,
        citations: [],
        intent,
        domainCheck,
      };
    }

    // ── STEP 4: Educational Concepts ──
    if (goal === "definition_explanation") {
      const kbArticle = FinanceKnowledgeBase.searchKnowledgeBase(text);
      if (kbArticle) {
        const answer = `**${kbArticle.title}**\n\n${kbArticle.details}\n\n*${kbArticle.summary}*`;
        const validated = ResponseValidator.validateResponse(answer);
        const citations = CitationEngine.extractCitations(validated.sanitizedResponse, kbArticle.title);

        return {
          answerText: validated.sanitizedResponse,
          userFacingLabel: "Educational guidance",
          isFollowUpRequired: false,
          citations,
          intent,
          domainCheck,
        };
      }
    }

    // ── STEP 5: Direct OS Queries (Portfolio, Loans) ──
    const directAnswer = FinancialOSConnector.getDirectDataAnswer(goal, state, text);
    if (directAnswer) {
      const validated = ResponseValidator.validateResponse(directAnswer);
      const citations = CitationEngine.extractCitations(validated.sanitizedResponse);

      return {
        answerText: validated.sanitizedResponse,
        userFacingLabel: "Based on your financial data",
        isFollowUpRequired: false,
        citations,
        intent,
        domainCheck,
        extractedFacts: updatedFacts,
      };
    }

    // ── STEP 6: Advisory Follow-Up Question Flow ──
    const isAdvisoryGoal = ![
      "definition_explanation",
      "greeting_help",
      "general_finance",
      "budget_optimization",
    ].includes(goal);

    if (isAdvisoryGoal) {
      const missingQuestions = MissingInfoAnalyzer.getMissingQuestions(goal, updatedFacts, state);

      if (missingQuestions.length > 0) {
        const totalQuestions = MissingInfoAnalyzer.getTotalQuestions(goal);
        const answeredCount = totalQuestions - missingQuestions.length;
        const nextQuestion = missingQuestions[0];

        let response = "";

        if (goal === "tax_saving_plan") {
          response = `I'd be happy to help you create a personalized tax plan.`;
          if (updatedFacts.annualIncome) {
            response += `\n\nFrom your message I understand:\n✓ Annual Salary: ${formatINR(updatedFacts.annualIncome)}`;
          }
          response += `\n\nBefore I calculate your taxes, I need a few more details.\n\n**Question ${answeredCount + 1} of ${totalQuestions}:**\n${nextQuestion.question}`;
        } else if (goal === "investment_strategy") {
          response = `I can help you build an investment strategy.`;
          if (updatedFacts.monthlyInvestable) {
            response += `\n\nFrom your message I understand:\n✓ Monthly Investment: ${formatINR(updatedFacts.monthlyInvestable)}`;
          }
          response += `\n\nTo tailor the right asset allocation, I need a few details.\n\n**Question ${answeredCount + 1} of ${totalQuestions}:**\n${nextQuestion.question}`;
        } else {
          const knownFacts = this.formatKnownFacts(updatedFacts);
          response = `I can help you with your financial planning.`;
          if (knownFacts) {
            response += `\n\nFrom what you've shared:\n${knownFacts}`;
          }
          response += `\n\n**Question ${answeredCount + 1} of ${totalQuestions}:**\n${nextQuestion.question}`;
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

    // ── STEP 7: Full AI Reasoning (Server-Side AI or Local Fallback) ──
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
    const goalContext = FinancialOSConnector.buildGoalContext(goal, state, facts);
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
        userFacingLabel: "Personalized financial analysis",
        isFollowUpRequired: false,
        citations,
        intent,
        domainCheck,
        extractedFacts: facts,
      };
    }

    // ── Natural Conversational Fallback ──
    return this.generateNaturalConversationalFallback(goal, state, facts, intent, domainCheck);
  }

  private static generateNaturalConversationalFallback(
    goal: PlanningGoal,
    state: State,
    facts: ExtractedFacts,
    intent: FinanceIntent,
    domainCheck: DomainGuardCheck
  ): CopilotBrainResult {
    const annualInc = facts.annualIncome || 1700000;

    let answer = "";

    if (goal === "tax_saving_plan") {
      const taxPlan = TaxEngine.calculateIndiaTax(annualInc, {
        sec80C: facts.has80CInvestments ? 150000 : 0,
        sec80D: facts.hasHealthInsurance ? 25000 : 0,
        sec80CCD: facts.hasNPS ? 50000 : 0,
        sec24b: 0,
        hra: 0,
        other: 0,
      });

      answer = `Based on your gross annual income of **${formatINR(annualInc)}**, here is your tax comparison and optimization plan:\n\n`;
      answer += `**1. New Tax Regime (Default):**\n`;
      answer += `• Total Tax Payable: **${formatINR(taxPlan.newRegimeResult.totalTax)}** *(Includes ₹75,000 Standard Deduction)*\n\n`;
      answer += `**2. Old Tax Regime:**\n`;
      answer += `• Total Tax Payable: **${formatINR(taxPlan.oldRegimeResult.totalTax)}**\n\n`;
      answer += `💡 **Regime Recommendation:** The **${taxPlan.optimalRegime.toUpperCase()} Tax Regime** is currently more beneficial, saving you **${formatINR(taxPlan.taxSavingsWithOptimalRegime)}** per year.\n\n`;
      answer += `---\n\n`;
      answer += `**Key Tax Saving Opportunities:**\n`;
      answer += `• **Section 80C (Up to ₹1.5L):** Invest in ELSS Mutual Funds or PPF to save up to ₹46,800.\n`;
      answer += `• **Section 80D (Up to ₹75K):** Health insurance premiums for self and parents save up to ₹23,400.\n`;
      answer += `• **Section 80CCD(1B) (₹50K):** NPS Tier-1 investments yield an extra ₹15,600 tax saving.`;
    } else if (goal === "investment_strategy") {
      const amount = facts.monthlyInvestable || 20000;
      answer = `Investing **${formatINR(amount)} monthly** is a fantastic strategy to build long-term wealth.\n\n`;
      answer += `**Recommended Asset Allocation:**\n`;
      answer += `• **Large-Cap / Flexi-Cap Index Funds (60%):** ${formatINR(amount * 0.6)}/mo for core long-term growth.\n`;
      answer += `• **Mid-Cap & Small-Cap Funds (25%):** ${formatINR(amount * 0.25)}/mo for higher alpha.\n`;
      answer += `• **Fixed Income / Debt Funds (15%):** ${formatINR(amount * 0.15)}/mo for portfolio stability.\n\n`;
      answer += `Over 10 years at an estimated 12% annual return, a ${formatINR(amount)}/mo SIP could grow to approximately **₹46.4 Lakhs** (on ₹24 Lakhs invested).`;
    } else {
      answer = `I'd be happy to guide you with your finances. Could you share what specific financial goal or question you'd like to address today?`;
    }

    const validated = ResponseValidator.validateResponse(answer);
    const citations = CitationEngine.extractCitations(validated.sanitizedResponse);

    return {
      answerText: validated.sanitizedResponse,
      userFacingLabel: "Based on your financial data",
      isFollowUpRequired: false,
      citations,
      intent,
      domainCheck,
      extractedFacts: facts,
    };
  }

  private static formatKnownFacts(facts: ExtractedFacts): string {
    const lines: string[] = [];
    if (facts.annualIncome) lines.push(`✓ **Annual Salary:** ${formatINR(facts.annualIncome)}`);
    if (facts.employmentType) lines.push(`✓ **Employment:** ${facts.employmentType}`);
    if (facts.taxRegime) lines.push(`✓ **Tax Regime:** ${facts.taxRegime}`);
    if (facts.has80CInvestments !== undefined) lines.push(`✓ **80C Investments:** ${facts.has80CInvestments ? "Yes" : "No"}`);
    if (facts.monthlyInvestable) lines.push(`✓ **Monthly Investment:** ${formatINR(facts.monthlyInvestable)}`);
    return lines.join("\n");
  }
}

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
// 1. GOAL DETECTOR — Robust, priority-ordered goal inference
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
    // Any query mentioning tax, taxation, 80c, regime, tds, slab, or tax planning MUST be tax_saving_plan
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

    // ── PRIORITY 13: BUDGET OPTIMIZATION (Only if tax/investments NOT mentioned) ──
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
// 2. FACT EXTRACTOR — Highly versatile salary and finance parameter parser
// ══════════════════════════════════════════════════════════════════════════════
export class FactExtractor {
  public static extractFacts(text: string, existing: ExtractedFacts): ExtractedFacts {
    const updated = { ...existing };
    const q = text.toLowerCase();

    // ── Income extraction ──
    // Matches 17L, 17 Lakh, 17 Lakhs, 17 Lac, 17,00,000, 1700000, 17.5L, 17 gross, salary was 17, 17 sal
    const lakhMatch = text.match(/([\d,.]+)\s*(?:lakhs?|lacs?|l|cr|crore|k)\b/i);
    const genericNumberMatch = text.match(/(?:salary|gross|ctc|income|earn|make|sal)\s*(?:is|was|of)?\s*(?:₹|rs\.?|inr)?\s*([\d,.]+)/i);

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
        // user wrote 17 or 25 referring to Lakhs
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

    // Direct fallback search for pattern "17L" or "17 L"
    if (!updated.annualIncome) {
      const lDirect = text.match(/\b(\d+(?:\.\d+)?)\s*l\b/i);
      if (lDirect) {
        const val = parseFloat(lDirect[1]) * 100000;
        updated.annualIncome = val;
        updated.monthlyIncome = Math.round(val / 12);
      }
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

    // ── Home Loan ──
    if (/\b(home\s+loan|housing\s+loan|mortgage)\b/i.test(q)) {
      if (/\b(no|don'?t|do\s+not)\b/i.test(q)) updated.hasHomeLoan = false;
      else updated.hasHomeLoan = true;
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

    // ── Retirement Age ──
    const retireMatch = text.match(/\bretire\s+(?:at|by)\s+(\d{2})\b/i);
    if (retireMatch) updated.retirementAge = parseInt(retireMatch[1]);

    return updated;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. MISSING INFO ANALYZER — Schema per goal
// ══════════════════════════════════════════════════════════════════════════════
export class MissingInfoAnalyzer {
  private static REQUIRED_FACTS: Record<string, WorkflowQuestion[]> = {
    tax_saving_plan: [
      { id: "tq1", question: "What is your total annual gross income (salary / CTC)?", factKey: "annualIncome" },
      { id: "tq2", question: "Which tax regime do you currently file under?", factKey: "taxRegime", options: ["Old Regime", "New Regime", "Not Sure"] },
      { id: "tq3", question: "Have you already made any investments under Section 80C this year (PPF, ELSS, EPF, LIC)?", factKey: "has80CInvestments", options: ["Yes", "No", "Not Sure"] },
      { id: "tq4", question: "Do you have Health Insurance (Mediclaim) for yourself or your family?", factKey: "hasHealthInsurance", options: ["Yes", "No"] },
      { id: "tq5", question: "Do you have an active NPS (National Pension System) Tier-1 account?", factKey: "hasNPS", options: ["Yes", "No"] },
    ],
    investment_strategy: [
      { id: "iq1", question: "What is your approximate monthly investable surplus?", factKey: "monthlyInvestable" },
      { id: "iq2", question: "What is your risk tolerance?", factKey: "riskTolerance", options: ["Conservative", "Moderate", "Aggressive"] },
      { id: "iq3", question: "What is your investment horizon?", factKey: "investmentHorizon", options: ["Short-term (1-3 yrs)", "Medium-term (3-7 yrs)", "Long-term (7+ yrs)"] },
    ],
    house_purchase_plan: [
      { id: "hq1", question: "What is the target property value?", factKey: "targetAmount" },
      { id: "hq2", question: "How much down payment have you saved?", factKey: "existingCorpus" },
      { id: "hq3", question: "What is your monthly income?", factKey: "monthlyIncome" },
    ],
    retirement_planning: [
      { id: "rq1", question: "What is your current age?", factKey: "currentAge" },
      { id: "rq2", question: "At what age do you plan to retire?", factKey: "retirementAge" },
      { id: "rq3", question: "What are your current monthly living expenses?", factKey: "monthlyExpenses" },
    ],
    debt_elimination: [
      { id: "dq1", question: "What is your current monthly income?", factKey: "monthlyIncome" },
    ],
    emergency_fund: [
      { id: "eq1", question: "What are your monthly essential expenses?", factKey: "monthlyExpenses" },
    ],
    insurance_review: [
      { id: "irq1", question: "What is your current age?", factKey: "currentAge" },
      { id: "irq2", question: "How many dependents do you have?", factKey: "dependents" },
    ],
    education_planning: [
      { id: "edq1", question: "What is the target education cost?", factKey: "targetAmount" },
    ],
    wealth_growth: [
      { id: "wq1", question: "What is your monthly investable surplus?", factKey: "monthlyInvestable" },
    ],
    fire_independence: [
      { id: "fq1", question: "What is your current age?", factKey: "currentAge" },
      { id: "fq2", question: "What are your annual living expenses?", factKey: "monthlyExpenses" },
    ],
    budget_optimization: [],
    vehicle_purchase: [
      { id: "vq1", question: "What is the vehicle's on-road price?", factKey: "targetAmount" },
    ],
    marriage_planning: [
      { id: "mq1", question: "What is your total estimated wedding budget?", factKey: "targetAmount" },
    ],
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
      if (q.factKey === "monthlyExpenses") {
        const osExpense = SelectorEngine.getExpenseSummary(state);
        if (osExpense > 0) {
          facts.monthlyExpenses = osExpense;
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
// 5. FINANCIAL OS CONNECTOR — Deterministic Calculations & Context
// ══════════════════════════════════════════════════════════════════════════════
export class FinancialOSConnector {
  public static buildGoalContext(goal: PlanningGoal, state: State, facts: ExtractedFacts): string {
    const parts: string[] = [];

    const netWorth = MetricsRegistry.getMetric(state, "net_worth");
    const healthScore = MetricsRegistry.getMetric(state, "financial_health_score");
    const income = MetricsRegistry.getMetric(state, "monthly_income");
    const expense = SelectorEngine.getExpenseSummary(state);
    const cashFlow = MetricsRegistry.getMetric(state, "cash_flow");

    parts.push(`FINANCIAL POSITION: Net Worth ${formatINR(netWorth)}, Health Score ${healthScore.toFixed(0)}/100`);
    parts.push(`CASH FLOW: Income ${formatINR(income)}/mo, Expenses ${formatINR(expense)}/mo, Surplus ${formatINR(cashFlow)}/mo`);

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

      parts.push(`DETERMINISTIC TAX CALCULATIONS (ANNUAL INCOME: ${formatINR(annualIncome)}):`);
      parts.push(`• New Regime Tax Payable: ${formatINR(taxPlan.newRegimeResult.totalTax)}`);
      parts.push(`• Old Regime Tax Payable: ${formatINR(taxPlan.oldRegimeResult.totalTax)}`);
      parts.push(`• Optimal Regime: ${taxPlan.optimalRegime.toUpperCase()} REGIME`);
      parts.push(`• Tax Difference: ${formatINR(taxPlan.taxSavingsWithOptimalRegime)}`);
    }

    return parts.join("\n");
  }

  public static getDirectDataAnswer(goal: PlanningGoal, state: State, query: string): string | null {
    const q = query.toLowerCase();

    if (goal === "budget_optimization" && /\b(my budget|utilization|how.s my budget)\b/i.test(q)) {
      const budgets = SelectorEngine.getBudgets(state);
      const util = MetricsRegistry.getMetric(state, "budget_utilization");
      if (budgets.length === 0) {
        return "You currently have zero active budget caps configured in your Financial OS. You can set category limits in the Budgets section.";
      }
      const lines = budgets.slice(0, 4).map(
        (b) => `• **${b.category}:** ${formatINR(b.metrics.spent)} of ${formatINR(b.limit)} (${b.metrics.utilizationPercent.toFixed(0)}%)`
      );
      return `### Budget Utilization Analysis\n\n**Overall Utilization:** ${util.toFixed(0)}%\n\n${lines.join("\n")}`;
    }

    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. CENTRAL FINANCIAL COPILOT BRAIN
// ══════════════════════════════════════════════════════════════════════════════
export class FinancialCopilotBrain {
  public static async processQuery(
    userQuery: string,
    state: State,
    coachType: CoachType = "wealth_coach",
    history: CopilotChatHistoryMessage[] = []
  ): Promise<CopilotBrainResult> {
    const text = userQuery.trim();

    // ── STEP 0: Domain Guard ──
    const domainCheck = DomainGuard.checkDomain(text);
    if (!domainCheck.isFinanceRelated) {
      return {
        answerText: domainCheck.refusalMessage || "I specialize in personal finance, investments, taxation, and financial planning. Could you ask me a finance-related question?",
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

    // ── STEP 3: Greeting / Help ──
    if (goal === "greeting_help") {
      const healthScore = MetricsRegistry.getMetric(state, "financial_health_score");
      const greeting = `Hello! I'm your Financial Copilot — your personal CA + CFP + Investment Advisor.\n\nYour **Financial Health Score** is **${healthScore.toFixed(0)}/100**.\n\nI can help you with:\n• 📊 Tax saving & regime optimization\n• 💰 Investment & SIP planning\n• 🏠 Home & vehicle purchase strategy\n• 📉 Debt prepayment plans\n• 🎯 Goal tracking\n\nWhat would you like to work on today?`;

      return {
        answerText: greeting,
        userFacingLabel: "Based on your financial data",
        isFollowUpRequired: false,
        citations: [],
        intent,
        domainCheck,
      };
    }

    // ── STEP 4: Educational Query ──
    if (goal === "definition_explanation") {
      const kbArticle = FinanceKnowledgeBase.searchKnowledgeBase(text);
      if (kbArticle) {
        const answer = `### ${kbArticle.title}\n\n${kbArticle.details}\n\n*Summary:* ${kbArticle.summary}`;
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

    // ── STEP 5: Direct OS Answer ──
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

    // ── STEP 6: Planning Workflow & Follow-Up Questions ──
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

        const goalName = GoalDetector.getGoalDisplayName(goal);

        // Build deterministic advice header if facts are known
        let response = `### ${goalName}\n\n`;

        if (goal === "tax_saving_plan" && updatedFacts.annualIncome) {
          const annualInc = updatedFacts.annualIncome;
          const taxPlan = TaxEngine.calculateIndiaTax(annualInc, {
            sec80C: updatedFacts.has80CInvestments ? 150000 : 0,
            sec80D: updatedFacts.hasHealthInsurance ? 25000 : 0,
            sec80CCD: updatedFacts.hasNPS ? 50000 : 0,
            sec24b: 0,
            hra: 0,
            other: 0,
          });

          response += `**Gross Annual Income:** ${formatINR(annualInc)}\n\n`;
          response += `#### Deterministic Tax Liability (FY 2024-25 / AY 2025-26)\n`;
          response += `• **New Tax Regime (Default):** ${formatINR(taxPlan.newRegimeResult.totalTax)} *(Includes ₹75,000 Standard Deduction)*\n`;
          response += `• **Old Tax Regime (Zero Deductions):** ${formatINR(taxPlan.oldRegimeResult.totalTax)}\n\n`;
          response += `💡 *Without deductions, the New Regime saves you **${formatINR(taxPlan.taxSavingsWithOptimalRegime)}** per year.*\n\n`;
          response += `---\n\nTo see if deductions can make the Old Regime cheaper for you:\n\n`;
        } else {
          const knownFacts = this.formatKnownFacts(updatedFacts);
          if (knownFacts) {
            response += `From what you've shared, I already know:\n${knownFacts}\n\n`;
          }
        }

        response += `**Question ${answeredCount + 1} of ${totalQuestions}:** ${nextQuestion.question}`;

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

    // ── STEP 7: AI Reasoning with Server Fallback ──
    return await this.executeAIReasoning(text, goal, state, updatedFacts, coachType, history, intent, domainCheck);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI REASONING & DETERMINISTIC FALLBACK
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

    // ── Deterministic Fallback — Guaranteed Grounded Financial Advice ──
    return this.generateGroundedFallback(goal, state, facts, intent, domainCheck);
  }

  private static generateGroundedFallback(
    goal: PlanningGoal,
    state: State,
    facts: ExtractedFacts,
    intent: FinanceIntent,
    domainCheck: DomainGuardCheck
  ): CopilotBrainResult {
    const goalName = GoalDetector.getGoalDisplayName(goal);
    const annualInc = facts.annualIncome || MetricsRegistry.getMetric(state, "monthly_income") * 12 || 1700000;

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

      answer = `### ${goalName} (Gross Salary: ${formatINR(annualInc)})\n\n`;
      answer += `#### Deterministic Tax Regime Comparison (FY 2024-25 / AY 2025-26)\n\n`;
      answer += `• **New Tax Regime (Default):** Net Tax = **${formatINR(taxPlan.newRegimeResult.totalTax)}** *(Effective Tax Rate: ${taxPlan.newRegimeResult.effectiveRate.toFixed(1)}%)*\n`;
      answer += `• **Old Tax Regime (Current Deductions):** Net Tax = **${formatINR(taxPlan.oldRegimeResult.totalTax)}** *(Effective Tax Rate: ${taxPlan.oldRegimeResult.effectiveRate.toFixed(1)}%)*\n\n`;

      answer += `💡 **Optimal Choice:** Use the **${taxPlan.optimalRegime.toUpperCase()} Tax Regime** to save **${formatINR(taxPlan.taxSavingsWithOptimalRegime)}** annually.\n\n`;

      answer += `---\n\n`;
      answer += `#### High-Impact Tax Savings Action Plan\n\n`;
      answer += `**Priority 1 — Section 80C Deduction (Up to ₹1,50,000)**\n`;
      answer += `• **Recommended:** ELSS Tax-Saver Mutual Funds (3-yr lock-in) or PPF (15-yr tax-free EEE status).\n`;
      answer += `• **Tax Benefit:** Saves up to **₹46,800** at 30% slab.\n\n`;

      answer += `**Priority 2 — Section 80D Health Insurance (Up to ₹75,000)**\n`;
      answer += `• **Recommended:** Mediclaim cover for self (₹25,000) and senior parents (₹50,000).\n`;
      answer += `• **Tax Benefit:** Saves up to **₹23,400**.\n\n`;

      answer += `**Priority 3 — Section 80CCD(1B) NPS Tier-1 (₹50,000)**\n`;
      answer += `• **Recommended:** National Pension System additional allocation.\n`;
      answer += `• **Tax Benefit:** Saves **₹15,600** beyond the 80C limit.`;
    } else if (goal === "budget_optimization") {
      const budgets = SelectorEngine.getBudgets(state);
      const util = MetricsRegistry.getMetric(state, "budget_utilization");
      const income = MetricsRegistry.getMetric(state, "monthly_income");
      const expense = SelectorEngine.getExpenseSummary(state);
      const cashFlow = income - expense;

      answer = `### Budget & Cash Flow Analysis\n\n`;
      answer += `• **Monthly Inflow:** ${formatINR(income)}\n`;
      answer += `• **Monthly Outflow:** ${formatINR(expense)}\n`;
      answer += `• **Net Surplus:** ${formatINR(cashFlow)}\n`;
      answer += `• **Overall Budget Utilization:** ${util.toFixed(0)}%\n\n`;

      if (budgets.length > 0) {
        answer += budgets
          .slice(0, 5)
          .map((b) => `• **${b.category}:** ${formatINR(b.metrics.spent)} of ${formatINR(b.limit)} (${b.metrics.utilizationPercent.toFixed(0)}%)`)
          .join("\n");
      } else {
        answer += `To track category limits, set up spending budgets in the Budgets section.`;
      }
    } else {
      const netWorth = MetricsRegistry.getMetric(state, "net_worth");
      const healthScore = MetricsRegistry.getMetric(state, "financial_health_score");

      answer = `### ${goalName}\n\n`;
      answer += `**Your Grounded Ledger Position:**\n`;
      answer += `• **Net Worth:** ${formatINR(netWorth)}\n`;
      answer += `• **Financial Health Index:** ${healthScore.toFixed(0)}/100\n\n`;
      answer += `I'm ready to build your tailored plan. Share your specific target amount or timeline, and I'll generate your step-by-step advisory roadmap.`;
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
    if (facts.annualIncome) lines.push(`✓ **Annual Gross Income:** ${formatINR(facts.annualIncome)}`);
    if (facts.employmentType) lines.push(`✓ **Employment:** ${facts.employmentType}`);
    if (facts.taxRegime) lines.push(`✓ **Tax Regime:** ${facts.taxRegime}`);
    if (facts.has80CInvestments !== undefined) lines.push(`✓ **80C Investments:** ${facts.has80CInvestments ? "Yes" : "No"}`);
    if (facts.hasHealthInsurance !== undefined) lines.push(`✓ **Health Insurance:** ${facts.hasHealthInsurance ? "Active" : "None"}`);
    if (facts.hasNPS !== undefined) lines.push(`✓ **NPS Account:** ${facts.hasNPS ? "Active" : "None"}`);
    return lines.join("\n");
  }
}

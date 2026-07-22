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
// PLANNING GOAL TYPES (NOT INTENTS — GOALS)
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

// Legacy alias for backward compatibility
export type CopilotGoalType = PlanningGoal;

// ══════════════════════════════════════════════════════════════════════════════
// 1. GOAL DETECTOR — Infers what the user is TRYING TO ACHIEVE
// ══════════════════════════════════════════════════════════════════════════════
export class GoalDetector {
  private static GOAL_PATTERNS: Array<{ goal: PlanningGoal; patterns: RegExp[] }> = [
    {
      goal: "tax_saving_plan",
      patterns: [
        /\b(save tax|tax planning|tax saving|reduce tax|tax optimization|80c|80d|section 80|regime|tax deduction|old regime|new regime|income tax|minimize tax|lower my tax|tds)\b/i,
      ],
    },
    {
      goal: "investment_strategy",
      patterns: [
        /\b(invest|sip|mutual fund|stocks?|portfolio|asset allocation|where (to |should i )?invest|etf|equity|start investing|monthly invest|grow money|grow wealth|compound)\b/i,
      ],
    },
    {
      goal: "house_purchase_plan",
      patterns: [
        /\b(buy (a )?house|buy (a )?home|purchase (a )?(flat|apartment|property)|home loan|down payment|real estate|housing)\b/i,
      ],
    },
    {
      goal: "retirement_planning",
      patterns: [
        /\b(retire|retirement|pension|nps|ppf|epf|retire at|corpus for retirement|post.?retirement|annuity)\b/i,
      ],
    },
    {
      goal: "debt_elimination",
      patterns: [
        /\b(debt free|pay off|pay down|eliminate debt|reduce debt|snowball|avalanche|close (my )?loan|prepay|clear (my )?loan|free from emi)\b/i,
      ],
    },
    {
      goal: "emergency_fund",
      patterns: [
        /\b(emergency fund|contingency|rainy day|liquid (savings?|fund)|safety net|survival fund)\b/i,
      ],
    },
    {
      goal: "insurance_review",
      patterns: [
        /\b(insurance|term (life )?plan|mediclaim|health (insurance|cover)|life cover|lic|premium|risk cover|super top.?up)\b/i,
      ],
    },
    {
      goal: "education_planning",
      patterns: [
        /\b(child('s)? education|college fund|education planning|school fees|university|higher education)\b/i,
      ],
    },
    {
      goal: "vehicle_purchase",
      patterns: [
        /\b(buy (a )?(car|bike|vehicle|scooter)|car loan|vehicle loan|auto loan)\b/i,
      ],
    },
    {
      goal: "marriage_planning",
      patterns: [
        /\b(marriage|wedding|marriage planning|wedding fund|save for (my )?wedding)\b/i,
      ],
    },
    {
      goal: "business_planning",
      patterns: [
        /\b(start (a )?business|business plan|working capital|invoice|vendor|revenue plan|startup)\b/i,
      ],
    },
    {
      goal: "fire_independence",
      patterns: [
        /\b(fire|financial independence|early retirement|financially free|passive income|live off investments)\b/i,
      ],
    },
    {
      goal: "wealth_growth",
      patterns: [
        /\b(increase (my )?wealth|grow (my )?net worth|wealth (building|growth|creation)|become (a )?crorepati|1 crore)\b/i,
      ],
    },
    {
      goal: "estate_planning",
      patterns: [
        /\b(estate plan|will|nomination|nominee|inheritance|succession)\b/i,
      ],
    },
    {
      goal: "budget_optimization",
      patterns: [
        /\b(budget|spending|overspend|cut expenses|save more|where.s my money|cash flow|50.?30.?20|optimize spend|utilization)\b/i,
      ],
    },
    {
      goal: "definition_explanation",
      patterns: [
        /\b(what is|what are|explain|define|meaning of|tell me about|difference between|how does .+ work)\b/i,
      ],
    },
  ];

  public static detectGoal(query: string, _intent: FinanceIntent): PlanningGoal {
    const q = query.toLowerCase().trim();

    // Greetings & help
    if (/^(hi|hello|hey|greetings|good morning|good evening|thanks?|thank you)\b/i.test(q)) {
      return "greeting_help";
    }
    if (/^(help|what can you do|features|instructions|options)\b/i.test(q)) {
      return "greeting_help";
    }

    // Pattern-match against goal library
    for (const entry of this.GOAL_PATTERNS) {
      if (entry.patterns.some((p) => p.test(q))) {
        return entry.goal;
      }
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
// 2. FACT EXTRACTOR — Extracts structured facts from user messages
// ══════════════════════════════════════════════════════════════════════════════
export class FactExtractor {
  public static extractFacts(text: string, existing: ExtractedFacts): ExtractedFacts {
    const updated = { ...existing };
    const q = text.toLowerCase();

    // ── Income extraction ──
    const incomePatterns = [
      /(?:i\s+(?:earn|make|get|have\s+(?:a\s+)?salary\s+of))\s*(?:₹|rs\.?|inr)?\s*([\d,.]+)\s*(lakh|lac|l|lakhs?|lacs?|cr|crore|k)?/i,
      /(?:salary|income|ctc|annual income|monthly income)\s*(?:is|of)?\s*(?:₹|rs\.?|inr)?\s*([\d,.]+)\s*(lakh|lac|l|lakhs?|lacs?|cr|crore|k)?/i,
      /(?:₹|rs\.?|inr)\s*([\d,.]+)\s*(lakh|lac|l|lakhs?|lacs?|cr|crore|k)?\s*(?:per\s+(?:annum|year|month)|p\.?a\.?|p\.?m\.?|salary|income)/i,
    ];

    for (const pattern of incomePatterns) {
      const match = text.match(pattern);
      if (match) {
        let amount = parseFloat(match[1].replace(/,/g, ""));
        const unit = (match[2] || "").toLowerCase();
        if (unit.startsWith("l") || unit.startsWith("lac")) amount *= 100000;
        else if (unit.startsWith("cr")) amount *= 10000000;
        else if (unit === "k") amount *= 1000;

        // Heuristic: if amount < 200000, likely monthly
        if (amount < 200000 && !/(per\s+year|annual|p\.?a\.?)/i.test(text)) {
          updated.monthlyIncome = amount;
          updated.annualIncome = amount * 12;
        } else {
          updated.annualIncome = amount;
          updated.monthlyIncome = Math.round(amount / 12);
        }
        break;
      }
    }

    // ── Employment type ──
    if (/\b(salaried|salary|employee)\b/i.test(q)) updated.employmentType = "salaried";
    else if (/\b(self[- ]?employed|freelanc(e|er|ing)|consultant)\b/i.test(q)) updated.employmentType = "self_employed";
    else if (/\b(business(man|woman)?|entrepreneur|proprietor)\b/i.test(q)) updated.employmentType = "business";

    // ── Tax regime ──
    if (/\b(old\s+(tax\s+)?regime)\b/i.test(q)) updated.taxRegime = "old";
    else if (/\b(new\s+(tax\s+)?regime)\b/i.test(q)) updated.taxRegime = "new";
    else if (/\b(not\s+sure|don'?t\s+know|unsure)\b/i.test(q)) updated.taxRegime = "not_sure";

    // ── 80C / Investments ──
    if (/\b(80c|section 80c|ppf|elss|epf|lic|nsc)\b/i.test(q)) updated.has80CInvestments = true;
    if (/\b(no\s+80c|haven'?t\s+invested|no\s+investments?\s+under)\b/i.test(q)) updated.has80CInvestments = false;
    if (/\b(yes|i\s+have)\b/i.test(q) && existing.has80CInvestments === undefined) {
      // Only set if we were asking about 80C
    }

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
    if (/\b(short\s+term)\b/i.test(q)) updated.investmentHorizon = "1-3 years";
    if (/\b(long\s+term)\b/i.test(q)) updated.investmentHorizon = "7+ years";

    // ── Age ──
    const ageMatch = text.match(/\b(?:i'?m|i\s+am|my\s+age\s+is|age)\s*:?\s*(\d{2})\b/i);
    if (ageMatch) updated.currentAge = parseInt(ageMatch[1]);

    // ── Retirement Age ──
    const retireMatch = text.match(/\bretire\s+(?:at|by)\s+(\d{2})\b/i);
    if (retireMatch) updated.retirementAge = parseInt(retireMatch[1]);

    // ── Dependents ──
    const depMatch = text.match(/\b(\d+)\s*(?:dependents?|kids?|children)\b/i);
    if (depMatch) updated.dependents = parseInt(depMatch[1]);

    // ── Target Amount ──
    const targetMatch = text.match(/\b(?:need|target|goal\s+of|save)\s*(?:₹|rs\.?|inr)?\s*([\d,.]+)\s*(lakh|lac|l|lakhs?|lacs?|cr|crore|k)?/i);
    if (targetMatch) {
      let amount = parseFloat(targetMatch[1].replace(/,/g, ""));
      const unit = (targetMatch[2] || "").toLowerCase();
      if (unit.startsWith("l") || unit.startsWith("lac")) amount *= 100000;
      else if (unit.startsWith("cr")) amount *= 10000000;
      else if (unit === "k") amount *= 1000;
      updated.targetAmount = amount;
    }

    return updated;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. MISSING INFO ANALYZER — Required facts schema per goal
// ══════════════════════════════════════════════════════════════════════════════
export class MissingInfoAnalyzer {
  private static REQUIRED_FACTS: Record<string, WorkflowQuestion[]> = {
    tax_saving_plan: [
      { id: "tq1", question: "What is your total annual income (CTC or gross salary)?", factKey: "annualIncome" },
      { id: "tq2", question: "Which tax regime do you currently file under?", factKey: "taxRegime", options: ["Old Regime", "New Regime", "Not Sure"] },
      { id: "tq3", question: "Have you already made any investments under Section 80C this year (PPF, ELSS, EPF, LIC, etc.)?", factKey: "has80CInvestments", options: ["Yes", "No", "Not Sure"] },
      { id: "tq4", question: "Do you have Health Insurance (Mediclaim) for yourself or family?", factKey: "hasHealthInsurance", options: ["Yes", "No"] },
      { id: "tq5", question: "Do you have an active NPS (National Pension System) Tier-1 account?", factKey: "hasNPS", options: ["Yes", "No"] },
    ],
    investment_strategy: [
      { id: "iq1", question: "What is your approximate monthly investable surplus after all expenses and EMIs?", factKey: "monthlyInvestable" },
      { id: "iq2", question: "What is your risk tolerance?", factKey: "riskTolerance", options: ["Conservative (Low Risk)", "Moderate (Balanced)", "Aggressive (High Growth)"] },
      { id: "iq3", question: "What is your investment horizon?", factKey: "investmentHorizon", options: ["Short-term (1-3 years)", "Medium-term (3-7 years)", "Long-term (7+ years)"] },
    ],
    house_purchase_plan: [
      { id: "hq1", question: "What is the approximate value of the property you are targeting?", factKey: "targetAmount" },
      { id: "hq2", question: "How much have you already saved as a down payment?", factKey: "existingCorpus" },
      { id: "hq3", question: "What is your current monthly income?", factKey: "monthlyIncome" },
    ],
    retirement_planning: [
      { id: "rq1", question: "What is your current age?", factKey: "currentAge" },
      { id: "rq2", question: "At what age would you like to retire?", factKey: "retirementAge" },
      { id: "rq3", question: "What are your current average monthly expenses?", factKey: "monthlyExpenses" },
      { id: "rq4", question: "Do you have any existing retirement corpus (PPF, NPS, EPF, investments)?", factKey: "existingCorpus" },
    ],
    debt_elimination: [
      { id: "dq1", question: "What is your monthly income?", factKey: "monthlyIncome" },
    ],
    emergency_fund: [
      { id: "eq1", question: "What are your current average monthly expenses (rent, EMIs, groceries, etc.)?", factKey: "monthlyExpenses" },
    ],
    insurance_review: [
      { id: "irq1", question: "What is your current age?", factKey: "currentAge" },
      { id: "irq2", question: "How many dependents do you have (spouse, children, parents)?", factKey: "dependents" },
      { id: "irq3", question: "What is your annual income?", factKey: "annualIncome" },
    ],
    education_planning: [
      { id: "edq1", question: "What is the child's current age?", factKey: "currentAge" },
      { id: "edq2", question: "What is the estimated education cost you are targeting?", factKey: "targetAmount" },
      { id: "edq3", question: "How much have you already saved towards this goal?", factKey: "existingCorpus" },
    ],
    wealth_growth: [
      { id: "wq1", question: "What is your approximate monthly investable surplus?", factKey: "monthlyInvestable" },
      { id: "wq2", question: "What is your risk appetite?", factKey: "riskTolerance", options: ["Conservative", "Moderate", "Aggressive"] },
    ],
    fire_independence: [
      { id: "fq1", question: "What is your current age?", factKey: "currentAge" },
      { id: "fq2", question: "What are your current annual living expenses?", factKey: "monthlyExpenses" },
      { id: "fq3", question: "What is your current total investment corpus?", factKey: "existingCorpus" },
    ],
    budget_optimization: [],
    vehicle_purchase: [
      { id: "vq1", question: "What is the approximate on-road price of the vehicle?", factKey: "targetAmount" },
      { id: "vq2", question: "How much can you put as down payment?", factKey: "existingCorpus" },
    ],
    marriage_planning: [
      { id: "mq1", question: "What is your estimated total wedding budget?", factKey: "targetAmount" },
      { id: "mq2", question: "How much have you saved so far for this?", factKey: "existingCorpus" },
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
      // Check if fact exists in extracted facts
      const factValue = facts[q.factKey];
      if (factValue !== undefined && factValue !== null && factValue !== "") continue;

      // Check if Financial OS already has this data
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
// 4. MEMORY MANAGER — Persists facts and workflow state across messages
// ══════════════════════════════════════════════════════════════════════════════
export class MemoryManager {
  private static SESSION_KEY = "gf_copilot_memory_session";
  private static FACTS_KEY = "gf_copilot_extracted_facts";
  private static WORKFLOW_KEY = "gf_copilot_workflow_state";

  // ── Facts ──
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

  // ── Workflow State ──
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

  // ── Session ──
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
    localStorage.removeItem(this.FACTS_KEY);
    localStorage.removeItem(this.WORKFLOW_KEY);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. FINANCIAL OS CONNECTOR — Orchestrates engines for grounded data
// ══════════════════════════════════════════════════════════════════════════════
export class FinancialOSConnector {
  /**
   * Builds a rich, goal-specific context from all Financial OS engines.
   * This is NOT a final response — it's data for the reasoning engine.
   */
  public static buildGoalContext(goal: PlanningGoal, state: State, facts: ExtractedFacts): string {
    const parts: string[] = [];

    // Base metrics for all goals
    const netWorth = MetricsRegistry.getMetric(state, "net_worth");
    const healthScore = MetricsRegistry.getMetric(state, "financial_health_score");
    const income = MetricsRegistry.getMetric(state, "monthly_income");
    const expense = SelectorEngine.getExpenseSummary(state);
    const savingsRate = MetricsRegistry.getMetric(state, "savings_rate");
    const cashFlow = MetricsRegistry.getMetric(state, "cash_flow");

    parts.push(`FINANCIAL POSITION: Net Worth ${formatINR(netWorth)}, Health Score ${healthScore.toFixed(0)}/100`);
    parts.push(`CASH FLOW: Income ${formatINR(income)}/mo, Expenses ${formatINR(expense)}/mo, Surplus ${formatINR(cashFlow)}/mo, Savings Rate ${savingsRate.toFixed(1)}%`);

    // Goal-specific engine data
    if (goal === "tax_saving_plan") {
      const annualIncome = facts.annualIncome || income * 12;
      parts.push(`TAXATION: Annual Income ${formatINR(annualIncome)}`);
      parts.push(`Deduction Avenues: 80C limit ₹1.5L, 80D limit ₹25K-₹50K, 80CCD(1B) NPS ₹50K`);
      if (facts.taxRegime) parts.push(`Selected Regime: ${facts.taxRegime}`);
      if (facts.has80CInvestments !== undefined) parts.push(`80C Status: ${facts.has80CInvestments ? "Existing investments" : "No investments yet"}`);
      if (facts.hasHealthInsurance !== undefined) parts.push(`Health Insurance: ${facts.hasHealthInsurance ? "Active" : "None"}`);
      if (facts.hasNPS !== undefined) parts.push(`NPS Tier-1: ${facts.hasNPS ? "Active" : "None"}`);
    }

    if (goal === "budget_optimization") {
      const budgets = SelectorEngine.getBudgets(state);
      const util = MetricsRegistry.getMetric(state, "budget_utilization");
      parts.push(`BUDGET: ${budgets.length} categories, Overall Utilization ${util.toFixed(0)}%`);
      budgets.forEach((b) => {
        parts.push(`  ${b.category}: ${formatINR(b.metrics.spent)}/${formatINR(b.limit)} (${b.metrics.utilizationPercent.toFixed(0)}%)`);
      });
    }

    if (goal === "debt_elimination" || goal === "house_purchase_plan") {
      const loans = SelectorEngine.getActiveLoans(state);
      const totalOutstanding = SelectorEngine.getLoansOutstandingSummary(state);
      const totalEmi = SelectorEngine.getLoansEmiSummary(state);
      parts.push(`DEBT: ${loans.length} active loans, Outstanding ${formatINR(totalOutstanding)}, Monthly EMIs ${formatINR(totalEmi)}`);
      loans.forEach((l) => {
        parts.push(`  ${l.name}: ${formatINR(l.outstanding)} @ ${l.rate}% (EMI ${formatINR(l.emi)})`);
      });
    }

    if (goal === "investment_strategy" || goal === "wealth_growth" || goal === "fire_independence") {
      const portfolio = SelectorEngine.getPortfolioSummary(state);
      const gainLoss = portfolio.totalCurrent - portfolio.totalInvested;
      parts.push(`PORTFOLIO: Invested ${formatINR(portfolio.totalInvested)}, Current ${formatINR(portfolio.totalCurrent)}, P&L ${gainLoss >= 0 ? "+" : ""}${formatINR(gainLoss)}`);
      parts.push(`Holdings: ${state.investments?.length ?? 0} positions`);
    }

    if (goal === "retirement_planning" || goal === "fire_independence") {
      const emFund = MetricsRegistry.getMetric(state, "emergency_fund_coverage");
      parts.push(`RETIREMENT READINESS: Emergency Fund ${emFund.toFixed(1)} months`);
      if (facts.currentAge) parts.push(`Age: ${facts.currentAge}`);
      if (facts.retirementAge) parts.push(`Target Retirement: ${facts.retirementAge}`);

      const goals = SelectorEngine.getActiveGoals(state);
      const retGoal = goals.find((g) => g.name.toLowerCase().includes("retire"));
      if (retGoal) parts.push(`Retirement Goal: ${formatINR(retGoal.saved)} saved of ${formatINR(retGoal.target)} (${retGoal.metrics.progress.toFixed(0)}%)`);
    }

    if (goal === "emergency_fund") {
      const emFund = MetricsRegistry.getMetric(state, "emergency_fund_coverage");
      parts.push(`EMERGENCY FUND: Current coverage ${emFund.toFixed(1)} months of expenses`);
      parts.push(`Required: 3-6 months of ${formatINR(expense)}/mo = ${formatINR(expense * 3)} to ${formatINR(expense * 6)}`);
    }

    // Risks & Opportunities
    const risks = RiskEngine.getRisks(state);
    if (risks.length > 0) {
      parts.push(`DETECTED RISKS: ${risks.map((r) => `[${r.severity}] ${r.title}`).join(", ")}`);
    }
    const opportunities = OpportunityEngine.getOpportunities(state);
    if (opportunities.length > 0) {
      parts.push(`OPPORTUNITIES: ${opportunities.map((o) => o.title).join(", ")}`);
    }

    // User-provided facts
    const factEntries = Object.entries(facts).filter(([_, v]) => v !== undefined && v !== null);
    if (factEntries.length > 0) {
      parts.push(`USER-PROVIDED FACTS: ${factEntries.map(([k, v]) => `${k}=${v}`).join(", ")}`);
    }

    return parts.join("\n");
  }

  /**
   * Attempts to answer simple data lookups directly from Financial OS without AI.
   */
  public static getDirectDataAnswer(goal: PlanningGoal, state: State, query: string): string | null {
    const q = query.toLowerCase();

    // Budget utilization lookup
    if (goal === "budget_optimization" && /\b(budget|utilization|how.s my budget|spending)\b/i.test(q)) {
      const budgets = SelectorEngine.getBudgets(state);
      const util = MetricsRegistry.getMetric(state, "budget_utilization");
      const overspent = budgets.filter((b) => b.metrics.spent > b.limit);

      if (budgets.length === 0) {
        return "You haven't set up any budget categories yet. Head over to the Budgets section to create spending limits — I'll then be able to track and optimize them for you.";
      }

      const lines = budgets.slice(0, 5).map(
        (b) => `• **${b.category}:** ${formatINR(b.metrics.spent)} of ${formatINR(b.limit)} (${b.metrics.utilizationPercent.toFixed(0)}%)`
      );

      let response = `Here's your current budget status:\n\n**Overall Utilization:** ${util.toFixed(0)}%\n\n${lines.join("\n")}`;

      if (overspent.length > 0) {
        response += `\n\n⚠️ **Attention:** ${overspent.map((b) => b.category).join(", ")} ${overspent.length === 1 ? "has" : "have"} exceeded the set limit. Would you like me to help you optimize your spending?`;
      } else {
        response += `\n\n✅ All categories are within limits. Great discipline!`;
      }

      return response;
    }

    // Loan summary lookup
    if (goal === "debt_elimination" && /\b(my loans?|outstanding|emi total|all loans?)\b/i.test(q)) {
      const loans = SelectorEngine.getActiveLoans(state);
      if (loans.length === 0) return "You have no active loans in your ledger. That's excellent — zero debt gives you maximum flexibility for investing and savings.";

      const totalOut = SelectorEngine.getLoansOutstandingSummary(state);
      const totalEmi = SelectorEngine.getLoansEmiSummary(state);

      const lines = loans.map((l) => `• **${l.name}:** ${formatINR(l.outstanding)} @ ${l.rate}% p.a. (EMI: ${formatINR(l.emi)})`);
      return `Here's your active debt position:\n\n**Total Outstanding:** ${formatINR(totalOut)}\n**Monthly EMI Commitment:** ${formatINR(totalEmi)}\n\n${lines.join("\n")}\n\nWould you like me to build a debt elimination plan? I can recommend whether to use the snowball or avalanche method based on your rates.`;
    }

    // Portfolio lookup
    if ((goal === "investment_strategy" || goal === "wealth_growth") && /\b(my portfolio|my investments?|holdings|what do i own)\b/i.test(q)) {
      const summary = SelectorEngine.getPortfolioSummary(state);
      if (summary.totalInvested === 0 && summary.totalCurrent === 0) {
        return "You don't have any investments tracked in your ledger yet. Would you like me to help you build an investment strategy? I'll need to understand your risk tolerance and time horizon first.";
      }

      const gain = summary.totalCurrent - summary.totalInvested;
      return `Here's your portfolio snapshot:\n\n**Invested Capital:** ${formatINR(summary.totalInvested)}\n**Current Value:** ${formatINR(summary.totalCurrent)}\n**Unrealized P&L:** ${gain >= 0 ? "+" : ""}${formatINR(gain)}\n**Positions:** ${state.investments?.length ?? 0} holdings\n\nWould you like me to review your asset allocation and suggest rebalancing?`;
    }

    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. CENTRAL FINANCIAL COPILOT BRAIN — THE ORCHESTRATOR
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

    // ── STEP 1: Goal Detection (NOT intent classification) ──
    const intent = IntentEngine.classifyIntent(text);
    const goal = GoalDetector.detectGoal(text, intent);

    // ── STEP 2: Fact Extraction ──
    const existingFacts = MemoryManager.getFacts();
    const updatedFacts = FactExtractor.extractFacts(text, existingFacts);

    // Also extract from all prior conversation messages
    for (const msg of history) {
      if (msg.role === "user") {
        Object.assign(updatedFacts, FactExtractor.extractFacts(msg.content, updatedFacts));
      }
    }

    MemoryManager.saveFacts(updatedFacts);

    // ── STEP 3: Greeting / Help ──
    if (goal === "greeting_help") {
      const healthScore = MetricsRegistry.getMetric(state, "financial_health_score");
      const greeting = `Hello! I'm your Financial Copilot — think of me as a CA + CFP + Investment Advisor rolled into one.\n\nYour **Financial Health Score** is **${healthScore.toFixed(0)}/100**.\n\nI can help you with:\n• 📊 Tax saving strategies\n• 💰 Investment planning\n• 🏠 Major purchase planning\n• 📉 Debt optimization\n• 🎯 Goal tracking\n• 🛡️ Insurance review\n\nWhat would you like to work on today?`;

      return {
        answerText: greeting,
        userFacingLabel: "Based on your financial data",
        isFollowUpRequired: false,
        citations: [],
        intent,
        domainCheck,
      };
    }

    // ── STEP 4: Definition / Educational Query ──
    if (goal === "definition_explanation") {
      // Check knowledge base first for clean educational answers
      const kbArticle = FinanceKnowledgeBase.searchKnowledgeBase(text);
      if (kbArticle) {
        const answer = `### ${kbArticle.title}\n\n${kbArticle.details}\n\n*${kbArticle.summary}*`;
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

      // If not in KB, delegate to AI for educational explanation
      return await this.executeAIReasoning(text, goal, state, updatedFacts, coachType, history, intent, domainCheck);
    }

    // ── STEP 5: Direct Financial OS Data Lookup ──
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

    // ── STEP 6: Planning Workflow — Missing Information Check ──
    const isAdvisoryGoal = ![
      "definition_explanation",
      "greeting_help",
      "general_finance",
      "budget_optimization",
    ].includes(goal);

    if (isAdvisoryGoal) {
      const missingQuestions = MissingInfoAnalyzer.getMissingQuestions(goal, updatedFacts, state);

      if (missingQuestions.length > 0) {
        // Determine how many are already answered
        const totalQuestions = MissingInfoAnalyzer.getTotalQuestions(goal);
        const answeredCount = totalQuestions - missingQuestions.length;
        const nextQuestion = missingQuestions[0]; // Ask ONE at a time

        // Build conversational response
        const goalName = GoalDetector.getGoalDisplayName(goal);
        const knownFacts = this.formatKnownFacts(updatedFacts);

        let response = `I'd love to help you with your **${goalName}**.`;

        if (knownFacts) {
          response += `\n\nFrom what you've shared, I already know:\n${knownFacts}`;
        }

        response += `\n\n**Question ${answeredCount + 1} of ${totalQuestions}:**\n${nextQuestion.question}`;

        if (nextQuestion.options) {
          response += `\n\n${nextQuestion.options.map((o, i) => `${i + 1}. ${o}`).join("\n")}`;
        }

        // Save workflow state
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

    // ── STEP 7: All facts collected → AI Reasoning with Financial OS context ──
    return await this.executeAIReasoning(text, goal, state, updatedFacts, coachType, history, intent, domainCheck);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI REASONING ENGINE — Server-side AI with full Financial OS context
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
    // Build rich goal-specific context from Financial OS
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

    // ── Success: AI generated a response ──
    if (aiContent) {
      const validated = ResponseValidator.validateResponse(aiContent);
      const citations = CitationEngine.extractCitations(validated.sanitizedResponse);

      // Clear workflow if we successfully generated a plan
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

    // ── Fallback: Generate a grounded response from Financial OS data ──
    return this.generateGroundedFallback(goal, state, facts, intent, domainCheck);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUNDED FALLBACK — Uses Financial OS data, no generic summaries
  // ═══════════════════════════════════════════════════════════════════════════
  private static generateGroundedFallback(
    goal: PlanningGoal,
    state: State,
    facts: ExtractedFacts,
    intent: FinanceIntent,
    domainCheck: DomainGuardCheck
  ): CopilotBrainResult {
    const goalName = GoalDetector.getGoalDisplayName(goal);
    const netWorth = MetricsRegistry.getMetric(state, "net_worth");
    const income = MetricsRegistry.getMetric(state, "monthly_income");
    const expense = SelectorEngine.getExpenseSummary(state);
    const cashFlow = income - expense;
    const healthScore = MetricsRegistry.getMetric(state, "financial_health_score");

    let answer = "";

    if (goal === "tax_saving_plan" && facts.annualIncome) {
      const annualInc = facts.annualIncome;
      answer = `### ${goalName}\n\n**Your Annual Income:** ${formatINR(annualInc)}\n\nHere are the key tax-saving avenues available to you:\n\n`;
      answer += `**Priority 1 — Section 80C (Up to ₹1,50,000)**\n`;
      answer += `• PPF, ELSS Mutual Funds, EPF, Life Insurance, Home Loan Principal\n`;
      answer += `• **Potential Tax Saving:** Up to ₹46,800 (at 30% slab)\n\n`;
      answer += `**Priority 2 — Section 80D (Health Insurance)**\n`;
      answer += `• Self: Up to ₹25,000 | Parents (Senior): Up to ₹50,000\n\n`;
      answer += `**Priority 3 — Section 80CCD(1B) (NPS)**\n`;
      answer += `• Additional ₹50,000 deduction beyond 80C limit\n\n`;
      answer += `To calculate your exact tax liability under Old vs New Regime, I'd recommend checking the Planning & Taxes section.`;
    } else if (goal === "budget_optimization") {
      const budgets = SelectorEngine.getBudgets(state);
      const util = MetricsRegistry.getMetric(state, "budget_utilization");
      answer = `### ${goalName}\n\n**Monthly Cash Flow:** ${formatINR(income)} income → ${formatINR(expense)} expenses → ${formatINR(cashFlow)} surplus\n**Savings Rate:** ${((cashFlow / Math.max(income, 1)) * 100).toFixed(0)}%\n**Budget Utilization:** ${util.toFixed(0)}%\n\n`;

      if (budgets.length > 0) {
        answer += budgets
          .slice(0, 5)
          .map((b) => `• **${b.category}:** ${formatINR(b.metrics.spent)}/${formatINR(b.limit)} (${b.metrics.utilizationPercent.toFixed(0)}%)`)
          .join("\n");
      } else {
        answer += `You haven't set up budget categories yet. Setting up budgets helps track spending discipline.`;
      }
    } else {
      // Generic but useful — not a dump
      answer = `I understand you're looking for guidance on **${goalName}**.\n\n`;
      answer += `**Your Current Position:**\n`;
      answer += `• Net Worth: ${formatINR(netWorth)}\n`;
      answer += `• Monthly Surplus: ${formatINR(cashFlow)}\n`;
      answer += `• Health Score: ${healthScore.toFixed(0)}/100\n\n`;
      answer += `To give you a detailed, personalized plan, could you tell me more about what specifically you'd like to achieve? The more details you share, the better I can guide you.`;
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

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER — Format known facts as bullet points
  // ═══════════════════════════════════════════════════════════════════════════
  private static formatKnownFacts(facts: ExtractedFacts): string {
    const lines: string[] = [];

    if (facts.annualIncome) lines.push(`✓ **Annual Income:** ${formatINR(facts.annualIncome)}`);
    if (facts.monthlyIncome && !facts.annualIncome) lines.push(`✓ **Monthly Income:** ${formatINR(facts.monthlyIncome)}`);
    if (facts.employmentType) lines.push(`✓ **Employment:** ${facts.employmentType.replace("_", " ")}`);
    if (facts.taxRegime) lines.push(`✓ **Tax Regime:** ${facts.taxRegime === "not_sure" ? "Not Sure" : facts.taxRegime.charAt(0).toUpperCase() + facts.taxRegime.slice(1)}`);
    if (facts.has80CInvestments !== undefined) lines.push(`✓ **80C Investments:** ${facts.has80CInvestments ? "Yes" : "No"}`);
    if (facts.hasHealthInsurance !== undefined) lines.push(`✓ **Health Insurance:** ${facts.hasHealthInsurance ? "Active" : "None"}`);
    if (facts.hasNPS !== undefined) lines.push(`✓ **NPS Account:** ${facts.hasNPS ? "Active" : "None"}`);
    if (facts.riskTolerance) lines.push(`✓ **Risk Tolerance:** ${facts.riskTolerance}`);
    if (facts.investmentHorizon) lines.push(`✓ **Investment Horizon:** ${facts.investmentHorizon}`);
    if (facts.currentAge) lines.push(`✓ **Age:** ${facts.currentAge}`);
    if (facts.retirementAge) lines.push(`✓ **Target Retirement:** Age ${facts.retirementAge}`);
    if (facts.dependents !== undefined) lines.push(`✓ **Dependents:** ${facts.dependents}`);
    if (facts.monthlyExpenses) lines.push(`✓ **Monthly Expenses:** ${formatINR(facts.monthlyExpenses)}`);
    if (facts.targetAmount) lines.push(`✓ **Target Amount:** ${formatINR(facts.targetAmount)}`);
    if (facts.existingCorpus) lines.push(`✓ **Existing Savings:** ${formatINR(facts.existingCorpus)}`);

    return lines.join("\n");
  }
}

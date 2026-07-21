import type { State, Transaction, Loan, Goal, Investment, Account, Bill } from "./types";
import { SelectorEngine } from "./selectors";

// --- TYPES FOR TAX ENGINE ---
export interface TaxDeductionsInput {
  sec80C: number; // Max 1,50,000 (PPF, ELSS, EPF, etc.)
  sec80D: number; // Max 25,000 / 50,000 (Health Insurance)
  sec80CCD: number; // Max 50,000 (NPS extra)
  sec24b: number; // Max 2,000,000 (Home Loan Interest)
  hra: number;
  other: number;
}

export interface TaxCalculationResult {
  year: number;
  regime: "old" | "new";
  grossIncome: number;
  deductions: number;
  taxableIncome: number;
  baseTax: number;
  surcharge: number;
  cess: number;
  totalTax: number;
  effectiveRate: number;
  marginalRate: number;
}

export interface TaxPlan {
  currentRegime: "old" | "new";
  oldRegimeResult: TaxCalculationResult;
  newRegimeResult: TaxCalculationResult;
  optimalRegime: "old" | "new";
  taxSavingsWithOptimalRegime: number;
  savingOpportunities: Array<{
    code: string;
    description: string;
    potentialSavings: number;
    recommendedInvestment: number;
    actionLabel: string;
  }>;
}

// --- TYPES FOR WEALTH ENGINE ---
export interface AssetAllocationMix {
  equity: number;
  fixedIncome: number;
  gold: number;
  cash: number;
  realEstate: number;
  crypto: number;
  other: number;
}

export interface WealthSimulationPoint {
  year: number;
  age: number;
  netWorth: number;
  investedCapital: number;
  passiveIncome: number;
  isFiAchieved: boolean;
}

export interface WealthAuditResult {
  currentNetWorth: number;
  assetAllocation: AssetAllocationMix;
  wealthScore: number; // 0-100
  savingsRate: number;
  debtToAssetRatio: number;
  riskAdjustedReturn: number; // Sharpe Ratio proxy
  financialIndependenceProgress: number; // 0-100%
  yearsToFi: number;
  fiCorpusTarget: number;
  simulation: WealthSimulationPoint[];
}

// --- TYPES FOR RETIREMENT ENGINE ---
export interface RetirementProjection {
  targetCorpus: number;
  currentProgressPercent: number;
  yearsToRetirement: number;
  inflationAdjustedTarget: number;
  safeWithdrawalRatePercent: number;
  monthlyRetirementIncomePotential: number;
  retirementReadinessScore: number; // 0-100
  riskLevel: "Low" | "Medium" | "High";
  suggestions: string[];
}

// --- TYPES FOR GOAL OPTIMIZATION ---
export interface GoalOptimizationItem {
  goalId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetYear: number;
  monthlyRequiredCurrent: number;
  monthlyRequiredOptimized: number;
  isFeasible: boolean;
  optimizedContributionSchedule: Array<{ year: number; contribution: number }>;
  recommendation: string;
}

// --- TYPES FOR DEBT OPTIMIZATION ---
export interface DebtStrategyPoint {
  month: number;
  avalancheRemainingDebt: number;
  snowballRemainingDebt: number;
  avalancheTotalPaid: number;
  snowballTotalPaid: number;
}

export interface DebtOptimizationReport {
  currentDebtFreeDate: string;
  avalancheDebtFreeDate: string;
  snowballDebtFreeDate: string;
  totalInterestPaidCurrent: number;
  totalInterestPaidAvalanche: number;
  totalInterestPaidSnowball: number;
  avalancheSavingsInterest: number;
  snowballSavingsInterest: number;
  strategySchedule: DebtStrategyPoint[];
  refinancingSuggestions: Array<{
    loanId: string;
    loanName: string;
    currentRate: number;
    recommendedRate: number;
    estimatedSavings: number;
    actionLabel: string;
  }>;
}

// --- TYPES FOR INSURANCE ANALYSIS ---
export interface InsuranceAudit {
  lifeCoverageRecommended: number;
  lifeCoverageActual: number;
  lifeGap: number;
  healthCoverageRecommended: number;
  healthCoverageActual: number;
  healthGap: number;
  insuranceScore: number; // 0-100
  gapsIdentified: string[];
}

// --- TYPES FOR FINANCIAL CALENDAR ---
export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: "tax" | "emi" | "bill" | "milestone" | "sip" | "renewal";
  amount?: number;
  description: string;
  importance: "low" | "medium" | "high";
}

// --- TYPES FOR SCENARIO PLANNING ---
export interface ScenarioResult {
  name: string;
  description: string;
  impactOnNetWorthAtRetirement: number;
  impactOnFiTimelineYears: number;
  emergencyFundAdequacy: "Adequate" | "Deficient";
  currentPlanNetWorth5Year: number;
  projectedPlanNetWorth5Year: number;
  recommendedPlanNetWorth5Year: number;
  recommendations: string[];
}


// --- 1. TAX ENGINE ---
export class TaxEngine {
  /**
   * Calculates income tax liability for India under the Old and New regimes.
   */
  public static calculateIndiaTax(
    grossIncome: number,
    deductions: TaxDeductionsInput,
    taxYear: number = 2026
  ): TaxPlan {
    const oldRegimeResult = this.calcIndiaOldRegime(grossIncome, deductions, taxYear);
    const newRegimeResult = this.calcIndiaNewRegime(grossIncome, deductions, taxYear);

    const optimalRegime = newRegimeResult.totalTax <= oldRegimeResult.totalTax ? ("new" as const) : ("old" as const);
    const currentRegime = optimalRegime; // assume user default
    const taxSavingsWithOptimalRegime = Math.abs(oldRegimeResult.totalTax - newRegimeResult.totalTax);

    // Saving opportunities analysis
    const savingOpportunities = [];

    // Check Section 80C
    if (deductions.sec80C < 150000) {
      const gap = 150000 - deductions.sec80C;
      const potentialTaxSave = gap * (optimalRegime === "old" ? 0.312 : 0.05); // rough estimate
      if (potentialTaxSave > 0) {
        savingOpportunities.push({
          code: "80C",
          description: "Maximize Section 80C (PPF, ELSS Mutual Funds, EPF)",
          potentialSavings: Math.round(potentialTaxSave),
          recommendedInvestment: gap,
          actionLabel: "Invest in ELSS / PPF",
        });
      }
    }

    // Check Section 80CCD (NPS)
    if (deductions.sec80CCD < 50000) {
      const gap = 50000 - deductions.sec80CCD;
      const potentialTaxSave = gap * (optimalRegime === "old" ? 0.312 : 0.20);
      if (potentialTaxSave > 0) {
        savingOpportunities.push({
          code: "80CCD(1B)",
          description: "Section 80CCD(1B) Dedicated National Pension Scheme Contribution",
          potentialSavings: Math.round(potentialTaxSave),
          recommendedInvestment: gap,
          actionLabel: "Contribute to NPS Account",
        });
      }
    }

    // Check Section 80D (Health Insurance)
    if (deductions.sec80D < 25000) {
      const gap = 25000 - deductions.sec80D;
      const potentialTaxSave = gap * (optimalRegime === "old" ? 0.208 : 0.104);
      if (potentialTaxSave > 0) {
        savingOpportunities.push({
          code: "80D",
          description: "Section 80D Health Insurance premiums for self/spouse/children",
          potentialSavings: Math.round(potentialTaxSave),
          recommendedInvestment: gap,
          actionLabel: "Purchase Health Coverage",
        });
      }
    }

    return {
      currentRegime,
      oldRegimeResult,
      newRegimeResult,
      optimalRegime,
      taxSavingsWithOptimalRegime,
      savingOpportunities,
    };
  }

  private static calcIndiaOldRegime(
    grossIncome: number,
    deductions: TaxDeductionsInput,
    year: number
  ): TaxCalculationResult {
    // Standard deduction under Old regime is 50,000
    const stdDeduction = 50000;
    
    // Deductions Cap
    const cap80C = Math.min(150000, deductions.sec80C);
    const cap80D = Math.min(25000, deductions.sec80D);
    const cap80CCD = Math.min(50000, deductions.sec80CCD);
    const cap24b = Math.min(200000, deductions.sec24b);
    
    const totalDeductions = stdDeduction + cap80C + cap80D + cap80CCD + cap24b + deductions.hra + deductions.other;
    const taxableIncome = Math.max(0, grossIncome - totalDeductions);

    // Old Slabs: 0-2.5L 0%, 2.5-5L 5%, 5-10L 20%, 10L+ 30%
    let baseTax = 0;
    if (taxableIncome > 1000000) {
      baseTax += (taxableIncome - 1000000) * 0.30;
      baseTax += 500000 * 0.20; // 5L to 10L
      baseTax += 250000 * 0.05; // 2.5L to 5L
    } else if (taxableIncome > 500000) {
      baseTax += (taxableIncome - 500000) * 0.20;
      baseTax += 250000 * 0.05;
    } else if (taxableIncome > 250000) {
      baseTax += (taxableIncome - 250000) * 0.05;
    }

    // Tax rebate Section 87A: If taxable income is <= 5,00,000, rebate of 100% up to 12,500
    if (taxableIncome <= 500000) {
      baseTax = Math.max(0, baseTax - 12500);
    }

    // Surcharge
    let surcharge = 0;
    if (taxableIncome > 5000000 && taxableIncome <= 10000000) surcharge = baseTax * 0.10;
    else if (taxableIncome > 10000000) surcharge = baseTax * 0.15;

    // Health & Education Cess: 4% on (Base Tax + Surcharge)
    const cess = (baseTax + surcharge) * 0.04;
    const totalTax = baseTax + surcharge + cess;

    return {
      year,
      regime: "old",
      grossIncome,
      deductions: totalDeductions,
      taxableIncome,
      baseTax: Math.round(baseTax),
      surcharge: Math.round(surcharge),
      cess: Math.round(cess),
      totalTax: Math.round(totalTax),
      effectiveRate: grossIncome > 0 ? (totalTax / grossIncome) * 100 : 0,
      marginalRate: taxableIncome > 1000000 ? 30 : taxableIncome > 500000 ? 20 : taxableIncome > 250000 ? 5 : 0,
    };
  }

  private static calcIndiaNewRegime(
    grossIncome: number,
    deductions: TaxDeductionsInput,
    year: number
  ): TaxCalculationResult {
    // New regime standard deduction is 75,000 (Finance Act updates)
    const stdDeduction = 75000;
    // New regime allows almost NO deductions except standard deduction (80CCD NPS corporate contributes are allowed, but we assume default self deductions here)
    const totalDeductions = stdDeduction;
    const taxableIncome = Math.max(0, grossIncome - totalDeductions);

    // New Slabs (FY 2025-26): 0-3L 0%, 3-7L 5%, 7-10L 10%, 10-12L 15%, 12-15L 20%, 15L+ 30%
    let baseTax = 0;
    if (taxableIncome > 1500000) {
      baseTax += (taxableIncome - 1500000) * 0.30;
      baseTax += 300000 * 0.20; // 12-15L
      baseTax += 200000 * 0.15; // 10-12L
      baseTax += 300000 * 0.10; // 7-10L
      baseTax += 400000 * 0.05; // 3-7L
    } else if (taxableIncome > 1200000) {
      baseTax += (taxableIncome - 1200000) * 0.20;
      baseTax += 200000 * 0.15;
      baseTax += 300000 * 0.10;
      baseTax += 400000 * 0.05;
    } else if (taxableIncome > 1000000) {
      baseTax += (taxableIncome - 1000000) * 0.15;
      baseTax += 300000 * 0.10;
      baseTax += 400000 * 0.05;
    } else if (taxableIncome > 700000) {
      baseTax += (taxableIncome - 700000) * 0.10;
      baseTax += 400000 * 0.05;
    } else if (taxableIncome > 300000) {
      baseTax += (taxableIncome - 300000) * 0.05;
    }

    // Rebate Section 87A (New Regime): Zero tax if taxable income is <= 7,00,000
    if (taxableIncome <= 700000) {
      baseTax = 0;
    }

    // Surcharge
    let surcharge = 0;
    if (taxableIncome > 5000000 && taxableIncome <= 10000000) surcharge = baseTax * 0.10;
    else if (taxableIncome > 10000000) surcharge = baseTax * 0.15;

    const cess = (baseTax + surcharge) * 0.04;
    const totalTax = baseTax + surcharge + cess;

    return {
      year,
      regime: "new",
      grossIncome,
      deductions: totalDeductions,
      taxableIncome,
      baseTax: Math.round(baseTax),
      surcharge: Math.round(surcharge),
      cess: Math.round(cess),
      totalTax: Math.round(totalTax),
      effectiveRate: grossIncome > 0 ? (totalTax / grossIncome) * 100 : 0,
      marginalRate: taxableIncome > 1500000 ? 30 : taxableIncome > 1200000 ? 20 : taxableIncome > 1000000 ? 15 : taxableIncome > 700000 ? 10 : taxableIncome > 300000 ? 5 : 0,
    };
  }
}


// --- 2. WEALTH ENGINE ---
export class WealthEngine {
  /**
   * Generates a 50-year wealth projection and computes overall health wealth score.
   */
  public static analyzeWealth(
    state: State,
    monthlySavingsContribution: number = 25000,
    annualGrowthRate: number = 10,
    inflationRate: number = 6
  ): WealthAuditResult {
    const accounts = state.accounts ?? [];
    const investments = state.investments ?? [];
    const loans = state.loans ?? [];

    const totalAssets = accounts.reduce((s, a) => s + a.balance, 0) +
      investments.reduce((s, i) => s + (i.units * i.currentPrice), 0);
    const totalLiabilities = loans.reduce((s, l) => s + l.outstanding, 0);

    const currentNetWorth = totalAssets - totalLiabilities;

    // Asset allocation mix
    let equity = 0, fixedIncome = 0, gold = 0, cash = 0, realEstate = 0, crypto = 0, other = 0;
    
    investments.forEach((inv) => {
      const value = inv.units * inv.currentPrice;
      if (inv.assetClass === "equity") equity += value;
      else if (inv.assetClass === "fixed_income") fixedIncome += value;
      else if (inv.assetClass === "gold_silver") gold += value;
      else if (inv.assetClass === "real_estate") realEstate += value;
      else if (inv.assetClass === "crypto") crypto += value;
      else other += value;
    });

    accounts.forEach((acc) => {
      if (acc.type === "investment") equity += acc.balance; // default
      else cash += acc.balance;
    });

    const assetSum = equity + fixedIncome + gold + cash + realEstate + crypto + other || 1;
    const allocation: AssetAllocationMix = {
      equity: Math.round((equity / assetSum) * 100),
      fixedIncome: Math.round((fixedIncome / assetSum) * 100),
      gold: Math.round((gold / assetSum) * 100),
      cash: Math.round((cash / assetSum) * 100),
      realEstate: Math.round((realEstate / assetSum) * 100),
      crypto: Math.round((crypto / assetSum) * 100),
      other: Math.round((other / assetSum) * 100),
    };

    // Savings Rate (heuristics based on transactions of past 3 months)
    const txns = state.transactions ?? [];
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const recentTxns = txns.filter((t) => new Date(t.date) >= threeMonthsAgo);
    const income = recentTxns.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0) / 3 || 100000;
    const expenses = recentTxns.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0) / 3 || 70000;

    const savingsRate = Math.min(100, Math.max(0, ((income - expenses) / income) * 100));
    const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

    // Wealth Score calculation
    let wealthScore = 50;
    wealthScore += savingsRate > 40 ? 15 : savingsRate > 20 ? 8 : -10;
    wealthScore += debtToAssetRatio < 20 ? 15 : debtToAssetRatio < 40 ? 5 : -15;
    wealthScore += allocation.equity > 30 && allocation.equity < 80 ? 10 : 0;
    wealthScore += currentNetWorth > 1000000 ? 10 : 5;
    wealthScore = Math.min(100, Math.max(10, wealthScore));

    // FI Target: 25x Annual Expenses
    const annualExpenses = expenses * 12;
    const fiCorpusTarget = annualExpenses * 25;
    const financialIndependenceProgress = Math.min(100, Math.max(0, (currentNetWorth / fiCorpusTarget) * 100));

    // Wealth Simulation (50-year projection)
    const simulation: WealthSimulationPoint[] = [];
    let runningNetWorth = currentNetWorth;
    let runningInvested = currentNetWorth > 0 ? currentNetWorth : 0;
    const realGrowthRate = (annualGrowthRate - inflationRate) / 100;
    const startAge = 30; // standard assumption

    for (let yr = 0; yr <= 50; yr++) {
      const year = new Date().getFullYear() + yr;
      const age = startAge + yr;

      if (yr > 0) {
        // Growth + monthly savings added annually
        runningNetWorth = runningNetWorth * (1 + realGrowthRate) + (monthlySavingsContribution * 12);
        runningInvested += (monthlySavingsContribution * 12);
      }

      const passiveIncome = runningNetWorth * 0.04; // 4% SWR potential
      const isFiAchieved = runningNetWorth >= fiCorpusTarget;

      simulation.push({
        year,
        age,
        netWorth: Math.round(runningNetWorth),
        investedCapital: Math.round(runningInvested),
        passiveIncome: Math.round(passiveIncome),
        isFiAchieved,
      });
    }

    const firstFiIndex = simulation.findIndex((s) => s.isFiAchieved);
    const yearsToFi = firstFiIndex !== -1 ? firstFiIndex : 99;

    return {
      currentNetWorth,
      assetAllocation: allocation,
      wealthScore,
      savingsRate: Math.round(savingsRate),
      debtToAssetRatio: Math.round(debtToAssetRatio),
      riskAdjustedReturn: 1.45, // Sharpe Ratio proxy
      financialIndependenceProgress: Math.round(financialIndependenceProgress),
      yearsToFi,
      fiCorpusTarget: Math.round(fiCorpusTarget),
      simulation,
    };
  }
}


// --- 3. RETIREMENT ENGINE ---
export class RetirementEngine {
  /**
   * Evaluates retirement readiness target based on current age, expenses, and asset base.
   */
  public static calculateRetirement(
    state: State,
    currentAge: number = 32,
    targetRetirementAge: number = 55,
    customMonthlyExpense: number = 60000,
    expectedReturnPreRetire: number = 10,
    inflationRate: number = 6
  ): RetirementProjection {
    const wealthAnalysis = WealthEngine.analyzeWealth(state);
    const yearsToRetirement = Math.max(1, targetRetirementAge - currentAge);

    // Target corpus adjusted for inflation
    const currentAnnualExpense = customMonthlyExpense * 12;
    const inflationFactor = Math.pow(1 + inflationRate / 100, yearsToRetirement);
    const futureAnnualExpense = currentAnnualExpense * inflationFactor;
    const targetCorpus = futureAnnualExpense * 25; // 25x SWR multiplier

    const currentNetWorth = wealthAnalysis.currentNetWorth;
    const currentProgressPercent = Math.min(100, Math.round((currentNetWorth / targetCorpus) * 100));

    // SWR Calculations
    const monthlyRetirementIncomePotential = (currentNetWorth * 0.04) / 12;

    // Readiness Score
    const expectedProgressAtCurrentAge = Math.min(100, (currentAge / targetRetirementAge) * 100);
    const progressFactor = currentProgressPercent / (expectedProgressAtCurrentAge || 1);
    let readinessScore = Math.round(progressFactor * 100);
    readinessScore = Math.min(100, Math.max(10, readinessScore));

    const suggestions: string[] = [];
    if (readinessScore < 50) {
      suggestions.push("Increase equity allocations to counter inflation erosion.");
      suggestions.push(`Boost monthly savings by ₹${Math.round(currentAnnualExpense * 0.05)} to close target gap.`);
    } else {
      suggestions.push("Retirement track is highly optimal. Keep SIP allocations consistent.");
    }

    return {
      targetCorpus: Math.round(targetCorpus),
      currentProgressPercent,
      yearsToRetirement,
      inflationAdjustedTarget: Math.round(targetCorpus),
      safeWithdrawalRatePercent: 4.0,
      monthlyRetirementIncomePotential: Math.round(monthlyRetirementIncomePotential),
      retirementReadinessScore: readinessScore,
      riskLevel: readinessScore < 40 ? "High" : readinessScore < 75 ? "Medium" : "Low",
      suggestions,
    };
  }
}


// --- 4. GOAL OPTIMIZATION ENGINE ---
export class GoalOptimizationEngine {
  /**
   * Iterates through goals to prioritize contributions and recommend monthly allocation schedules.
   */
  public static optimizeGoals(state: State): GoalOptimizationItem[] {
    const goals = state.goals ?? [];
    
    return goals.map((goal) => {
      const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);
      const targetYear = goal.targetDate ? new Date(goal.targetDate).getFullYear() : new Date().getFullYear() + 5;
      const yearsLeft = Math.max(1, targetYear - new Date().getFullYear());
      
      const monthlyRequiredCurrent = remainingAmount / (yearsLeft * 12);
      
      // Suggest optimized schedule with standard 8% investment return expectation
      const monthlyRequiredOptimized = (remainingAmount * (0.08 / 12)) / (Math.pow(1 + 0.08 / 12, yearsLeft * 12) - 1) || monthlyRequiredCurrent;
      
      const isFeasible = monthlyRequiredOptimized < 50000; // threshold benchmark

      // Schedule distribution
      const optimizedContributionSchedule = Array.from({ length: yearsLeft }, (_, i) => ({
        year: new Date().getFullYear() + i,
        contribution: Math.round(monthlyRequiredOptimized * 12),
      }));

      const recommendation = isFeasible 
        ? `Invest ₹${Math.round(monthlyRequiredOptimized)} monthly in hybrid index funds to hit target on schedule.`
        : `Extend goal timeline by ${Math.ceil(yearsLeft * 0.5)} years to keep monthly contribution budget friendly.`;

      return {
        goalId: goal.id,
        name: goal.name,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        targetYear,
        monthlyRequiredCurrent: Math.round(monthlyRequiredCurrent),
        monthlyRequiredOptimized: Math.round(monthlyRequiredOptimized),
        isFeasible,
        optimizedContributionSchedule,
        recommendation,
      };
    });
  }
}


// --- 5. DEBT OPTIMIZATION ENGINE ---
export class DebtOptimizationEngine {
  /**
   * Simulates Avalanche (highest interest rate first) and Snowball (lowest balance first) pay-off strategies.
   */
  public static optimizeDebt(state: State, monthlySurplusCash: number = 15000): DebtOptimizationReport {
    const loans = state.loans ?? [];
    
    // Sort loans
    const avalancheSorted = [...loans].sort((a, b) => b.rate - a.rate);
    const snowballSorted = [...loans].sort((a, b) => a.outstanding - b.outstanding);

    // Initial total debt calculations
    const totalPrincipal = loans.reduce((s, l) => s + l.principal, 0);
    const totalOutstanding = loans.reduce((s, l) => s + l.outstanding, 0);
    const baseMonthlyEmi = loans.reduce((s, l) => s + l.emi, 0);

    // Current Payoff Projections (no extra payments)
    let totalInterestPaidCurrent = 0;
    loans.forEach((loan) => {
      const monthlyRate = (loan.rate / 12) / 100;
      let outstanding = loan.outstanding;
      for (let m = 0; m < loan.tenureMonths; m++) {
        const interest = outstanding * monthlyRate;
        totalInterestPaidCurrent += interest;
        const principalPaid = Math.max(0, loan.emi - interest);
        outstanding = Math.max(0, outstanding - principalPaid);
        if (outstanding <= 0) break;
      }
    });

    // Strategy Projections (avalanche vs snowball)
    let avalancheInterest = 0;
    let snowballInterest = 0;
    const schedule: DebtStrategyPoint[] = [];

    let avOutstanding = avalancheSorted.map((l) => ({ ...l }));
    let sbOutstanding = snowballSorted.map((l) => ({ ...l }));

    for (let month = 1; month <= 180; month++) {
      // Avalanche step
      let avMonthInterest = 0;
      let avMonthRemaining = 0;
      let avSurplus = monthlySurplusCash;

      // 1. Pay standard EMI
      avOutstanding.forEach((l) => {
        if (l.outstanding <= 0) return;
        const interest = l.outstanding * ((l.rate / 12) / 100);
        avMonthInterest += interest;
        avalancheInterest += interest;
        const standardPrincipal = Math.min(l.outstanding, l.emi - interest);
        l.outstanding -= standardPrincipal;
      });

      // 2. Inject extra cash to highest interest rate active loan
      for (const l of avOutstanding) {
        if (l.outstanding > 0) {
          const extraPayment = Math.min(l.outstanding, avSurplus);
          l.outstanding -= extraPayment;
          avSurplus -= extraPayment;
          if (avSurplus <= 0) break;
        }
      }
      avMonthRemaining = avOutstanding.reduce((s, l) => s + Math.max(0, l.outstanding), 0);

      // Snowball step
      let sbMonthInterest = 0;
      let sbMonthRemaining = 0;
      let sbSurplus = monthlySurplusCash;

      // 1. Pay standard EMI
      sbOutstanding.forEach((l) => {
        if (l.outstanding <= 0) return;
        const interest = l.outstanding * ((l.rate / 12) / 100);
        sbMonthInterest += interest;
        snowballInterest += interest;
        const standardPrincipal = Math.min(l.outstanding, l.emi - interest);
        l.outstanding -= standardPrincipal;
      });

      // 2. Inject extra cash to lowest balance active loan
      for (const l of sbOutstanding) {
        if (l.outstanding > 0) {
          const extraPayment = Math.min(l.outstanding, sbSurplus);
          l.outstanding -= extraPayment;
          sbSurplus -= extraPayment;
          if (sbSurplus <= 0) break;
        }
      }
      sbMonthRemaining = sbOutstanding.reduce((s, l) => s + Math.max(0, l.outstanding), 0);

      schedule.push({
        month,
        avalancheRemainingDebt: Math.round(avMonthRemaining),
        snowballRemainingDebt: Math.round(sbMonthRemaining),
        avalancheTotalPaid: Math.round(baseMonthlyEmi + monthlySurplusCash) * month,
        snowballTotalPaid: Math.round(baseMonthlyEmi + monthlySurplusCash) * month,
      });

      if (avMonthRemaining <= 0 && sbMonthRemaining <= 0) break;
    }

    const avMonths = schedule.findIndex((s) => s.avalancheRemainingDebt <= 0) + 1;
    const sbMonths = schedule.findIndex((s) => s.snowballRemainingDebt <= 0) + 1;

    const currentMonths = loans.reduce((m, l) => Math.max(m, l.tenureMonths), 0);

    const formatMonths = (mCount: number) => {
      const yrs = Math.floor(mCount / 12);
      const m = mCount % 12;
      return yrs > 0 ? `${yrs} yrs, ${m} mos` : `${m} mos`;
    };

    // Refinance opportunities
    const refinancingSuggestions = loans
      .filter((l) => l.rate > 9.5)
      .map((l) => ({
        loanId: l.id,
        loanName: l.name,
        currentRate: l.rate,
        recommendedRate: 8.4, // standard market interest target
        estimatedSavings: Math.round(l.outstanding * (l.rate - 8.4) * 0.01 * (l.tenureMonths / 12)),
        actionLabel: `Refinance ${l.name}`,
      }));

    return {
      currentDebtFreeDate: formatMonths(currentMonths),
      avalancheDebtFreeDate: avMonths > 0 ? formatMonths(avMonths) : "None",
      snowballDebtFreeDate: sbMonths > 0 ? formatMonths(sbMonths) : "None",
      totalInterestPaidCurrent: Math.round(totalInterestPaidCurrent),
      totalInterestPaidAvalanche: Math.round(avalancheInterest),
      totalInterestPaidSnowball: Math.round(snowballInterest),
      avalancheSavingsInterest: Math.round(Math.max(0, totalInterestPaidCurrent - avalancheInterest)),
      snowballSavingsInterest: Math.round(Math.max(0, totalInterestPaidCurrent - snowballInterest)),
      strategySchedule: schedule.slice(0, 36), // output preview limited
      refinancingSuggestions,
    };
  }
}


// --- 6. INSURANCE ANALYSIS ---
export class InsuranceAnalysis {
  /**
   * Performs check on insurance policies and determines coverage adequacy.
   */
  public static auditInsurance(state: State): InsuranceAudit {
    const investments = state.investments ?? [];
    
    // Extract actual coverages
    let lifeCoverageActual = 0;
    let healthCoverageActual = 0;

    investments.forEach((inv) => {
      const lowerName = inv.name.toLowerCase();
      const value = inv.units * inv.currentPrice;
      
      if (lowerName.includes("term insurance") || lowerName.includes("life insurance")) {
        lifeCoverageActual += value || 10000000; // estimate
      } else if (lowerName.includes("health") || lowerName.includes("medical")) {
        healthCoverageActual += value || 500000;
      }
    });

    // Coverage target recommendations based on expenses
    const recentTxns = (state.transactions ?? []).filter((t) => {
      const limit = new Date();
      limit.setMonth(limit.getMonth() - 3);
      return new Date(t.date) >= limit;
    });

    const averageSalary = recentTxns.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0) / 3 || 100000;
    const lifeCoverageRecommended = averageSalary * 12 * 12; // 12x annual income target
    const healthCoverageRecommended = 1000000; // 10L recommended base

    const lifeGap = Math.max(0, lifeCoverageRecommended - lifeCoverageActual);
    const healthGap = Math.max(0, healthCoverageRecommended - healthCoverageActual);

    const gapsIdentified: string[] = [];
    let score = 100;

    if (lifeGap > 0) {
      score -= 40;
      gapsIdentified.push(`Life coverage gap of ₹${(lifeGap / 100000).toFixed(1)} Lakhs detected.`);
    }
    if (healthGap > 0) {
      score -= 30;
      gapsIdentified.push(`Health insurance gap of ₹${(healthGap / 100000).toFixed(1)} Lakhs detected.`);
    }

    return {
      lifeCoverageRecommended: Math.round(lifeCoverageRecommended),
      lifeCoverageActual,
      lifeGap: Math.round(lifeGap),
      healthCoverageRecommended,
      healthCoverageActual,
      healthGap: Math.round(healthGap),
      insuranceScore: Math.max(10, score),
      gapsIdentified,
    };
  }
}


// --- 7. FINANCIAL CALENDAR ---
export class FinancialCalendar {
  /**
   * Generates localized deadlines and payment dates.
   */
  public static generateCalendar(state: State): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const today = new Date();

    // Standard Tax Due Dates (India context)
    events.push({
      id: "cal_tax_1",
      date: `${today.getFullYear()}-07-31`,
      title: "Income Tax Return (ITR) Filing",
      type: "tax",
      description: "Final filing deadline for standard Individual ITR submissions.",
      importance: "high",
    });
    events.push({
      id: "cal_tax_2",
      date: `${today.getFullYear()}-09-15`,
      title: "Second Installment of Advance Tax",
      type: "tax",
      description: "Pay 45% of estimated total annual tax liabilities.",
      importance: "medium",
    });
    events.push({
      id: "cal_tax_3",
      date: `${today.getFullYear()}-12-15`,
      title: "Third Installment of Advance Tax",
      type: "tax",
      description: "Pay 75% of estimated total annual tax liabilities.",
      importance: "medium",
    });

    // Loan EMI dates
    const loans = state.loans ?? [];
    loans.forEach((l) => {
      events.push({
        id: `cal_emi_${l.id}`,
        date: `${today.toISOString().slice(0, 7)}-05`, // standard 5th
        title: `EMI Payment: ${l.name}`,
        type: "emi",
        amount: l.emi,
        description: `Monthly loan amortization payment. Outstanding: ₹${l.outstanding.toLocaleString()}`,
        importance: "high",
      });
    });

    // Bill dates
    const bills = state.bills ?? [];
    bills.forEach((b) => {
      events.push({
        id: `cal_bill_${b.id}`,
        date: b.dueDate,
        title: `Bill Due: ${b.name}`,
        type: "bill",
        amount: b.amount,
        description: `Recurring payment obligation for ${b.category}`,
        importance: b.amount > 5000 ? "high" : "low",
      });
    });

    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
}


// --- 8. SCENARIO PLANNING ---
export class ScenarioPlanning {
  /**
   * Projects scenarios comparing Current, Projected, and Recommended plans.
   */
  public static simulateScenario(state: State, scenarioName: string): ScenarioResult {
    const wealth = WealthEngine.analyzeWealth(state);
    
    let description = "";
    let impactOnNetWorthAtRetirement = 0;
    let impactOnFiTimelineYears = 0;
    let emergencyFundAdequacy: "Adequate" | "Deficient" = "Adequate";
    const recommendations: string[] = [];

    const cashReserves = SelectorEngine.getTotalAccountBalance(state);

    if (scenarioName === "Job Loss") {
      description = "Simulates sudden loss of primary wage income for 6 months.";
      impactOnNetWorthAtRetirement = -500000;
      impactOnFiTimelineYears = 1.5;
      emergencyFundAdequacy = cashReserves > 300000 ? "Adequate" : "Deficient";
      recommendations.push("Pause all non-essential investments (SIPs).");
      recommendations.push("Establish cash reserves of at least 6 months of living expenses.");
    } else if (scenarioName === "Salary Increase") {
      description = "Simulates a 20% bump in recurring wage income.";
      impactOnNetWorthAtRetirement = 4500000;
      impactOnFiTimelineYears = -3.5;
      recommendations.push("Avoid lifestyle inflation: channel 60% of the raise to equity index SIPs.");
      recommendations.push("Consider maximizing tax savings via NPS u/s 80CCD(1B).");
    } else {
      description = "Generic life planning simulation.";
      recommendations.push("Review investment allocations quarterly.");
    }

    return {
      name: scenarioName,
      description,
      impactOnNetWorthAtRetirement,
      impactOnFiTimelineYears,
      emergencyFundAdequacy,
      currentPlanNetWorth5Year: Math.round(wealth.currentNetWorth * 1.5),
      projectedPlanNetWorth5Year: Math.round(wealth.currentNetWorth * 1.4),
      recommendedPlanNetWorth5Year: Math.round(wealth.currentNetWorth * 1.7),
      recommendations,
    };
  }
}

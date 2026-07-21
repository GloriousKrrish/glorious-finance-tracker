import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore, uid } from "@/lib/store";
import { formatINR } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  TaxEngine,
  WealthEngine,
  RetirementEngine,
  GoalOptimizationEngine,
  DebtOptimizationEngine,
  InsuranceAnalysis,
  FinancialCalendar,
  ScenarioPlanningEngine,
  SelectorEngine
} from "@/lib/financial-engine";
import {
  Calculator,
  TrendingUp,
  Award,
  Calendar,
  AlertOctagon,
  Percent,
  CheckCircle,
  HelpCircle,
  Download,
  Info,
  DollarSign,
  Briefcase,
  Flame,
  ArrowRight,
  Shield,
  Clock
} from "lucide-react";

export const Route = createFileRoute("/planning")({
  head: () => ({ meta: [{ title: "Planning & Taxes · GloriousFinance" }] }),
  component: PlanningPage,
});

function PlanningPage() {
  const { state } = useStore();

  // Custom User Inputs for Tax calculations
  const [grossIncome, setGrossIncome] = useState(1200000);
  const [deductions80C, setDeductions80C] = useState(120000);
  const [deductions80D, setDeductions80D] = useState(15000);
  const [deductions80CCD, setDeductions80CCD] = useState(25000);
  const [deductions24b, setDeductions24b] = useState(50000);
  const [deductionsHRA, setDeductionsHRA] = useState(40000);
  const [deductionsOther, setDeductionsOther] = useState(10000);

  // Wealth & Retirement assumptions
  const [monthlySavings, setMonthlySavings] = useState(30000);
  const [retirementAge, setRetirementAge] = useState(58);
  const [growthExpectation, setGrowthExpectation] = useState(12);

  // Scenario Sandbox selection
  const [selectedScenario, setSelectedScenario] = useState("Salary Increase");

  // Debt Optimization surplus assumptions
  const [surplusDebtPay, setSurplusDebtPay] = useState(20000);

  // 1. Tax Calculation
  const taxPlan = useMemo(() => {
    return TaxEngine.calculateIndiaTax(grossIncome, {
      sec80C: deductions80C,
      sec80D: deductions80D,
      sec80CCD: deductions80CCD,
      sec24b: deductions24b,
      hra: deductionsHRA,
      other: deductionsOther
    });
  }, [grossIncome, deductions80C, deductions80D, deductions80CCD, deductions24b, deductionsHRA, deductionsOther]);

  // 2. Wealth Analysis
  const wealthAnalysis = useMemo(() => {
    return WealthEngine.analyzeWealth(state, monthlySavings, growthExpectation, 6);
  }, [state, monthlySavings, growthExpectation]);

  // 3. Retirement Analysis
  const retirementAnalysis = useMemo(() => {
    return RetirementEngine.calculateRetirement(state, 30, retirementAge, 60000, growthExpectation, 6);
  }, [state, retirementAge, growthExpectation]);

  // 4. Goal Optimizations
  const optimizedGoals = useMemo(() => {
    return GoalOptimizationEngine.optimizeGoals(state);
  }, [state]);

  // 5. Debt Optimizations
  const debtOptimization = useMemo(() => {
    return DebtOptimizationEngine.optimizeDebt(state, surplusDebtPay);
  }, [state, surplusDebtPay]);

  // 6. Insurance Audit
  const insuranceAudit = useMemo(() => {
    return InsuranceAnalysis.auditInsurance(state);
  }, [state]);

  // 7. Calendar Schedule
  const calendarEvents = useMemo(() => {
    return FinancialCalendar.generateCalendar(state);
  }, [state]);

  // 8. Scenario comparison
  const scenarioResult = useMemo(() => {
    return ScenarioPlanningEngine.simulateScenario(state, selectedScenario);
  }, [state, selectedScenario]);

  // PDF Export Flow
  const handleExportPlan = () => {
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const w = doc.internal.pageSize.getWidth();
      const margin = 40;

      // Cover Page / Header Banner
      doc.setFillColor(26, 54, 93); // navy
      doc.rect(0, 0, w, 110, "F");
      
      doc.setFillColor(212, 175, 55); // gold
      doc.rect(0, 110, w, 5, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("PERSONAL FINANCIAL PLANNING PORTAL", margin, 45);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Unified Multi-Goal Projection, Tax Optimization, and Wealth Audit Report", margin, 65);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, margin, 85);

      let y = 140;

      // Section 1: Wealth & FI Summary
      doc.setTextColor(26, 54, 93);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("1. WEALTH AUDIT & FINANCIAL INDEPENDENCE PROGRESS", margin, y);
      y += 20;

      const wealthRows = [
        ["Current Net Worth", formatINR(wealthAnalysis.currentNetWorth)],
        ["Wealth Score (0-100)", `${wealthAnalysis.wealthScore}/100`],
        ["Calculated Savings Rate", `${wealthAnalysis.savingsRate}%`],
        ["Financial Independence Target Corpus", formatINR(wealthAnalysis.fiCorpusTarget)],
        ["Estimated Years to Financial Independence", `${wealthAnalysis.yearsToFi} years`],
      ];

      autoTable(doc, {
        startY: y,
        head: [["Metric Parameter", "Value"]],
        body: wealthRows,
        theme: "striped",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: [26, 54, 93], textColor: 255 },
      });

      y = (doc as any).lastAutoTable.finalY + 30;

      // Section 2: Tax Optimization
      doc.setTextColor(26, 54, 93);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("2. REGIME COMPARISON & TAX SAVING TAX OPPORTUNITIES", margin, y);
      y += 20;

      const taxRows = [
        ["Assumed Gross Annual Income", formatINR(grossIncome)],
        ["Old Regime Tax Liability", formatINR(taxPlan.oldRegimeResult.totalTax)],
        ["New Regime Tax Liability", formatINR(taxPlan.newRegimeResult.totalTax)],
        ["Optimal Choice", `${taxPlan.optimalRegime.toUpperCase()} REGIME`],
        ["Estimated Annual Tax Savings", formatINR(taxPlan.taxSavingsWithOptimalRegime)],
      ];

      autoTable(doc, {
        startY: y,
        head: [["Tax Metric", "Value"]],
        body: taxRows,
        theme: "striped",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: [26, 54, 93], textColor: 255 },
      });

      y = (doc as any).lastAutoTable.finalY + 30;

      // Section 3: Goal & Debt Optimization
      doc.setTextColor(26, 54, 93);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("3. DEBT PAYOFF AND AMORTIZATION OPTIMIZATION", margin, y);
      y += 20;

      const debtRows = [
        ["Current Projected Debt Free Timeline", debtOptimization.currentDebtFreeDate],
        ["Avalanche Strategy Debt Free Timeline", debtOptimization.avalancheDebtFreeDate],
        ["Snowball Strategy Debt Free Timeline", debtOptimization.snowballDebtFreeDate],
        ["Potential Interest Savings (Avalanche)", formatINR(debtOptimization.avalancheSavingsInterest)],
      ];

      autoTable(doc, {
        startY: y,
        head: [["Strategy Parameter", "Projection"]],
        body: debtRows,
        theme: "striped",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: [26, 54, 93], textColor: 255 },
      });

      // Save PDF
      doc.save(`GloriousFinance-PersonalPlan-${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success("Comprehensive Financial Plan PDF downloaded successfully");
    } catch (e: any) {
      toast.error(`Export failed: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Planning & Wealth Portal"
        subtitle="Perform multi-decade simulations, run tax regime audits, optimize debts, and review insurance coverage gaps."
        action={
          <Button onClick={handleExportPlan} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Plan PDF
          </Button>
        }
      />

      <div className="grid gap-6 px-6 md:px-10 lg:grid-cols-4">
        {/* KPI Panel */}
        <Card className="card-luxe p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-semibold uppercase tracking-wider">FI Progress</span>
            <Flame className="h-4 w-4 text-orange-500" />
          </div>
          <div className="mt-2">
            <div className="font-numeric text-3xl font-bold text-foreground">
              {wealthAnalysis.financialIndependenceProgress}%
            </div>
            <Progress value={wealthAnalysis.financialIndependenceProgress} className="h-1.5 mt-2 bg-muted/60" />
          </div>
          <div className="text-[10px] text-muted-foreground mt-3">
            {wealthAnalysis.yearsToFi === 99
              ? "Corpus target requires higher savings"
              : `FI target hit in ~${wealthAnalysis.yearsToFi} years`}
          </div>
        </Card>

        <Card className="card-luxe p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Retirement Readiness</span>
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2">
            <div className="font-numeric text-3xl font-bold text-foreground">
              {retirementAnalysis.retirementReadinessScore}/100
            </div>
            <Progress value={retirementAnalysis.retirementReadinessScore} className="h-1.5 mt-2 bg-muted/60" />
          </div>
          <div className="text-[10px] text-muted-foreground mt-3">
            Target Corpus: {formatINR(retirementAnalysis.targetCorpus, { compact: true })}
          </div>
        </Card>

        <Card className="card-luxe p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Tax Optimization</span>
            <Calculator className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2">
            <div className="font-numeric text-3xl font-bold text-foreground">
              {formatINR(taxPlan.taxSavingsWithOptimalRegime, { compact: true })}
            </div>
            <div className="text-xs font-semibold text-emerald-500 mt-2">
              Optimal: {taxPlan.optimalRegime.toUpperCase()} Regime
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground mt-3">
            Saves tax compared to other regimes
          </div>
        </Card>

        <Card className="card-luxe p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Wealth Score</span>
            <Award className="h-4 w-4 text-gold" />
          </div>
          <div className="mt-2">
            <div className="font-numeric text-3xl font-bold text-foreground">
              {wealthAnalysis.wealthScore}/100
            </div>
            <Progress value={wealthAnalysis.wealthScore} className="h-1.5 mt-2 bg-muted/60" />
          </div>
          <div className="text-[10px] text-muted-foreground mt-3">
            Savings rate: {wealthAnalysis.savingsRate}% · Debt ratio: {wealthAnalysis.debtToAssetRatio}%
          </div>
        </Card>
      </div>

      <div className="px-6 pb-10 md:px-10">
        <Tabs defaultValue="taxes" className="w-full">
          <TabsList className="bg-muted/30 border border-border/40 p-1 mb-6 rounded-lg overflow-x-auto flex">
            <TabsTrigger value="taxes" className="rounded-md px-4 py-1.5 text-xs flex-1">Tax Engine</TabsTrigger>
            <TabsTrigger value="wealth" className="rounded-md px-4 py-1.5 text-xs flex-1">Wealth & projections</TabsTrigger>
            <TabsTrigger value="debt" className="rounded-md px-4 py-1.5 text-xs flex-1">Debt payoff</TabsTrigger>
            <TabsTrigger value="goals" className="rounded-md px-4 py-1.5 text-xs flex-1">Goals optimize</TabsTrigger>
            <TabsTrigger value="insurance" className="rounded-md px-4 py-1.5 text-xs flex-1">Insurance Gap</TabsTrigger>
            <TabsTrigger value="scenario" className="rounded-md px-4 py-1.5 text-xs flex-1">Sandbox Simulator</TabsTrigger>
            <TabsTrigger value="calendar" className="rounded-md px-4 py-1.5 text-xs flex-1">Calendar</TabsTrigger>
          </TabsList>

          {/* 1. Tax Engine Content */}
          <TabsContent value="taxes" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="card-luxe p-6 space-y-4 col-span-1">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">Tax Input Parameters</h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <Label className="text-xs">Annual Gross Income (₹)</Label>
                    <Input type="number" step="10000" value={grossIncome} onChange={(e) => setGrossIncome(parseFloat(e.target.value) || 0)} className="bg-muted/40 border border-border/80" />
                  </div>
                  <div>
                    <Label className="text-xs">Section 80C (PPF/ELSS/EPF) (₹)</Label>
                    <Input type="number" step="5000" value={deductions80C} onChange={(e) => setDeductions80C(parseFloat(e.target.value) || 0)} className="bg-muted/40 border border-border/80" />
                  </div>
                  <div>
                    <Label className="text-xs">Section 80CCD (NPS Premium) (₹)</Label>
                    <Input type="number" step="5000" value={deductions80CCD} onChange={(e) => setDeductions80CCD(parseFloat(e.target.value) || 0)} className="bg-muted/40 border border-border/80" />
                  </div>
                  <div>
                    <Label className="text-xs">Section 80D (Health Premium) (₹)</Label>
                    <Input type="number" step="1000" value={deductions80D} onChange={(e) => setDeductions80D(parseFloat(e.target.value) || 0)} className="bg-muted/40 border border-border/80" />
                  </div>
                  <div>
                    <Label className="text-xs">Section 24b (Home Loan Interest) (₹)</Label>
                    <Input type="number" step="5000" value={deductions24b} onChange={(e) => setDeductions24b(parseFloat(e.target.value) || 0)} className="bg-muted/40 border border-border/80" />
                  </div>
                  <div>
                    <Label className="text-xs">HRA Deductions Claimed (₹)</Label>
                    <Input type="number" step="5000" value={deductionsHRA} onChange={(e) => setDeductionsHRA(parseFloat(e.target.value) || 0)} className="bg-muted/40 border border-border/80" />
                  </div>
                </div>
              </Card>

              <Card className="card-luxe p-6 space-y-4 col-span-2">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">Regime Optimization breakdown</h3>
                
                <div className="grid gap-4 grid-cols-2">
                  <div className="border border-border/50 rounded-lg p-4 bg-muted/10">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Old Income Tax Regime</div>
                    <div className="font-numeric text-xl font-bold mt-2 text-foreground">{formatINR(taxPlan.oldRegimeResult.totalTax)}</div>
                    <div className="text-[10px] text-muted-foreground mt-2">Deductions: {formatINR(taxPlan.oldRegimeResult.deductions)}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">Marginal rate: {taxPlan.oldRegimeResult.marginalRate}%</div>
                  </div>
                  <div className="border border-indigo-500/20 bg-indigo-500/5 rounded-lg p-4">
                    <div className="text-xs font-semibold text-indigo-400 uppercase">New Income Tax Regime</div>
                    <div className="font-numeric text-xl font-bold mt-2 text-foreground">{formatINR(taxPlan.newRegimeResult.totalTax)}</div>
                    <div className="text-[10px] text-muted-foreground mt-2 font-medium">Deductions Allowed: Standard (₹75k)</div>
                    <div className="text-[10px] text-muted-foreground mt-1">Marginal rate: {taxPlan.newRegimeResult.marginalRate}%</div>
                  </div>
                </div>

                <div className="mt-6 border-t border-border/50 pt-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">AI Tax saving recommendations</h4>
                  {taxPlan.savingOpportunities.map((op) => (
                    <div key={op.code} className="flex justify-between items-center text-xs p-3 bg-muted/20 rounded-md border border-border/50">
                      <div>
                        <div className="font-semibold text-foreground">{op.description}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Gap to fulfill: {formatINR(op.recommendedInvestment)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-emerald-500">Saves {formatINR(op.potentialSavings)}</div>
                        <Badge className="mt-1 text-[9px] font-medium uppercase px-2 py-0.5 rounded-full">{op.actionLabel}</Badge>
                      </div>
                    </div>
                  ))}
                  {taxPlan.savingOpportunities.length === 0 && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      All standard tax saving deductions have been fully maximized.
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* 2. Wealth & Retirement Content */}
          <TabsContent value="wealth" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="card-luxe p-6 space-y-4">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">Simulations Inputs</h3>
                <div className="space-y-4 text-xs">
                  <div>
                    <Label className="text-xs">Assumed Monthly Savings (₹)</Label>
                    <Input type="number" step="5000" value={monthlySavings} onChange={(e) => setMonthlySavings(parseFloat(e.target.value) || 0)} className="bg-muted/40 border border-border/80" />
                  </div>
                  <div>
                    <Label className="text-xs">Target Retirement Age</Label>
                    <Input type="number" value={retirementAge} onChange={(e) => setRetirementAge(parseInt(e.target.value) || 0)} className="bg-muted/40 border border-border/80" />
                  </div>
                  <div>
                    <Label className="text-xs">Projected CAGR Return (%)</Label>
                    <Input type="number" value={growthExpectation} onChange={(e) => setGrowthExpectation(parseFloat(e.target.value) || 0)} className="bg-muted/40 border border-border/80" />
                  </div>
                </div>

                <div className="border-t border-border/50 pt-4 text-xs space-y-3">
                  <div className="font-semibold text-foreground uppercase tracking-wider text-[10px]">Asset Allocation Mix</div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Equity:</span>
                      <span className="font-semibold text-foreground">{wealthAnalysis.assetAllocation.equity}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fixed Income:</span>
                      <span className="font-semibold text-foreground">{wealthAnalysis.assetAllocation.fixedIncome}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cash:</span>
                      <span className="font-semibold text-foreground">{wealthAnalysis.assetAllocation.cash}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gold/Silver:</span>
                      <span className="font-semibold text-foreground">{wealthAnalysis.assetAllocation.gold}%</span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="card-luxe p-6 col-span-2 space-y-4">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">Long-Term Wealth simulations (50-year horizon)</h3>
                <div className="overflow-y-auto max-h-[300px] border border-border/60 rounded-md">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 border-b border-border/50 uppercase tracking-wider text-[10px] text-muted-foreground">
                      <tr>
                        <th className="p-3">Year</th>
                        <th className="p-3">Age</th>
                        <th className="p-3 text-right">Projected Net Worth</th>
                        <th className="p-3 text-right">Invested Capital</th>
                        <th className="p-3 text-right">SWR Monthly Income</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {wealthAnalysis.simulation.filter((_, idx) => idx % 5 === 0).map((pt) => (
                        <tr key={pt.year} className="hover:bg-muted/10">
                          <td className="p-3 font-semibold">{pt.year}</td>
                          <td className="p-3">{pt.age}</td>
                          <td className="p-3 text-right font-semibold font-numeric text-foreground">{formatINR(pt.netWorth, { compact: true })}</td>
                          <td className="p-3 text-right font-numeric text-muted-foreground">{formatINR(pt.investedCapital, { compact: true })}</td>
                          <td className="p-3 text-right font-numeric text-emerald-500 font-semibold">{formatINR(pt.passiveIncome, { compact: true })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* 3. Debt Optimization Content */}
          <TabsContent value="debt" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="card-luxe p-6 space-y-4">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">Amortization Surplus</h3>
                <div className="text-xs space-y-4">
                  <div>
                    <Label className="text-xs">Monthly Surplus Payment (₹)</Label>
                    <Input type="number" step="2000" value={surplusDebtPay} onChange={(e) => setSurplusDebtPay(parseFloat(e.target.value) || 0)} className="bg-muted/40 border border-border/80" />
                  </div>
                  <div className="border-t border-border/50 pt-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Baseline Payoff:</span>
                      <span className="font-semibold text-foreground">{debtOptimization.currentDebtFreeDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avalanche Method:</span>
                      <span className="font-semibold text-emerald-500">{debtOptimization.avalancheDebtFreeDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Snowball Method:</span>
                      <span className="font-semibold text-indigo-500">{debtOptimization.snowballDebtFreeDate}</span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="card-luxe p-6 col-span-2 space-y-4">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">Interest Savings & Refinancing Suggestions</h3>
                <div className="grid gap-4 grid-cols-2">
                  <div className="border border-border/50 rounded-lg p-4 bg-muted/10">
                    <div className="text-xs text-muted-foreground uppercase">Interest saved via Avalanche</div>
                    <div className="font-numeric text-xl font-bold mt-2 text-emerald-500">{formatINR(debtOptimization.avalancheSavingsInterest)}</div>
                  </div>
                  <div className="border border-border/50 rounded-lg p-4 bg-muted/10">
                    <div className="text-xs text-muted-foreground uppercase">Interest saved via Snowball</div>
                    <div className="font-numeric text-xl font-bold mt-2 text-indigo-400">{formatINR(debtOptimization.snowballSavingsInterest)}</div>
                  </div>
                </div>

                <div className="border-t border-border/50 pt-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Refinance Options</h4>
                  {debtOptimization.refinancingSuggestions.map((refi) => (
                    <div key={refi.loanId} className="flex justify-between items-center text-xs p-3 bg-muted/15 rounded-md border border-border/40">
                      <div>
                        <div className="font-semibold text-foreground">{refi.loanName} Refinance opportunity</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Reduce rate from {refi.currentRate}% to {refi.recommendedRate}%</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-emerald-500">Saves ~{formatINR(refi.estimatedSavings)}</div>
                        <Badge variant="outline" className="mt-1 text-[9px] px-2 py-0.5 rounded-full border-primary/30 text-primary">{refi.actionLabel}</Badge>
                      </div>
                    </div>
                  ))}
                  {debtOptimization.refinancingSuggestions.length === 0 && (
                    <div className="text-xs text-muted-foreground">No refinance options available. All active loan rates are within optimal ranges.</div>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* 4. Goal Optimization Content */}
          <TabsContent value="goals" className="space-y-6">
            <Card className="card-luxe p-6 space-y-4">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">Goal Optimization schedules</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 border-b border-border/50 uppercase tracking-wider text-[10px] text-muted-foreground">
                    <tr>
                      <th className="p-3">Goal Name</th>
                      <th className="p-3 text-right">Target Amount</th>
                      <th className="p-3 text-right">Current Accumulation</th>
                      <th className="p-3 text-right">Default Monthly</th>
                      <th className="p-3 text-right">Optimized Monthly</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Plan Recommendations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {optimizedGoals.map((g) => (
                      <tr key={g.goalId} className="hover:bg-muted/10">
                        <td className="p-3 font-semibold">{g.name}</td>
                        <td className="p-3 text-right font-numeric">{formatINR(g.targetAmount)}</td>
                        <td className="p-3 text-right font-numeric text-muted-foreground">{formatINR(g.currentAmount)}</td>
                        <td className="p-3 text-right font-numeric">{formatINR(g.monthlyRequiredCurrent)}</td>
                        <td className="p-3 text-right font-numeric font-semibold text-emerald-500">{formatINR(g.monthlyRequiredOptimized)}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={`text-[9px] px-2 py-0.5 rounded-full ${g.isFeasible ? "border-success/30 text-success bg-success/5" : "border-destructive/30 text-destructive bg-destructive/5"}`}>
                            {g.isFeasible ? "Feasible" : "Extended"}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground max-w-[280px] truncate">{g.recommendation}</td>
                      </tr>
                    ))}
                    {optimizedGoals.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-muted-foreground">No active goals configured.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* 5. Insurance Content */}
          <TabsContent value="insurance" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="card-luxe p-6 space-y-4">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">Insurance Adequacy Audit</h3>
                <div className="mt-4 flex flex-col items-center">
                  <div className="relative flex items-center justify-center">
                    <svg className="w-24 h-24 transform -rotate-90">
                      <circle cx="48" cy="48" r="40" stroke="currentColor" className="text-muted/20" strokeWidth="6" fill="transparent" />
                      <circle cx="48" cy="48" r="40" stroke="currentColor" className="text-primary" strokeWidth="6" fill="transparent"
                        strokeDasharray={251.2}
                        strokeDashoffset={251.2 - (251.2 * insuranceAudit.insuranceScore) / 100}
                      />
                    </svg>
                    <span className="absolute font-display text-xl font-bold text-foreground">{insuranceAudit.insuranceScore}</span>
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase mt-3">Insurance Score</div>
                </div>
              </Card>

              <Card className="card-luxe p-6 col-span-2 space-y-4">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">Coverage Analysis Gaps</h3>
                <div className="grid gap-4 grid-cols-2">
                  <div className="border border-border/50 rounded-lg p-4 bg-muted/10">
                    <div className="text-xs text-muted-foreground uppercase">Life Insurance Coverage</div>
                    <div className="text-xs mt-2">Recommended: {formatINR(insuranceAudit.lifeCoverageRecommended, { compact: true })}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Actual cover: {formatINR(insuranceAudit.lifeCoverageActual, { compact: true })}</div>
                    {insuranceAudit.lifeGap > 0 ? (
                      <div className="text-xs text-red-500 font-semibold mt-2">Gap: {formatINR(insuranceAudit.lifeGap, { compact: true })}</div>
                    ) : (
                      <div className="text-xs text-success font-semibold mt-2">Adequate Coverage</div>
                    )}
                  </div>
                  <div className="border border-border/50 rounded-lg p-4 bg-muted/10">
                    <div className="text-xs text-muted-foreground uppercase">Health Insurance Coverage</div>
                    <div className="text-xs mt-2">Recommended: {formatINR(insuranceAudit.healthCoverageRecommended, { compact: true })}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Actual cover: {formatINR(insuranceAudit.healthCoverageActual, { compact: true })}</div>
                    {insuranceAudit.healthGap > 0 ? (
                      <div className="text-xs text-red-500 font-semibold mt-2">Gap: {formatINR(insuranceAudit.healthGap, { compact: true })}</div>
                    ) : (
                      <div className="text-xs text-success font-semibold mt-2">Adequate Coverage</div>
                    )}
                  </div>
                </div>

                <div className="border-t border-border/50 pt-4 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Identified Gaps</h4>
                  {insuranceAudit.gapsIdentified.map((gap, index) => (
                    <div key={index} className="text-xs text-red-500 font-medium flex items-center gap-1">
                      <AlertOctagon className="h-4 w-4 shrink-0" />
                      {gap}
                    </div>
                  ))}
                  {insuranceAudit.gapsIdentified.length === 0 && (
                    <div className="text-xs text-success font-semibold">No insurance gaps detected. You are fully insured!</div>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* 6. Scenario Sandbox Content */}
          <TabsContent value="scenario" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="card-luxe p-6 space-y-4">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">Scenario Settings</h3>
                <div className="space-y-3">
                  <Label className="text-xs">Choose Planning Scenario</Label>
                  <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                    <SelectTrigger className="bg-muted/40 border-border/80 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Job Loss">Job Loss (6-Month Reserve Hit)</SelectItem>
                      <SelectItem value="Salary Increase">Salary Increase (+20% Wage)</SelectItem>
                      <SelectItem value="House Purchase">House Purchase (Downpayment)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Card>

              <Card className="card-luxe p-6 col-span-2 space-y-4">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">Comparative plan outputs</h3>
                <div className="text-xs">{scenarioResult.description}</div>
                
                <div className="grid gap-4 grid-cols-3 text-xs">
                  <div className="border border-border/50 rounded-lg p-3 bg-muted/10">
                    <div className="text-[10px] text-muted-foreground uppercase">Current Plan</div>
                    <div className="font-numeric text-base font-bold mt-1 text-foreground">{formatINR(scenarioResult.currentPlanNetWorth5Year, { compact: true })}</div>
                  </div>
                  <div className="border border-border/50 rounded-lg p-3 bg-muted/10">
                    <div className="text-[10px] text-muted-foreground uppercase">Projected Plan</div>
                    <div className="font-numeric text-base font-bold mt-1 text-red-500">{formatINR(scenarioResult.projectedPlanNetWorth5Year, { compact: true })}</div>
                  </div>
                  <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-lg p-3">
                    <div className="text-[10px] text-emerald-400 uppercase">Recommended Plan</div>
                    <div className="font-numeric text-base font-bold mt-1 text-emerald-400">{formatINR(scenarioResult.recommendedPlanNetWorth5Year, { compact: true })}</div>
                  </div>
                </div>

                <div className="border-t border-border/50 pt-4 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Plan Adjustments Recommended</h4>
                  {scenarioResult.recommendations.map((rec, idx) => (
                    <div key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                      <ArrowRight className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* 7. Financial Calendar Content */}
          <TabsContent value="calendar" className="space-y-6">
            <Card className="card-luxe p-6 space-y-4">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">Planning Calendar deadlines</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 border-b border-border/50 uppercase tracking-wider text-[10px] text-muted-foreground">
                    <tr>
                      <th className="p-3">Deadline Date</th>
                      <th className="p-3">Title Event</th>
                      <th className="p-3">Classification</th>
                      <th className="p-3 text-right">Liability Amount</th>
                      <th className="p-3">Description Context</th>
                      <th className="p-3">Importance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {calendarEvents.map((evt) => (
                      <tr key={evt.id} className="hover:bg-muted/10">
                        <td className="p-3 font-semibold font-numeric">{evt.date}</td>
                        <td className="p-3 font-medium text-foreground">{evt.title}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[9px] uppercase px-2 py-0.5 rounded-full">
                            {evt.type}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-numeric font-semibold text-foreground">
                          {evt.amount ? formatINR(evt.amount) : "—"}
                        </td>
                        <td className="p-3 text-muted-foreground">{evt.description}</td>
                        <td className="p-3">
                          <Badge className={`text-[8px] uppercase px-1.5 py-0.5 rounded-full ${
                            evt.importance === "high" ? "bg-red-500 text-white" :
                            evt.importance === "medium" ? "bg-yellow-500 text-black" :
                            "bg-blue-500 text-white"
                          }`}>
                            {evt.importance}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

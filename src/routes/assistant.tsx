import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { chatWithAssistant } from "@/lib/ai-assistant.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";
import { formatINR } from "@/lib/format";
import {
  InsightEngine,
  RiskEngine,
  OpportunityEngine,
  ScenarioEngine,
  GoalPlanner,
  FinancialCoach,
  type ScenarioInput,
} from "@/lib/financial-engine";
import { WidgetErrorBoundary } from "@/components/widget-error-boundary";
import {
  Sparkles,
  SendHorizonal,
  Loader2,
  AlertTriangle,
  Lightbulb,
  ShieldAlert,
  Play,
  HelpCircle,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [{ title: "Financial Intelligence Console · GloriousFinance" }] }),
  component: AssistantPage,
});

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "How can I improve my financial health score?",
  "Tell me about my active loans and payoff timeline.",
  "Which categories should I trim to save more?",
  "Explain my Debt-to-Income ratio.",
];

function AssistantPage() {
  const { state, loading } = useStore();
  const chat = useServerFn(chatWithAssistant);

  // Chat state
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // Scenario Simulator state
  const [simSalary, setSimSalary] = useState<number>(0);
  const [simExpense, setSimExpense] = useState<number>(0);
  const [simVehicle, setSimVehicle] = useState<number>(0);
  const [simSip, setSimSip] = useState<number>(0);
  const [simMedical, setSimMedical] = useState<number>(0);

  // Coaching state
  const [coachTopic, setCoachTopic] = useState<string>("health_score");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  // Compute live intelligence engines
  const insights = useMemo(() => {
    if (loading) return [];
    return InsightEngine.getInsights(state);
  }, [state, loading]);

  const risks = useMemo(() => {
    if (loading) return [];
    return RiskEngine.getRisks(state);
  }, [state, loading]);

  const opportunities = useMemo(() => {
    if (loading) return [];
    return OpportunityEngine.getOpportunities(state);
  }, [state, loading]);

  const goalPlans = useMemo(() => {
    if (loading) return [];
    return GoalPlanner.planGoals(state);
  }, [state, loading]);

  const coachExplanation = useMemo(() => {
    if (loading) return "";
    return FinancialCoach.getExplanation(coachTopic, state);
  }, [state, coachTopic, loading]);

  // Simulated Scenario
  const scenarioResult = useMemo(() => {
    if (loading) return null;
    const simInput: ScenarioInput = {};
    if (simSalary > 0) simInput.salaryIncreasePercent = simSalary;
    if (simExpense > 0) simInput.expenseDecreasePercent = simExpense;
    if (simVehicle > 0) simInput.purchaseVehicleAmount = simVehicle;
    if (simSip > 0) simInput.increaseSipAmount = simSip;
    if (simMedical > 0) simInput.medicalExpense = simMedical;

    return ScenarioEngine.simulate(state, simInput);
  }, [state, simSalary, simExpense, simVehicle, simSip, simMedical, loading]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await chat({ data: { messages: next } });
      setMessages((m) => [...m, { role: "assistant", content: res.content }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Something went wrong."}` },
      ]);
    } finally {
      setBusy(false);
      areaRef.current?.focus();
    }
  };

  if (loading) {
    return <AssistantSkeleton />;
  }

  return (
    <div className="grid h-[calc(100vh-3.5rem)] lg:grid-cols-12 overflow-hidden" role="main" aria-label="Financial Intelligence Sandbox">
      {/* Left Column: Interactive Intelligence Engines */}
      <div className="lg:col-span-7 flex flex-col border-r border-border/60 overflow-y-auto p-6 md:p-10 space-y-8">
        <PageHeader
          title="Financial Intelligence Console"
          subtitle="Deterministic risk models, scenarios sandbox, goal timetables, and educational coaching."
        />

        <Tabs defaultValue="insights" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-2 h-auto bg-transparent p-0 mb-6">
            <TabsTrigger value="insights" className="text-xs py-2 border border-border/40 rounded-lg">Insights & Risks</TabsTrigger>
            <TabsTrigger value="scenarios" className="text-xs py-2 border border-border/40 rounded-lg">What-If Sandbox</TabsTrigger>
            <TabsTrigger value="goals" className="text-xs py-2 border border-border/40 rounded-lg">Goal Timelines</TabsTrigger>
            <TabsTrigger value="coach" className="text-xs py-2 border border-border/40 rounded-lg">Financial Coach</TabsTrigger>
          </TabsList>

          {/* Insights & Risks tab */}
          <TabsContent value="insights" className="space-y-6">
            <WidgetErrorBoundary title="Deterministic Risk Panel">
              <div className="space-y-4">
                <div className="flex items-center gap-1.5 text-xs text-primary uppercase tracking-wider font-semibold">
                  <ShieldAlert className="h-4 w-4" /> Real-Time Risk Ledger
                </div>

                {risks.length === 0 ? (
                  <div className="p-4 rounded-xl border border-success/30 bg-success/5 text-xs text-success-foreground">
                    No critical risk vectors detected on your active accounts.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {risks.map((r) => (
                      <div
                        key={r.id}
                        className={`p-4 rounded-xl border flex flex-col gap-1 ${
                          r.severity === "critical"
                            ? "bg-danger-soft border-danger/30 text-danger-foreground"
                            : r.severity === "high"
                              ? "bg-warning-soft border-warning/30 text-warning-foreground"
                              : "bg-muted/10 border-border/60 text-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-display font-bold text-xs uppercase tracking-widest">
                            {r.title}
                          </span>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${
                              r.severity === "critical"
                                ? "bg-danger text-white"
                                : r.severity === "high"
                                  ? "bg-warning text-white"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {r.severity}
                          </span>
                        </div>
                        <p className="text-xs mt-1">{r.description}</p>
                        <div className="text-[10px] opacity-90 mt-1 font-semibold italic">
                          Remedy: {r.remedy}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </WidgetErrorBoundary>

            <WidgetErrorBoundary title="Opportunity Log">
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-1.5 text-xs text-gold uppercase tracking-wider font-semibold">
                  <Lightbulb className="h-4 w-4" /> Opportunities
                </div>

                {opportunities.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    No additional opportunities identified at current savings rate.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {opportunities.map((o) => (
                      <div
                        key={o.id}
                        className="p-4 rounded-xl border border-border/50 bg-card hover:border-gold/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-xs text-foreground">{o.title}</h4>
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-gold/10 text-gold uppercase tracking-wider font-bold">
                            {o.difficulty} effort
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{o.description}</p>
                        <div className="text-[10px] text-primary font-semibold mt-1">
                          Estimated benefit: {o.benefit}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </WidgetErrorBoundary>

            <WidgetErrorBoundary title="Insights Feed">
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-1.5 text-xs text-primary uppercase tracking-wider font-semibold">
                  <TrendingUp className="h-4 w-4" /> Insights
                </div>

                <div className="grid gap-2">
                  {insights.map((i) => (
                    <div
                      key={i.id}
                      className="p-3.5 rounded-xl border border-border/40 bg-muted/10 text-xs flex gap-2 items-start"
                    >
                      <div className="mt-0.5">
                        {i.type === "success" && "🟢"}
                        {i.type === "warning" && "🟡"}
                        {i.type === "danger" && "🔴"}
                        {i.type === "info" && "🔵"}
                      </div>
                      <div>
                        <strong className="text-foreground">{i.title}</strong> — {i.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </WidgetErrorBoundary>
          </TabsContent>

          {/* Scenarios sandbox */}
          <TabsContent value="scenarios" className="space-y-6">
            <WidgetErrorBoundary title="What-If Simulator Form">
              <Card className="card-luxe p-6 space-y-4">
                <div>
                  <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-foreground">
                    Simulation Variables
                  </h3>
                  <p className="text-xs text-muted-foreground">Adjust dials to model alternative trajectories.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Salary Increase (%)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 15"
                      value={simSalary || ""}
                      onChange={(e) => setSimSalary(Number(e.target.value))}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Trim Expenses (%)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 10"
                      value={simExpense || ""}
                      onChange={(e) => setSimExpense(Number(e.target.value))}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Purchase Vehicle Price (₹)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 800000"
                      value={simVehicle || ""}
                      onChange={(e) => setSimVehicle(Number(e.target.value))}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Increase Monthly SIP (₹)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 5000"
                      value={simSip || ""}
                      onChange={(e) => setSimSip(Number(e.target.value))}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Emergency Medical Outflow (₹)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 150000"
                      value={simMedical || ""}
                      onChange={(e) => setSimMedical(Number(e.target.value))}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => {
                    setSimSalary(0);
                    setSimExpense(0);
                    setSimVehicle(0);
                    setSimSip(0);
                    setSimMedical(0);
                  }}
                  className="w-full text-xs h-8"
                >
                  Reset Simulation
                </Button>
              </Card>
            </WidgetErrorBoundary>

            {scenarioResult && (
              <WidgetErrorBoundary title="Simulation Output comparison">
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Simulation Comparison Result
                  </h4>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Net Worth */}
                    <div className="p-4 rounded-xl border border-border bg-card">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Net Worth
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-xs text-muted-foreground line-through">
                          {formatINR(scenarioResult.currentMetrics.netWorth)}
                        </span>
                        <span className="font-display font-bold text-sm text-foreground">
                          {formatINR(scenarioResult.scenarioMetrics.netWorth)}
                        </span>
                      </div>
                      <div
                        className={`text-[10px] font-bold mt-1 ${
                          scenarioResult.difference.netWorth >= 0 ? "text-success" : "text-danger"
                        }`}
                      >
                        {scenarioResult.difference.netWorth >= 0 ? "+" : ""}
                        {formatINR(scenarioResult.difference.netWorth)}
                      </div>
                    </div>

                    {/* Cash Flow */}
                    <div className="p-4 rounded-xl border border-border bg-card">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Monthly Cash Flow
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-xs text-muted-foreground line-through">
                          {formatINR(scenarioResult.currentMetrics.cashFlow)}
                        </span>
                        <span className="font-display font-bold text-sm text-foreground">
                          {formatINR(scenarioResult.scenarioMetrics.cashFlow)}
                        </span>
                      </div>
                      <div
                        className={`text-[10px] font-bold mt-1 ${
                          scenarioResult.difference.cashFlow >= 0 ? "text-success" : "text-danger"
                        }`}
                      >
                        {scenarioResult.difference.cashFlow >= 0 ? "+" : ""}
                        {formatINR(scenarioResult.difference.cashFlow)}
                      </div>
                    </div>
                  </div>

                  {/* Simulation logs */}
                  {scenarioResult.insights.length > 0 && (
                    <div className="p-4 bg-muted/10 border border-border/50 rounded-xl space-y-1.5 text-xs text-muted-foreground">
                      <div className="font-semibold text-foreground">Impact Notes:</div>
                      {scenarioResult.insights.map((note, idx) => (
                        <div key={idx} className="flex gap-1.5 items-start">
                          <Play className="h-3 w-3 text-primary mt-1 shrink-0" />
                          <span>{note}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </WidgetErrorBoundary>
            )}
          </TabsContent>

          {/* Goal timeline Tab */}
          <TabsContent value="goals" className="space-y-4">
            <WidgetErrorBoundary title="Goal Planner timelines">
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-foreground">
                    Savings Allocation & Priority
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Timeline compatibility models under current monthly surplus allocations.
                  </p>
                </div>

                <div className="grid gap-3">
                  {goalPlans.map((plan) => (
                    <div key={plan.goalId} className="p-4 rounded-xl border border-border bg-card">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">
                          #{plan.prioritizedRank} {plan.name}
                        </span>
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            plan.isPossible
                              ? "bg-success/10 text-success"
                              : "bg-danger/10 text-danger"
                          }`}
                        >
                          {plan.isPossible ? "On Schedule" : "At Risk"}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-muted/10 p-2 rounded">
                          <div className="text-[9px] text-muted-foreground uppercase">Target</div>
                          <div className="font-semibold text-foreground mt-0.5">
                            {formatINR(plan.target, { compact: true })}
                          </div>
                        </div>
                        <div className="bg-muted/10 p-2 rounded">
                          <div className="text-[9px] text-muted-foreground uppercase">Remaining</div>
                          <div className="font-semibold text-foreground mt-0.5">
                            {formatINR(plan.fundingGap, { compact: true })}
                          </div>
                        </div>
                        <div className="bg-muted/10 p-2 rounded">
                          <div className="text-[9px] text-muted-foreground uppercase">Timeline</div>
                          <div className="font-semibold text-foreground mt-0.5">
                            {plan.monthsToComplete} months
                          </div>
                        </div>
                      </div>

                      {!plan.isPossible && (
                        <div className="mt-3 text-[10px] text-danger bg-danger-soft p-2 rounded-lg font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>
                            Increase monthly savings to {formatINR(plan.recommendedMonthlySavings)} to hit goal.
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </WidgetErrorBoundary>
          </TabsContent>

          {/* Financial Coach Tab */}
          <TabsContent value="coach" className="space-y-4">
            <WidgetErrorBoundary title="Financial Coach definitions">
              <Card className="card-luxe p-6 space-y-4">
                <div>
                  <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-foreground flex items-center gap-1.5">
                    <HelpCircle className="h-4 w-4 text-primary" /> educational coaching
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Get clear explanations of metrics grounded in your numbers.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Select Metric</Label>
                  <Select value={coachTopic} onValueChange={setCoachTopic}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select topic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="health_score">Financial Health Score</SelectItem>
                      <SelectItem value="debt_ratio">Debt-to-Income (DTI)</SelectItem>
                      <SelectItem value="emergency_fund">Emergency Coverage Fund</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 rounded-xl border border-border bg-muted/10 text-xs text-foreground leading-relaxed">
                  {coachExplanation}
                </div>
              </Card>
            </WidgetErrorBoundary>
          </TabsContent>
        </Tabs>
      </div>

      {/* Right Column: AI Financial Assistant (Grounded Chat) */}
      <div className="lg:col-span-5 flex flex-col h-full bg-muted/5">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center p-6">
              <div className="h-10 w-10 flex items-center justify-center rounded-full bg-primary/10 mb-3">
                <Sparkles className="h-5 w-5 text-gold animate-pulse" />
              </div>
              <h3 className="font-display text-base font-semibold text-foreground">
                Grounded Financial Assistant
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Ask qualitative queries. Answers are grounded in deterministic calculations.
              </p>
              
              <div className="grid gap-2 w-full max-w-sm mt-6 text-left">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="p-3 text-xs rounded-xl border border-border bg-card text-foreground transition hover:border-primary text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground font-medium shadow-sm"
                        : "card-luxe text-foreground border border-border"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-xs max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="card-luxe max-w-[90%] rounded-2xl px-4 py-2.5 text-xs text-muted-foreground border border-border flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span>Analyzing financial context...</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Chat input box */}
        <div className="p-4 border-t border-border/60 bg-background">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={areaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Query your grounded financial state..."
              rows={1}
              className="min-h-[40px] resize-none text-xs"
            />
            <Button
              onClick={() => send()}
              disabled={busy || !input.trim()}
              size="icon"
              className="h-10 w-10 shrink-0"
            >
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssistantSkeleton() {
  return (
    <div className="grid h-[calc(100vh-3.5rem)] lg:grid-cols-12 animate-pulse p-6 gap-6">
      <div className="lg:col-span-7 space-y-6">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="h-4 w-96 bg-muted rounded" />
        <div className="h-48 bg-muted rounded-xl" />
        <div className="h-72 bg-muted rounded-xl" />
      </div>
      <div className="lg:col-span-5 bg-muted/10 rounded-xl h-full" />
    </div>
  );
}

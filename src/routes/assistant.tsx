import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";
import {
  InsightEngine,
  RiskEngine,
  OpportunityEngine,
  ScenarioEngine,
  GoalPlanner,
} from "@/lib/financial-engine";

import {
  RAGEngine,
  FinancialCoaches,
  AICostOptimizer,
  RecommendationEngine,
  type CoachType,
  type CopilotResponse,
  type CostOptimizerMetrics
} from "@/lib/copilot";

import {
  Sparkles,
  SendHorizonal,
  Loader2,
  AlertTriangle,
  Lightbulb,
  ShieldAlert,
  Play,
  TrendingUp,
  ArrowRight,
  Shield,
  Bot,
  Zap,
  PiggyBank,
  FileText,
  Target,
  Landmark,
  Building,
  Activity,
  CheckCircle,
  Coins,
  DollarSign,
  BookOpen
} from "lucide-react";

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [{ title: "Financial Copilot Studio · GloriousFinance" }] }),
  component: AssistantPage,
});

interface Msg {
  role: "user" | "assistant";
  content: string;
  responseMeta?: CopilotResponse;
}

const COACH_ICONS: Record<CoachType, any> = {
  budget_coach: PiggyBank,
  investment_coach: TrendingUp,
  tax_assistant: FileText,
  retirement_planner: Target,
  insurance_advisor: Shield,
  loan_advisor: Landmark,
  wealth_coach: Sparkles,
  business_assistant: Building,
  portfolio_analyst: Activity,
  health_advisor: CheckCircle
};

function AssistantPage() {
  const { state, loading } = useStore();

  // Chat & Copilot state
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState<CoachType>("wealth_coach");
  const [costMetrics, setCostMetrics] = useState<CostOptimizerMetrics>(AICostOptimizer.getMetrics());

  const bottomRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const refreshCostMetrics = () => {
    setCostMetrics(AICostOptimizer.getMetrics());
  };

  // Intelligence summaries
  const insights = useMemo(() => (loading ? [] : InsightEngine.getInsights(state)), [state, loading]);
  const risks = useMemo(() => (loading ? [] : RiskEngine.getRisks(state)), [state, loading]);
  const opportunities = useMemo(() => (loading ? [] : OpportunityEngine.getOpportunities(state)), [state, loading]);
  const recommendations = useMemo(() => (loading ? [] : RecommendationEngine.generateRecommendations(state)), [state, loading]);

  const currentCoachObj = FinancialCoaches.getCoach(selectedCoach);
  const CoachIcon = COACH_ICONS[selectedCoach] || Sparkles;

  const handleSend = async (userQuery?: string) => {
    const query = userQuery || input.trim();
    if (!query || busy) return;

    const userMsg: Msg = { role: "user", content: query };
    setMessages(prev => [...prev, userMsg]);
    if (!userQuery) setInput("");
    setBusy(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const copilotRes = await RAGEngine.processCopilotQuery(query, state, selectedCoach, history);

      const assistantMsg: Msg = {
        role: "assistant",
        content: copilotRes.answerText,
        responseMeta: copilotRes
      };

      setMessages(prev => [...prev, assistantMsg]);
      refreshCostMetrics();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate copilot response");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background p-4 md:p-8 space-y-6">
      <PageHeader
        title="Financial Copilot Studio"
        description="Domain-restricted financial intelligence, persona-based advisory coaches, and AI cost optimizer."
      />

      {/* AI COST OPTIMIZATION METRICS BAR */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/50 bg-background/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">Tokens Saved</CardDescription>
            <CardTitle className="text-xl font-bold text-emerald-500">{costMetrics.tokensSaved.toLocaleString()} tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">Zero-token KB & Cache Hits</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-background/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">Cache Hit Rate</CardDescription>
            <CardTitle className="text-xl font-bold text-primary">{costMetrics.cacheHitRatePercent}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">{costMetrics.kbHitsZeroTokens + costMetrics.cacheHitsZeroTokens} zero-cost responses</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-background/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">Estimated $ Saved</CardDescription>
            <CardTitle className="text-xl font-bold text-emerald-500">${costMetrics.estimatedDollarSaved}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">API call reduction savings</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-background/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">Gemini API Calls</CardDescription>
            <CardTitle className="text-xl font-bold text-foreground">{costMetrics.geminiApiCalls}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">{costMetrics.tokensConsumed.toLocaleString()} tokens consumed</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="copilot" className="space-y-6">
        <TabsList className="bg-muted/40 border border-border/60">
          <TabsTrigger value="copilot" className="text-xs">Financial Copilot Studio</TabsTrigger>
          <TabsTrigger value="insights" className="text-xs">Intelligence & Risks ({risks.length})</TabsTrigger>
          <TabsTrigger value="recommendations" className="text-xs">Grounded Recommendations ({recommendations.length})</TabsTrigger>
        </TabsList>

        {/* FINANCIAL COPILOT TAB */}
        <TabsContent value="copilot" className="space-y-6">
          {/* COACH PERSONA SELECTOR */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
            <span className="text-xs font-semibold text-muted-foreground mr-2">Advisor Persona:</span>
            {Object.values(FinancialCoaches.COACHES).map(c => {
              const Icon = COACH_ICONS[c.type] || Sparkles;
              const isSelected = selectedCoach === c.type;
              return (
                <button
                  key={c.type}
                  onClick={() => setSelectedCoach(c.type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>

          {/* ACTIVE COACH HEADER */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/20 p-2 text-primary">
                <CoachIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-foreground">{currentCoachObj.name}</h3>
                <p className="text-xs text-muted-foreground">{currentCoachObj.roleTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                Finance Domain Restricted
              </span>
            </div>
          </div>

          {/* CHAT MESSAGES WINDOW */}
          <Card className="border-border/60 bg-background/30">
            <CardContent className="p-4 md:p-6 space-y-4 max-h-[500px] overflow-y-auto">
              {messages.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground space-y-3">
                  <Bot className="h-8 w-8 mx-auto text-primary/60 animate-pulse" />
                  <p className="font-semibold text-foreground">Welcome to Financial Copilot Studio</p>
                  <p className="max-w-md mx-auto">Ask any personal finance, tax, loan, or investment question. Unrelated non-finance topics are politely restricted.</p>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    {currentCoachObj.sampleQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(q)}
                        className="rounded-full border border-border/60 bg-background px-3 py-1 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, idx) => (
                  <div key={idx} className={`flex gap-3 text-xs ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" && (
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <CoachIcon className="h-4 w-4" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-lg p-3.5 leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/40 border border-border/60 text-foreground"
                    }`}>
                      <ReactMarkdown>{m.content}</ReactMarkdown>

                      {/* COPILOT METADATA TAGS */}
                      {m.responseMeta && (
                        <div className="mt-3 border-t border-border/40 pt-2 flex flex-wrap items-center gap-2 text-[10px]">
                          <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono font-semibold text-muted-foreground">
                            Intent: {m.responseMeta.intent}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 font-mono font-semibold ${
                            m.responseMeta.source === "local_kb" ? "bg-emerald-500/10 text-emerald-500" :
                            m.responseMeta.source === "local_cache" ? "bg-blue-500/10 text-blue-500" :
                            m.responseMeta.source === "local_fallback" ? "bg-amber-500/10 text-amber-500" : "bg-purple-500/10 text-purple-500"
                          }`}>
                            Source: {m.responseMeta.source === "local_kb" ? "Local KB (0 tokens)" :
                                     m.responseMeta.source === "local_cache" ? "Cache Hit (0 tokens)" :
                                     m.responseMeta.source === "local_fallback" ? "Financial OS (local)" : "Gemini LLM"}
                          </span>

                          {m.responseMeta.citations.map((cit, cIdx) => (
                            <span key={cIdx} className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-500 font-semibold flex items-center gap-1">
                              <BookOpen className="h-2.5 w-2.5" />
                              {cit.referenceTag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {busy && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Financial Copilot is reasoning and checking Financial OS context...</span>
                </div>
              )}
              <div ref={bottomRef} />
            </CardContent>
          </Card>

          {/* INPUT FORM */}
          <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
            <Textarea
              ref={areaRef}
              rows={1}
              placeholder={`Ask ${currentCoachObj.name} a question... (e.g. "How is my budget utilization?")`}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="min-h-[44px] text-xs resize-none border-border/60 bg-background/50"
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()} className="h-[44px] w-[44px] shrink-0">
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </form>
        </TabsContent>

        {/* INTELLIGENCE & RISKS */}
        <TabsContent value="insights" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/60 bg-background/30">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-500">
                  <ShieldAlert className="h-4 w-4" /> Financial Risk Assessment ({risks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {risks.map(r => (
                  <div key={r.id} className="rounded border border-red-500/30 bg-red-500/5 p-3 space-y-1">
                    <span className="font-bold text-foreground block">{r.title}</span>
                    <p className="text-muted-foreground">{r.description}</p>
                    <span className="text-[10px] text-red-400 font-semibold block pt-1">Mitigation: {r.actionableMitigation}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-background/30">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-500">
                  <Lightbulb className="h-4 w-4" /> Strategic Opportunities ({opportunities.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {opportunities.map(o => (
                  <div key={o.id} className="rounded border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
                    <span className="font-bold text-foreground block">{o.title}</span>
                    <p className="text-muted-foreground">{o.description}</p>
                    <span className="text-[10px] text-amber-500 font-semibold block pt-1">Potential Gain: {formatINR(o.estimatedFinancialGain)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* GROUNDED RECOMMENDATIONS */}
        <TabsContent value="recommendations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {recommendations.map(rec => (
              <Card key={rec.id} className="border-border/60 bg-background/40">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold">{rec.title}</CardTitle>
                    <span className={`rounded px-2 py-0.5 text-[9px] font-semibold uppercase ${
                      rec.priority === "high" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                    }`}>
                      {rec.priority} Priority
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <p className="text-foreground font-medium">{rec.actionableStep}</p>
                  <div className="rounded bg-muted/40 p-2 font-mono text-[10px] text-muted-foreground border border-border/40">
                    {rec.groundedMetric}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

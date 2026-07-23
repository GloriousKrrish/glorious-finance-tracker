import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import {
  RiskEngine,
  OpportunityEngine,
} from "@/lib/financial-engine";

import {
  RAGEngine,
  FinancialCoaches,
  RecommendationEngine,
  type CoachType,
  type CopilotResponse,
} from "@/lib/copilot";

import {
  Sparkles,
  SendHorizonal,
  Loader2,
  Lightbulb,
  ShieldAlert,
  TrendingUp,
  Shield,
  Bot,
  PiggyBank,
  FileText,
  Target,
  Landmark,
  Building,
  Activity,
  CheckCircle,
  BookOpen,
} from "lucide-react";

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [{ title: "AI Financial Advisor · GloriousFinance" }] }),
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
  health_advisor: CheckCircle,
};

const RECOMMENDED_PROMPTS = [
  "I earn ₹17 lakh salary. Help me save tax.",
  "Should I choose Old or New Tax Regime?",
  "What is SIP and how does Rupee Cost Averaging work?",
  "Should I buy gold or invest in equity SIPs?",
  "Explain inflation and how to protect my money.",
  "How much did I spend this month?",
  "How is my investment portfolio doing?",
];

function AssistantPage() {
  const { state, loading } = useStore();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState<CoachType>("wealth_coach");

  const bottomRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const risks = useMemo(() => (loading ? [] : RiskEngine.getRisks(state)), [state, loading]);
  const opportunities = useMemo(() => (loading ? [] : OpportunityEngine.getOpportunities(state)), [state, loading]);
  const recommendations = useMemo(() => (loading ? [] : RecommendationEngine.generateRecommendations(state)), [state, loading]);

  const currentCoachObj = FinancialCoaches.getCoach(selectedCoach);
  const CoachIcon = COACH_ICONS[selectedCoach] || Sparkles;

  const handleSend = async (userQuery?: string) => {
    const query = userQuery || input.trim();
    if (!query || busy) return;

    const userMsg: Msg = { role: "user", content: query };
    setMessages((prev) => [...prev, userMsg]);
    if (!userQuery) setInput("");
    setBusy(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const copilotRes = await RAGEngine.processCopilotQuery(query, state, selectedCoach, history);

      const assistantMsg: Msg = {
        role: "assistant",
        content: copilotRes.answerText,
        responseMeta: copilotRes,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate AI response");
    } finally {
      setBusy(false);
    }
  };

  const handleOptionClick = (option: string) => {
    handleSend(option);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="AI Financial Advisor"
        subtitle="Conversational intelligence combining ChatGPT reasoning with CFP + CA + Wealth Management expertise."
      />

      <Tabs defaultValue="copilot" className="space-y-6">
        <TabsList className="bg-muted/40 border border-border/60">
          <TabsTrigger value="copilot" className="text-xs font-medium">Conversational Advisor</TabsTrigger>
          <TabsTrigger value="insights" className="text-xs font-medium">Risk & Opportunities ({risks.length + opportunities.length})</TabsTrigger>
          <TabsTrigger value="recommendations" className="text-xs font-medium">Strategic Recommendations ({recommendations.length})</TabsTrigger>
        </TabsList>

        {/* CONVERSATIONAL ADVISOR TAB */}
        <TabsContent value="copilot" className="space-y-4">
          {/* ADVISOR PERSONA SELECTOR */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
            <span className="text-xs font-semibold text-muted-foreground mr-2">Specialization Focus:</span>
            {Object.values(FinancialCoaches.COACHES).map((c) => {
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

          {/* ACTIVE ADVISOR HEADER */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/20 p-2 text-primary">
                <CoachIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-foreground">{currentCoachObj.name}</h3>
                <p className="text-xs text-muted-foreground">{currentCoachObj.roleTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-medium">AI Brain Active</span>
            </div>
          </div>

          {/* CHAT MESSAGES WINDOW */}
          <Card className="border-border/60 bg-background/50 shadow-sm">
            <CardContent className="p-4 md:p-6 space-y-4 min-h-[420px] max-h-[560px] overflow-y-auto">
              {messages.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground space-y-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-foreground">Welcome to GloriousFinance AI</p>
                    <p className="max-w-lg mx-auto text-muted-foreground">
                      Ask me anything about investments, tax optimization, retirement, loans, general finance concepts, or your personal ledger finances. I reason before answering to give you clear, actionable guidance.
                    </p>
                  </div>

                  <div className="pt-4 max-w-2xl mx-auto">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Suggested Conversations</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {RECOMMENDED_PROMPTS.map((q, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(q)}
                          className="rounded-full border border-border/70 bg-background/80 px-3.5 py-1.5 text-[11px] text-foreground hover:border-primary/60 hover:bg-primary/5 transition-all shadow-2xs"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
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
                    <div className={`max-w-[85%] rounded-xl p-4 leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted/40 border border-border/60 text-foreground"
                    }`}>
                      <div className="prose prose-xs dark:prose-invert max-w-none space-y-2">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>

                      {/* FOLLOW-UP OPTION BUTTONS */}
                      {m.responseMeta?.followUpOptions && m.responseMeta.followUpOptions.length > 0 && idx === messages.length - 1 && (
                        <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-border/40">
                          {m.responseMeta.followUpOptions.map((option, oi) => (
                            <button
                              key={oi}
                              onClick={() => handleOptionClick(option)}
                              disabled={busy}
                              className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* CITATIONS */}
                      {m.responseMeta?.citations && m.responseMeta.citations.length > 0 && (
                        <div className="mt-3 border-t border-border/40 pt-2 flex flex-wrap items-center gap-2 text-[10px]">
                          {m.responseMeta.citations.map((cit, cIdx) => (
                            <span key={cIdx} className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-500 font-medium flex items-center gap-1">
                              <BookOpen className="h-3 w-3" />
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
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>AI Financial Advisor is reasoning...</span>
                </div>
              )}
              <div ref={bottomRef} />
            </CardContent>
          </Card>

          {/* INPUT FORM */}
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
            <Textarea
              ref={areaRef}
              rows={1}
              placeholder={`Ask ${currentCoachObj.name}... (e.g. "I earn ₹17L salary, help me save tax" or "What is SIP?")`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="min-h-[46px] text-xs resize-none border-border/60 bg-background/60 focus-visible:ring-primary"
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()} className="h-[46px] w-[46px] shrink-0">
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
                  <ShieldAlert className="h-4 w-4" /> Financial Risks ({risks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {risks.map((r) => (
                  <div key={r.id} className="rounded border border-red-500/30 bg-red-500/5 p-3 space-y-1">
                    <span className="font-bold text-foreground block">{r.title}</span>
                    <p className="text-muted-foreground">{r.description}</p>
                    <span className="text-[10px] text-red-400 font-semibold block pt-1">Mitigation: {r.remedy}</span>
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
                {opportunities.map((o) => (
                  <div key={o.id} className="rounded border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
                    <span className="font-bold text-foreground block">{o.title}</span>
                    <p className="text-muted-foreground">{o.description}</p>
                    <span className="text-[10px] text-amber-500 font-semibold block pt-1">Benefit: {o.benefit}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* GROUNDED RECOMMENDATIONS */}
        <TabsContent value="recommendations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {recommendations.map((rec) => (
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
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

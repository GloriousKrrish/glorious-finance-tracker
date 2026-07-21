import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore, uid, type Goal } from "@/lib/store";
import { formatINR, formatDate, todayISO } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { AddButton, EditIconButton, DeleteIconButton, FormDialogHeader, FormFooter } from "@/components/crud";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectorEngine } from "@/lib/financial-engine";
import { toast } from "sonner";
import {
  Target, TrendingUp, TrendingDown, Clock, CheckCircle, AlertTriangle,
  Calendar, PiggyBank, ArrowUpRight, Banknote, History,
} from "lucide-react";

export const Route = createFileRoute("/goals")({
  head: () => ({ meta: [{ title: "Goals · GloriousFinance" }] }),
  component: GoalsPage,
});

const GOAL_TYPES: { value: NonNullable<Goal["goalType"]>; label: string }[] = [
  { value: "emergency_fund", label: "Emergency Fund" },
  { value: "vacation", label: "Vacation" },
  { value: "vehicle", label: "Vehicle" },
  { value: "home", label: "Home" },
  { value: "education", label: "Education" },
  { value: "retirement", label: "Retirement" },
  { value: "investment", label: "Investment" },
  { value: "debt_payoff", label: "Debt Payoff" },
  { value: "custom", label: "Custom" },
];

const PRIORITIES: { value: NonNullable<Goal["priority"]>; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const empty = (): Goal => ({
  id: uid(),
  name: "",
  target: 0,
  saved: 0,
  deadline: todayISO(),
  category: "Savings",
  goalType: "custom",
  priority: "medium",
  status: "active",
});

function GoalForm({
  initial,
  onSubmit,
  onCancel,
  accounts,
}: {
  initial: Goal;
  onSubmit: (g: Goal) => void;
  onCancel: () => void;
  accounts: { id: string; name: string }[];
}) {
  const [g, setG] = useState<Goal>(() => ({
    goalType: "custom",
    priority: "medium",
    status: "active",
    ...initial,
  }));
  const set = <K extends keyof Goal>(k: K, v: Goal[K]) => setG((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!g.name.trim()) return toast.error("Goal name is required.");
    if (!g.target || g.target <= 0) return toast.error("Target amount must be positive.");
    onSubmit(g);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormDialogHeader title={initial.name ? "Edit goal" : "New goal"} />
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</Label>
          <Input className="mt-1 bg-background/50 backdrop-blur-sm" value={g.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Emergency Fund" />
        </div>

        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Goal Type</Label>
          <Select value={g.goalType || "custom"} onValueChange={(v) => set("goalType", v as Goal["goalType"])}>
            <SelectTrigger className="mt-1 bg-background/50 backdrop-blur-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {GOAL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Priority</Label>
          <Select value={g.priority || "medium"} onValueChange={(v) => set("priority", v as Goal["priority"])}>
            <SelectTrigger className="mt-1 bg-background/50 backdrop-blur-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target (₹)</Label>
          <Input className="mt-1 bg-background/50 backdrop-blur-sm" type="number" step="0.01" value={g.target || ""} onChange={(e) => set("target", parseFloat(e.target.value) || 0)} />
        </div>

        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deadline</Label>
          <Input className="mt-1 bg-background/50 backdrop-blur-sm" type="date" value={g.deadline} onChange={(e) => set("deadline", e.target.value)} />
        </div>

        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</Label>
          <Input className="mt-1 bg-background/50 backdrop-blur-sm" value={g.category} onChange={(e) => set("category", e.target.value)} />
        </div>

        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Linked Account</Label>
          <Select value={g.linkedAccountId || "_none"} onValueChange={(v) => set("linkedAccountId", v === "_none" ? undefined : v)}>
            <SelectTrigger className="mt-1 bg-background/50 backdrop-blur-sm"><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">None</SelectItem>
              {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</Label>
          <Input className="mt-1 bg-background/50 backdrop-blur-sm" value={g.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="Optional notes" />
        </div>
      </div>
      <FormFooter onCancel={onCancel} />
    </form>
  );
}

function ContributeDialog({
  goal,
  accounts,
  onContribute,
}: {
  goal: Goal;
  accounts: { id: string; name: string; balance: number }[];
  onContribute: (goalId: string, amount: number, accountId: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(goal.linkedAccountId || accounts[0]?.id || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(amount);
    if (!v || v <= 0) return toast.error("Enter a valid amount.");
    if (!accountId) return toast.error("Select a funding account.");
    onContribute(goal.id, v, accountId);
    setAmount("");
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Amount (₹)</Label>
          <Input
            className="mt-1 bg-background/50 backdrop-blur-sm"
            type="number"
            step="0.01"
            placeholder="e.g. 5000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">From Account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="mt-1 bg-background/50 backdrop-blur-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name} ({formatINR(a.balance)})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" size="sm" className="w-full">
        <PiggyBank className="mr-2 h-3.5 w-3.5" />Contribute
      </Button>
    </form>
  );
}

function GoalsPage() {
  const { state, dispatch } = useStore();
  const [openAdd, setOpenAdd] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed" | "overdue">("all");
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  const goalsWithMetrics = useMemo(() => SelectorEngine.getGoals(state), [state]);

  const stats = useMemo(() => ({
    totalSaved: SelectorEngine.getGoalsSavingsSummary(state),
    fundingGap: SelectorEngine.getGoalsFundingGapSummary(state),
    forecast: SelectorEngine.getGoalsForecastSummary(state),
    health: SelectorEngine.getGoalsHealthSummary(state),
  }), [state]);

  const filteredGoals = useMemo(() => {
    switch (activeTab) {
      case "active":
        return goalsWithMetrics.filter((g) => !g.metrics.isCompleted && !g.metrics.isOverdue);
      case "completed":
        return goalsWithMetrics.filter((g) => g.metrics.isCompleted);
      case "overdue":
        return goalsWithMetrics.filter((g) => g.metrics.isOverdue);
      default:
        return goalsWithMetrics;
    }
  }, [goalsWithMetrics, activeTab]);

  const accounts = state.accounts.filter((a) => a.type !== "investment");

  const contribute = (goalId: string, amount: number, accountId: string) => {
    dispatch({ type: "goal:contribute", payload: { goalId, amount, accountId } });
    toast.success(`Contributed ${formatINR(amount)} to goal`);
  };

  const healthColors = {
    Excellent: "bg-success/10 text-success border-success/20",
    Good: "bg-primary/10 text-primary border-primary/20",
    Warning: "bg-warning/10 text-warning border-warning/20",
    Critical: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const priorityColors = {
    critical: "text-destructive",
    high: "text-warning",
    medium: "text-muted-foreground",
    low: "text-muted-foreground/60",
  };

  return (
    <div>
      <PageHeader
        title="Goals"
        subtitle="Milestone-based savings connected to your accounts and transaction ledger."
        action={
          <AddButton label="Add goal" open={openAdd} onOpenChange={setOpenAdd}>
            <GoalForm
              initial={empty()}
              onCancel={() => setOpenAdd(false)}
              accounts={accounts}
              onSubmit={(g) => {
                dispatch({ type: "goal:add", payload: g });
                setOpenAdd(false);
                toast.success("Goal created");
              }}
            />
          </AddButton>
        }
      />

      {/* Summary KPIs */}
      <div className="grid gap-4 p-6 md:grid-cols-2 md:p-10 lg:grid-cols-4 pb-0 md:pb-0">
        <Card className="card-luxe p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Total Saved</div>
          <div className="mt-2 font-numeric text-2xl font-semibold text-foreground">{formatINR(stats.totalSaved)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Across {state.goals.length} goals</div>
        </Card>
        <Card className="card-luxe p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Funding Gap</div>
          <div className="mt-2 font-numeric text-2xl font-semibold text-warning">{formatINR(stats.fundingGap)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Still needed to reach all targets</div>
        </Card>
        <Card className="card-luxe p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Forecasted Savings</div>
          <div className="mt-2 font-numeric text-2xl font-semibold text-gold">{formatINR(stats.forecast)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Projected at current pace</div>
        </Card>
        <Card className="card-luxe p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Goal Health</div>
          <div className="mt-2 flex items-center gap-2">
            {stats.health.Excellent > 0 && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">{stats.health.Excellent} Excellent</span>}
            {stats.health.Good > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{stats.health.Good} Good</span>}
            {stats.health.Warning > 0 && <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">{stats.health.Warning} Warning</span>}
            {stats.health.Critical > 0 && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">{stats.health.Critical} Critical</span>}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Across all goals</div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-6 md:px-10">
        <div className="flex border-b border-border/60">
          {(["all", "active", "completed", "overdue"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-4 text-xs font-semibold uppercase tracking-widest border-b-2 transition-all ${
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab} ({
                tab === "all" ? goalsWithMetrics.length :
                tab === "active" ? goalsWithMetrics.filter((g) => !g.metrics.isCompleted && !g.metrics.isOverdue).length :
                tab === "completed" ? goalsWithMetrics.filter((g) => g.metrics.isCompleted).length :
                goalsWithMetrics.filter((g) => g.metrics.isOverdue).length
              })
            </button>
          ))}
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid gap-6 p-6 md:grid-cols-2 md:p-10 lg:grid-cols-3">
        {filteredGoals.map((g) => {
          const m = g.metrics;
          const isExpanded = expandedGoal === g.id;
          const contributions = SelectorEngine.getGoalContributions(state, g.id);

          return (
            <Card
              key={g.id}
              className={`card-luxe relative flex flex-col overflow-hidden p-6 transition-all duration-300 hover:translate-y-[-2px] ${
                m.isCompleted ? "ring-1 ring-success/40" : m.isOverdue ? "ring-1 ring-destructive/40" : ""
              }`}
            >
              {m.isCompleted && <div className="absolute inset-x-0 top-0 h-[2px] bg-success" />}
              {m.isOverdue && <div className="absolute inset-x-0 top-0 h-[2px] bg-destructive" />}

              <div>
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      m.isCompleted ? "bg-success/10 text-success" : m.isOverdue ? "bg-destructive/10 text-destructive" : "bg-primary/5 text-primary"
                    }`}>
                      {m.isCompleted ? <CheckCircle className="h-5 w-5" /> : m.isOverdue ? <AlertTriangle className="h-5 w-5" /> : <Target className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-lg font-semibold text-foreground">{g.name}</span>
                        {g.priority && g.priority !== "medium" && (
                          <span className={`text-[9px] font-bold uppercase ${priorityColors[g.priority]}`}>{g.priority}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{g.goalType ? GOAL_TYPES.find((t) => t.value === g.goalType)?.label || g.category : g.category}</span>
                        <span>·</span>
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(g.deadline)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${healthColors[m.goalHealth as keyof typeof healthColors]}`}>
                      {m.goalHealth}
                    </span>
                    <EditIconButton>
                      {(close) => (
                        <GoalForm
                          initial={g}
                          accounts={accounts}
                          onCancel={close}
                          onSubmit={(u) => {
                            dispatch({ type: "goal:update", payload: u });
                            close();
                            toast.success("Goal updated");
                          }}
                        />
                      )}
                    </EditIconButton>
                    <DeleteIconButton
                      itemLabel="goal"
                      onConfirm={() => {
                        dispatch({ type: "goal:remove", payload: g.id });
                        toast.success("Goal deleted");
                      }}
                    />
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-6 flex items-baseline justify-between">
                  <div className="font-numeric text-3xl font-bold text-foreground">{formatINR(g.saved)}</div>
                  <div className="text-xs text-muted-foreground">of {formatINR(g.target)}</div>
                </div>

                <Progress
                  value={m.progress}
                  className={`mt-4 h-2 ${
                    m.isCompleted ? "[&>div]:bg-success" : m.isOverdue ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"
                  }`}
                />

                <div className="mt-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    {m.goalTrend === "increasing" && <TrendingUp className="h-3.5 w-3.5 text-success" />}
                    {m.goalTrend === "decreasing" && <TrendingDown className="h-3.5 w-3.5 text-warning" />}
                    {m.goalTrend === "stable" && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="capitalize">{m.goalTrend} contributions</span>
                  </div>
                  <div className="font-semibold text-muted-foreground">
                    {m.progress.toFixed(1)}% funded
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="mt-6 border-t border-border/40 pt-4 space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Funding Gap</span>
                  <span className="font-numeric font-medium text-foreground">{formatINR(m.fundingGap)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Required/mo</span>
                  <span className="font-numeric font-medium text-foreground">{formatINR(m.requiredMonthlyContribution)}/mo</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Avg Contribution</span>
                  <span className="font-numeric font-medium text-foreground">{formatINR(m.averageMonthlyContribution)}/mo</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Days Remaining</span>
                  <span className="font-semibold text-foreground">{m.daysRemaining} days</span>
                </div>
                {m.estimatedCompletionMonths > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Est. Completion</span>
                    <span className="font-semibold text-foreground">{m.estimatedCompletionMonths} months</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Forecasted Savings</span>
                  <span className="font-numeric font-medium text-foreground">{formatINR(m.goalForecast)}</span>
                </div>
              </div>

              {/* Contribution Section */}
              {!m.isCompleted && accounts.length > 0 && (
                <ContributeDialog goal={g} accounts={accounts} onContribute={contribute} />
              )}
              {m.isCompleted && (
                <div className="mt-4 rounded-lg bg-success/5 border border-success/20 p-3 text-center text-sm font-medium text-success">
                  <CheckCircle className="inline h-4 w-4 mr-1" /> Goal Achieved!
                </div>
              )}

              {/* Contribution History Toggle */}
              {contributions.length > 0 && (
                <div className="mt-4 border-t border-border/40 pt-3">
                  <button
                    onClick={() => setExpandedGoal(isExpanded ? null : g.id)}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <History className="h-3 w-3" />
                    {isExpanded ? "Hide" : "Show"} {contributions.length} contribution{contributions.length > 1 ? "s" : ""}
                  </button>
                  {isExpanded && (
                    <div className="mt-3 max-h-48 overflow-y-auto space-y-2">
                      {contributions.map((t) => (
                        <div key={t.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
                          <div className="flex items-center gap-2">
                            <ArrowUpRight className="h-3 w-3 text-primary" />
                            <span className="text-muted-foreground">{formatDate(t.date)}</span>
                          </div>
                          <span className="font-numeric font-semibold text-foreground">{formatINR(t.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {filteredGoals.length === 0 && (
          <Card className="card-luxe col-span-full p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center">
            <Target className="h-8 w-8 text-muted-foreground/35 mb-2" />
            {activeTab === "all" ? "Create your first financial goal" : `No ${activeTab} goals`}
          </Card>
        )}
      </div>
    </div>
  );
}

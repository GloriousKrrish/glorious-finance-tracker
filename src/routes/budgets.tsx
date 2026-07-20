import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore, uid, CATEGORIES, type Budget } from "@/lib/store";
import { formatINR } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { AddButton, EditIconButton, DeleteIconButton, FormDialogHeader, FormFooter } from "@/components/crud";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectorEngine } from "@/lib/financial-engine";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, RefreshCw, AlertTriangle, CheckCircle, Clock, BarChart3, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/budgets")({
  head: () => ({ meta: [{ title: "Budgets · GloriousFinance" }] }),
  component: BudgetsPage,
});

const empty = (): Budget => ({
  id: uid(),
  category: "Food",
  limit: 0,
  period: "monthly",
  alertThreshold: 80,
  carryForward: false,
});

function BudgetForm({ initial, onSubmit, onCancel }: { initial: Budget; onSubmit: (b: Budget) => void; onCancel: () => void }) {
  const [b, setB] = useState<Budget>(() => ({
    alertThreshold: 80,
    carryForward: false,
    ...initial
  }));
  
  const set = <K extends keyof Budget>(k: K, v: Budget[K]) => setB(p => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!b.limit || b.limit <= 0) return toast.error("Budget limit must be positive.");
    if (!b.category) return toast.error("Please select a category.");
    if (b.period === "custom") {
      if (!b.startDate) return toast.error("Start date is required for custom period.");
      if (!b.endDate) return toast.error("End date is required for custom period.");
      if (new Date(b.startDate) > new Date(b.endDate)) return toast.error("Start date must be before or equal to end date.");
    }
    onSubmit(b);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormDialogHeader title={initial.limit ? "Edit budget" : "New budget"} />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</Label>
          <Select value={b.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger className="mt-1 bg-background/50 backdrop-blur-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Period</Label>
          <Select value={b.period} onValueChange={(v) => set("period", v as Budget["period"])}>
            <SelectTrigger className="mt-1 bg-background/50 backdrop-blur-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="biweekly">Bi-Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
              <SelectItem value="custom">Custom Date Range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Limit (₹)</Label>
          <Input 
            className="mt-1 bg-background/50 backdrop-blur-sm"
            type="number" 
            step="0.01" 
            placeholder="e.g. 15000"
            value={b.limit || ""} 
            onChange={(e) => set("limit", parseFloat(e.target.value) || 0)} 
          />
        </div>

        <div className="col-span-2 grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alert Threshold (%)</Label>
            <Input 
              className="mt-1 bg-background/50 backdrop-blur-sm"
              type="number" 
              min="1" 
              max="100" 
              placeholder="e.g. 80"
              value={b.alertThreshold || ""} 
              onChange={(e) => set("alertThreshold", parseInt(e.target.value) || undefined)} 
            />
          </div>

          <div className="flex items-center pt-6 pl-2">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              <input 
                type="checkbox"
                className="h-4 w-4 rounded border-border bg-background/50 accent-primary cursor-pointer"
                checked={b.carryForward || false}
                onChange={(e) => set("carryForward", e.target.checked)}
              />
              Carry Forward
            </label>
          </div>
        </div>

        {b.period === "custom" && (
          <div className="col-span-2 grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start Date</Label>
              <Input 
                className="mt-1 bg-background/50 backdrop-blur-sm"
                type="date"
                value={b.startDate || ""}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">End Date</Label>
              <Input 
                className="mt-1 bg-background/50 backdrop-blur-sm"
                type="date"
                value={b.endDate || ""}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
      <FormFooter onCancel={onCancel} />
    </form>
  );
}

function BudgetsPage() {
  const { state, dispatch } = useStore();
  const [openAdd, setOpenAdd] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "spent" | "overspent">("all");

  const budgetsWithMetrics = useMemo(() => {
    return SelectorEngine.getBudgets(state);
  }, [state]);

  const stats = useMemo(() => {
    return {
      spent: SelectorEngine.getBudgetsSpentSummary(state),
      remaining: SelectorEngine.getBudgetsRemainingSummary(state),
      overspent: SelectorEngine.getBudgetsOverspendingSummary(state),
      forecast: SelectorEngine.getBudgetsForecastSummary(state),
      health: SelectorEngine.getBudgetsHealthSummary(state),
    };
  }, [state]);

  const filteredBudgets = useMemo(() => {
    switch (activeTab) {
      case "active":
        return budgetsWithMetrics.filter(b => b.metrics.utilization < 100);
      case "spent":
        return budgetsWithMetrics.filter(b => b.metrics.utilization >= 80 && b.metrics.utilization <= 100);
      case "overspent":
        return budgetsWithMetrics.filter(b => b.metrics.spent > b.limit);
      case "all":
      default:
        return budgetsWithMetrics;
    }
  }, [budgetsWithMetrics, activeTab]);

  return (
    <div>
      <PageHeader 
        title="Budgets" 
        subtitle="Dynamic cycle budgets aligned with transactions and projections."
        action={
          <AddButton label="Add budget" open={openAdd} onOpenChange={setOpenAdd}>
            <BudgetForm initial={empty()} onCancel={() => setOpenAdd(false)} onSubmit={(b) => { dispatch({ type: "budget:add", payload: b }); setOpenAdd(false); toast.success("Budget added successfully"); }} />
          </AddButton>
        }
      />

      {/* Metric summary banner */}
      <div className="grid gap-4 p-6 md:grid-cols-2 md:p-10 lg:grid-cols-4 pb-0 md:pb-0">
        <Card className="card-luxe p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Total Spent</div>
          <div className="mt-2 font-numeric text-2xl font-semibold text-foreground">{formatINR(stats.spent)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Across all active budgets</div>
        </Card>
        <Card className="card-luxe p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Remaining Limit</div>
          <div className="mt-2 font-numeric text-2xl font-semibold text-success">{formatINR(stats.remaining)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Available to spend safely</div>
        </Card>
        <Card className="card-luxe p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Total Overspending</div>
          <div className="mt-2 font-numeric text-2xl font-semibold text-destructive">{formatINR(stats.overspent)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Exceeded budget amount</div>
        </Card>
        <Card className="card-luxe p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Forecasted Spend</div>
          <div className="mt-2 font-numeric text-2xl font-semibold text-gold">{formatINR(stats.forecast)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Projected end-of-period total</div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-6 md:px-10">
        <div className="flex border-b border-border/60">
          {(["all", "active", "spent", "overspent"] as const).map((tab) => (
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
                tab === "all" ? budgetsWithMetrics.length :
                tab === "active" ? budgetsWithMetrics.filter(b => b.metrics.utilization < 100).length :
                tab === "spent" ? budgetsWithMetrics.filter(b => b.metrics.utilization >= 80 && b.metrics.utilization <= 100).length :
                budgetsWithMetrics.filter(b => b.metrics.spent > b.limit).length
              })
            </button>
          ))}
        </div>
      </div>

      {/* Budgets Grid */}
      <div className="grid gap-6 p-6 md:grid-cols-2 md:p-10 lg:grid-cols-3">
        {filteredBudgets.map(b => {
          const { 
            spent, 
            remaining, 
            overspending, 
            utilization, 
            remainingDays, 
            dailySpendingRate, 
            projectedSpent, 
            budgetHealth, 
            budgetTrend,
            cycleStart,
            cycleEnd
          } = b.metrics;

          const progressVal = Math.min(100, utilization);
          const isExceeded = spent > b.limit;
          const warningThreshold = b.alertThreshold !== undefined ? b.alertThreshold : 80;
          const isWarning = utilization >= warningThreshold && utilization <= 100;

          // Color tags
          const healthColors = {
            Excellent: "bg-success/10 text-success border-success/20",
            Good: "bg-primary/10 text-primary border-primary/20",
            Warning: "bg-warning/10 text-warning border-warning/20",
            Critical: "bg-destructive/10 text-destructive border-destructive/20",
          };

          return (
            <Card key={b.id} className="card-luxe relative flex flex-col justify-between overflow-hidden p-6 transition-all duration-300 hover:translate-y-[-2px]">
              {isExceeded && <div className="absolute inset-x-0 top-0 h-[2px] bg-destructive" />}
              {isWarning && <div className="absolute inset-x-0 top-0 h-[2px] bg-warning" />}

              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{b.period}</span>
                      {b.carryForward && (
                        <span className="rounded bg-muted/60 px-1 py-0.5 text-[8px] font-semibold uppercase text-muted-foreground flex items-center gap-0.5">
                          <RefreshCw className="h-2 w-2" /> Carry Forward
                        </span>
                      )}
                    </div>
                    <h4 className="mt-1 font-display text-lg font-semibold text-foreground">{b.category}</h4>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${healthColors[budgetHealth]}`}>
                      {budgetHealth}
                    </span>
                    <div className="flex">
                      <EditIconButton>
                        {(close) => (
                          <BudgetForm 
                            initial={b} 
                            onCancel={close} 
                            onSubmit={(u) => { 
                              dispatch({ type: "budget:update", payload: u }); 
                              close(); 
                              toast.success("Budget updated"); 
                            }} 
                          />
                        )}
                      </EditIconButton>
                      <DeleteIconButton 
                        itemLabel="budget" 
                        onConfirm={() => { 
                          dispatch({ type: "budget:remove", payload: b.id }); 
                          toast.success("Budget deleted"); 
                        }} 
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-baseline justify-between">
                  <div className="font-numeric text-3xl font-bold text-foreground">
                    {formatINR(spent)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    of {formatINR(b.limit)} limit
                  </div>
                </div>

                {/* Utilization Progress Bar */}
                <Progress 
                  value={progressVal} 
                  className={`mt-4 h-2 ${
                    isExceeded 
                      ? "[&>div]:bg-destructive" 
                      : isWarning 
                        ? "[&>div]:bg-warning" 
                        : "[&>div]:bg-primary"
                  }`} 
                />

                {/* Variance text */}
                <div className="mt-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    {budgetTrend === "increasing" && <TrendingUp className="h-3.5 w-3.5 text-warning" />}
                    {budgetTrend === "decreasing" && <TrendingDown className="h-3.5 w-3.5 text-success" />}
                    {budgetTrend === "stable" && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="capitalize">{budgetTrend} spending</span>
                  </div>
                  
                  <div className={`font-semibold ${isExceeded ? "text-destructive" : "text-muted-foreground"}`}>
                    {isExceeded 
                      ? `Over by ${formatINR(overspending)}` 
                      : `${formatINR(remaining)} remaining`}
                  </div>
                </div>
              </div>

              {/* Advanced metrics section */}
              <div className="mt-6 border-t border-border/40 pt-4 space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Forecasted Spend</span>
                  <span className="font-numeric font-medium text-foreground">{formatINR(projectedSpent)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Daily Burn Rate</span>
                  <span className="font-numeric font-medium text-foreground">{formatINR(dailySpendingRate)}/day</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Cycle Duration</span>
                  <span className="text-foreground">{cycleStart} to {cycleEnd}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Remaining Days</span>
                  <span className="font-semibold text-foreground">{remainingDays} days</span>
                </div>
              </div>
            </Card>
          );
        })}
        {filteredBudgets.length === 0 && (
          <Card className="card-luxe col-span-full p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center">
            <BarChart3 className="h-8 w-8 text-muted-foreground/35 mb-2" />
            No budgets match the selected tab filter.
          </Card>
        )}
      </div>
    </div>
  );
}

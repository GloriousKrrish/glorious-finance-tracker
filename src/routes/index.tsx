import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { formatINR } from "@/lib/format";
import { SelectorEngine } from "@/lib/financial-engine";
import { PageHeader } from "@/components/page-header";
import { ChecklistWidget } from "@/components/checklist-widget";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { WidgetErrorBoundary } from "@/components/widget-error-boundary";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Wallet, Landmark, Sparkles, ShieldCheck } from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard · GloriousFinance" }] }),
  component: Dashboard,
});

function greet() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function Dashboard() {
  const { state, loading } = useStore();

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6 pb-10" role="main" aria-label="Financial Dashboard">
      <PageHeader
        title={`Good ${greet()}, ${(state.profile?.name ?? "User").split(" ")[0]}`}
        subtitle="Your financial position at a glance — private, precise, and current."
      />
      
      <WidgetErrorBoundary title="Setup Checklist">
        <ChecklistWidget />
      </WidgetErrorBoundary>

      {/* KPI Section */}
      <WidgetErrorBoundary title="Key Performance Indicators">
        <KpiSection state={state} />
      </WidgetErrorBoundary>

      <div className="grid gap-6 px-6 md:px-10 lg:grid-cols-3">
        {/* Cash Flow Section */}
        <div className="lg:col-span-2">
          <WidgetErrorBoundary title="Cash Flow Analysis">
            <CashFlowWidget state={state} />
          </WidgetErrorBoundary>
        </div>

        {/* Expense Mix Section */}
        <WidgetErrorBoundary title="Expense Distribution">
          <ExpenseMixWidget state={state} />
        </WidgetErrorBoundary>

        {/* Recent Transactions Section */}
        <div className="lg:col-span-2">
          <WidgetErrorBoundary title="Recent Ledger Entries">
            <RecentTransactionsWidget state={state} />
          </WidgetErrorBoundary>
        </div>

        {/* Goal Progress Section */}
        <WidgetErrorBoundary title="Active Goals">
          <GoalProgressWidget state={state} />
        </WidgetErrorBoundary>
      </div>
    </div>
  );
}

// --- SUB-WIDGET COMPONENTS ---

function KpiSection({ state }: { state: any }) {
  const overview = SelectorEngine.getDashboardOverview(state);
  const activeLoans = SelectorEngine.getActiveLoans(state);
  const loanOutstanding = SelectorEngine.getLoansOutstandingSummary(state);
  const accounts = state.accounts ?? [];

  const healthScore = overview.healthScore;
  const healthSub = healthScore >= 80 ? "Excellent standing" : healthScore >= 60 ? "Good standing" : "Needs attention";

  return (
    <div className="grid gap-4 px-6 md:grid-cols-2 md:gap-6 md:px-10 lg:grid-cols-5" aria-label="Key metrics summary">
      <KpiCard
        label="Net Worth"
        value={formatINR(overview.netWorth, { compact: true })}
        sub={`Assets ${formatINR(overview.totalAssets, { compact: true })}`}
        icon={<Sparkles className="h-4 w-4 text-gold animate-pulse" />}
        accent="gold"
      />
      <KpiCard
        label="Cash & Bank"
        value={formatINR(overview.cashBalance, { compact: true })}
        sub={`${accounts.length} accounts`}
        icon={<Wallet className="h-4 w-4 text-primary" />}
      />
      <KpiCard
        label="Investments"
        value={formatINR(overview.investmentBalance, { compact: true })}
        sub={`${overview.unrealizedPl >= 0 ? "+" : ""}${formatINR(overview.unrealizedPl, { compact: true })} unrealised`}
        icon={<TrendingUp className="h-4 w-4 text-success" />}
        trend={overview.unrealizedPl >= 0 ? "up" : "down"}
      />
      <KpiCard
        label="Loans Outstanding"
        value={formatINR(loanOutstanding, { compact: true })}
        sub={`${activeLoans.length} active`}
        icon={<Landmark className="h-4 w-4 text-gold" />}
      />
      <KpiCard
        label="Health Score"
        value={`${healthScore}/100`}
        sub={healthSub}
        icon={
          <ShieldCheck
            className={`h-4 w-4 ${
              healthScore >= 80
                ? "text-success"
                : healthScore >= 60
                ? "text-warning"
                : "text-destructive"
            }`}
          />
        }
      />
    </div>
  );
}

function CashFlowWidget({ state }: { state: any }) {
  const overview = SelectorEngine.getDashboardOverview(state);
  const trend = SelectorEngine.getMonthlyTrends(state);
  const transactions = state.transactions ?? [];

  return (
    <Card className="card-luxe p-6 h-full flex flex-col justify-between">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">Cash Flow</h3>
          <p className="text-xs text-muted-foreground">Income vs expense · last 6 months</p>
        </div>
        <div className="text-right text-xs text-muted-foreground" aria-live="polite">
          <div>Savings rate this month</div>
          <div className="font-numeric text-lg font-semibold text-foreground">
            {overview.savingsRate.toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="h-64 flex items-center justify-center">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center text-xs text-muted-foreground">
            <TrendingUp className="h-8 w-8 text-muted-foreground/35 mb-2" />
            No cash flow data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-gold)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis
                stroke="var(--color-muted-foreground)"
                fontSize={12}
                tickFormatter={(v) => formatINR(v, { compact: true })}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                }}
                formatter={(v: number) => formatINR(v)}
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#gInc)"
                name="Income"
              />
              <Area
                type="monotone"
                dataKey="expense"
                stroke="var(--color-gold)"
                strokeWidth={2}
                fill="url(#gExp)"
                name="Expense"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

function ExpenseMixWidget({ state }: { state: any }) {
  const catData = SelectorEngine.getTopExpenses(state);
  const PIE_COLORS = [
    "var(--color-primary)",
    "var(--color-gold)",
    "var(--color-success)",
    "var(--color-warning)",
    "var(--color-peach)",
    "var(--color-navy-soft)",
  ];

  return (
    <Card className="card-luxe p-6 h-full flex flex-col justify-between">
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground">Expense Mix</h3>
        <p className="text-xs text-muted-foreground">By category</p>
      </div>
      <div className="h-56 flex items-center justify-center mt-4">
        {catData.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center text-xs text-muted-foreground">
            <PieChart className="h-8 w-8 text-muted-foreground/35 mb-2" />
            No financial expense data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={catData}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
              >
                {catData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => formatINR(v)}
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

function RecentTransactionsWidget({ state }: { state: any }) {
  const transactions = SelectorEngine.getRecentTransactions(state);

  return (
    <Card className="card-luxe p-6 h-full flex flex-col justify-between">
      <div>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Recent Transactions</h3>
            <p className="text-xs text-muted-foreground">Latest transaction ledger entries</p>
          </div>
          <Link
            to="/transactions"
            className="text-xs font-medium text-primary hover:underline"
            aria-label="View all transactions"
          >
            View all →
          </Link>
        </div>
        <div className="mt-2">
          {transactions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No recent transactions.</div>
          ) : (
            <ul className="divide-y divide-border/60" role="list">
              {transactions.map((t: any) => (
                <li key={t.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        t.kind === "income" ? "bg-success/10 text-success" : "bg-muted text-foreground"
                      }`}
                    >
                      {t.kind === "income" ? (
                        <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{t.merchant || t.category}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.category} ·{" "}
                        {new Date(t.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`font-numeric text-sm font-semibold ${
                      t.kind === "income" ? "text-success" : "text-foreground"
                    }`}
                  >
                    {t.kind === "income" ? "+" : "−"}
                    {formatINR(t.amount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

function GoalProgressWidget({ state }: { state: any }) {
  const goals = SelectorEngine.getGoals(state).slice(0, 3);

  return (
    <Card className="card-luxe p-6 h-full flex flex-col justify-between">
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground">Goal Progress</h3>
        <p className="text-xs text-muted-foreground">Top active savings targets</p>
      </div>
      <div className="mt-4 space-y-4">
        {goals.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No active goals.</div>
        ) : (
          goals.map((g: any) => {
            const { progress, goalHealth } = g.metrics;
            const healthColor =
              goalHealth === "Excellent"
                ? "text-success"
                : goalHealth === "Good"
                ? "text-primary"
                : goalHealth === "Warning"
                ? "text-warning"
                : "text-destructive";
            return (
              <div key={g.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{g.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold uppercase ${healthColor}`}>
                      {goalHealth}
                    </span>
                    <span className="font-numeric text-xs text-muted-foreground">
                      {formatINR(g.saved, { compact: true })} /{" "}
                      {formatINR(g.target, { compact: true })}
                    </span>
                  </div>
                </div>
                <Progress
                  value={progress}
                  className={`h-1.5 ${g.metrics.isCompleted ? "[&>div]:bg-success" : ""}`}
                  aria-label={`${g.name} progress: ${progress.toFixed(0)}%`}
                />
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

// --- PRESENTATIONAL HELPERS ---

function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  accent?: "gold";
  trend?: "up" | "down";
}) {
  return (
    <Card
      className={`card-luxe relative overflow-hidden p-5 ${
        accent === "gold" ? "ring-1 ring-gold/30" : ""
      }`}
    >
      {accent === "gold" && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div
        className={`mt-3 font-numeric text-2xl font-semibold ${
          accent === "gold" ? "text-gold" : "text-foreground"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div
          className={`mt-1 text-xs ${
            trend === "up"
              ? "text-success"
              : trend === "down"
              ? "text-destructive"
              : "text-muted-foreground"
          }`}
        >
          {sub}
        </div>
      )}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 pb-10 animate-pulse p-6 md:p-10">
      <div className="h-8 w-64 bg-muted rounded mb-2" />
      <div className="h-4 w-96 bg-muted rounded mb-8" />
      <div className="h-32 bg-muted rounded-xl mb-6" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-28 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 h-80 bg-muted rounded-xl" />
        <div className="h-80 bg-muted rounded-xl" />
      </div>
    </div>
  );
}

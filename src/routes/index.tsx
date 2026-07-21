import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { formatINR } from "@/lib/format";
import { SelectorEngine } from "@/lib/financial-engine";
import { PageHeader } from "@/components/page-header";
import { ChecklistWidget } from "@/components/checklist-widget";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Wallet, Landmark, Sparkles, ShieldCheck } from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard · GloriousFinance" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { state } = useStore();
  const { accounts, transactions, investments, loans, goals, budgets } = state;

  const totals = useMemo(() => {
    const db = SelectorEngine.getDashboard(state);
    const summary = SelectorEngine.getPortfolioSummary(state);
    return { assets: db.totalAssets, liabilities: db.totalLiabilities, netWorth: db.netWorth, income: db.monthlyIncome, expense: db.monthlyExpense, savingsRate: db.savingsRate, invReturn: summary.unrealizedPl };
  }, [state]);

  const healthScore = useMemo(() => {
    return SelectorEngine.getDashboard(state).healthScore;
  }, [state]);

  const trend = useMemo(() => {
    const buckets: Record<string, { m: string; income: number; expense: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      buckets[k] = { m: d.toLocaleDateString("en-IN", { month: "short" }), income: 0, expense: 0 };
    }
    transactions.forEach(t => {
      const d = new Date(t.date);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (buckets[k]) {
        if (t.kind === "income") buckets[k].income += t.amount;
        if (t.kind === "expense") buckets[k].expense += t.amount;
      }
    });
    return Object.values(buckets);
  }, [transactions]);

  const catData = useMemo(() => {
    const map = new Map<string, number>();
    transactions.filter(t => t.kind === "expense").forEach(t => map.set(t.category, (map.get(t.category) || 0) + t.amount));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [transactions]);

  const PIE_COLORS = ["var(--color-primary)", "var(--color-gold)", "var(--color-success)", "var(--color-warning)", "var(--color-peach)", "var(--color-navy-soft)"];

  return (
    <div>
      <PageHeader
        title={`Good ${greet()}, ${state.profile.name.split(" ")[0]}`}
        subtitle="Your financial position at a glance — private, precise, and current."
      />
      <ChecklistWidget />
      <div className="grid gap-4 p-6 md:grid-cols-2 md:gap-6 md:p-10 lg:grid-cols-5">
        <KpiCard label="Net Worth" value={formatINR(totals.netWorth, { compact: true })} sub={`Assets ${formatINR(totals.assets, { compact: true })}`} icon={<Sparkles className="h-4 w-4 text-gold" />} accent="gold" />
        <KpiCard label="Cash & Bank" value={formatINR(SelectorEngine.getDashboard(state).cashBalance, { compact: true })} sub={`${accounts.length} accounts`} icon={<Wallet className="h-4 w-4" />} />
        <KpiCard label="Investments" value={formatINR(SelectorEngine.getDashboard(state).investmentBalance, { compact: true })} sub={`${totals.invReturn >= 0 ? "+" : ""}${formatINR(totals.invReturn, { compact: true })} unrealised`} icon={<TrendingUp className="h-4 w-4" />} trend={totals.invReturn >= 0 ? "up" : "down"} />
        <KpiCard label="Loans Outstanding" value={formatINR(SelectorEngine.getLoansOutstandingSummary(state), { compact: true })} sub={`${SelectorEngine.getActiveLoans(state).length} active`} icon={<Landmark className="h-4 w-4" />} />
        <KpiCard label="Health Score" value={`${healthScore}/100`} sub={healthScore >= 80 ? "Excellent standing" : healthScore >= 60 ? "Good standing" : "Needs attention"} icon={<ShieldCheck className={`h-4 w-4 ${healthScore >= 80 ? "text-success" : healthScore >= 60 ? "text-warning" : "text-destructive"}`} />} />
      </div>

      <div className="grid gap-6 px-6 pb-6 md:px-10 md:pb-10 lg:grid-cols-3">
        <Card className="card-luxe p-6 lg:col-span-2">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold">Cash Flow</h3>
              <p className="text-xs text-muted-foreground">Income vs expense · last 6 months</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Savings rate this month</div>
              <div className="font-numeric text-lg font-semibold text-foreground">{totals.savingsRate.toFixed(1)}%</div>
            </div>
          </div>
          <div className="h-64 flex items-center justify-center">
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center text-xs text-muted-foreground">
                <TrendingUp className="h-8 w-8 text-muted-foreground/35 mb-2" />
                No financial data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} /><stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-gold)" stopOpacity={0.35} /><stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => formatINR(v, { compact: true })} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} formatter={(v: number) => formatINR(v)} />
                  <Area type="monotone" dataKey="income" stroke="var(--color-primary)" strokeWidth={2} fill="url(#gInc)" />
                  <Area type="monotone" dataKey="expense" stroke="var(--color-gold)" strokeWidth={2} fill="url(#gExp)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="card-luxe p-6">
          <h3 className="font-display text-lg font-semibold">Expense Mix</h3>
          <p className="text-xs text-muted-foreground">By category</p>
          <div className="h-56 flex items-center justify-center">
            {catData.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center text-xs text-muted-foreground">
                <PieChart className="h-8 w-8 text-muted-foreground/35 mb-2" />
                No financial data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={catData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="card-luxe p-6 lg:col-span-2">
          <div className="mb-4 flex items-end justify-between">
            <h3 className="font-display text-lg font-semibold">Recent Transactions</h3>
            <Link to="/transactions" className="text-xs font-medium text-primary hover:underline">View all →</Link>
          </div>
          <div className="mt-2">
            {transactions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No recent transactions.</div>
            ) : (
              <ul className="divide-y divide-border/60">
                {transactions.slice(0, 6).map(t => (
                  <li key={t.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${t.kind === "income" ? "bg-success/10 text-success" : "bg-muted text-foreground"}`}>
                        {t.kind === "income" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{t.merchant || t.category}</div>
                        <div className="text-xs text-muted-foreground">{t.category} · {new Date(t.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</div>
                      </div>
                    </div>
                    <div className={`font-numeric text-sm font-semibold ${t.kind === "income" ? "text-success" : "text-foreground"}`}>
                      {t.kind === "income" ? "+" : "−"}{formatINR(t.amount)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="card-luxe p-6">
          <h3 className="font-display text-lg font-semibold">Goal Progress</h3>
          <p className="text-xs text-muted-foreground">Top savings targets</p>
          <div className="mt-4 space-y-4">
            {goals.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No active goals.</div>
            ) : (
              SelectorEngine.getGoals(state).slice(0, 3).map(g => {
                const { progress, goalHealth } = g.metrics;
                const healthColor = goalHealth === "Excellent" ? "text-success" : goalHealth === "Good" ? "text-primary" : goalHealth === "Warning" ? "text-warning" : "text-destructive";
                return (
                  <div key={g.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{g.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold uppercase ${healthColor}`}>{goalHealth}</span>
                        <span className="font-numeric text-xs text-muted-foreground">{formatINR(g.saved, { compact: true })} / {formatINR(g.target, { compact: true })}</span>
                      </div>
                    </div>
                    <Progress value={progress} className={`mt-2 h-1.5 ${g.metrics.isCompleted ? "[&>div]:bg-success" : ""}`} />
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function greet() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function KpiCard({ label, value, sub, icon, accent, trend }: { label: string; value: string; sub?: string; icon?: React.ReactNode; accent?: "gold"; trend?: "up" | "down" }) {
  return (
    <Card className={`card-luxe relative overflow-hidden p-5 ${accent === "gold" ? "ring-1 ring-gold/30" : ""}`}>
      {accent === "gold" && <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className={`mt-3 font-numeric text-2xl font-semibold ${accent === "gold" ? "text-gold" : "text-foreground"}`}>{value}</div>
      {sub && <div className={`mt-1 text-xs ${trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : "text-muted-foreground"}`}>{sub}</div>}
    </Card>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { formatINR } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Wallet, Landmark, Sparkles } from "lucide-react";
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
  const { accounts, transactions, investments, loans, goals } = state;

  const totals = useMemo(() => {
    const assets = accounts.filter(a => a.balance > 0).reduce((s, a) => s + a.balance, 0)
      + investments.reduce((s, i) => s + i.current, 0);
    const liabilities = accounts.filter(a => a.balance < 0).reduce((s, a) => s - a.balance, 0)
      + loans.reduce((s, l) => s + l.outstanding, 0);
    const netWorth = assets - liabilities;
    const now = new Date();
    const monthTx = transactions.filter(t => {
      const d = new Date(t.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const income = monthTx.filter(t => t.kind === "income").reduce((s, t) => s + t.amount, 0);
    const expense = monthTx.filter(t => t.kind === "expense").reduce((s, t) => s + t.amount, 0);
    const savingsRate = income ? Math.max(0, ((income - expense) / income) * 100) : 0;
    const invReturn = investments.reduce((s, i) => s + (i.current - i.invested), 0);
    return { assets, liabilities, netWorth, income, expense, savingsRate, invReturn };
  }, [accounts, transactions, investments, loans]);

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
      <div className="grid gap-4 p-6 md:grid-cols-2 md:gap-6 md:p-10 lg:grid-cols-4">
        <KpiCard label="Net Worth" value={formatINR(totals.netWorth, { compact: true })} sub={`Assets ${formatINR(totals.assets, { compact: true })}`} icon={<Sparkles className="h-4 w-4 text-gold" />} accent="gold" />
        <KpiCard label="Cash & Bank" value={formatINR(accounts.filter(a => a.type !== "credit_card").reduce((s, a) => s + a.balance, 0), { compact: true })} sub={`${accounts.length} accounts`} icon={<Wallet className="h-4 w-4" />} />
        <KpiCard label="Investments" value={formatINR(investments.reduce((s, i) => s + i.current, 0), { compact: true })} sub={`${totals.invReturn >= 0 ? "+" : ""}${formatINR(totals.invReturn, { compact: true })} unrealised`} icon={<TrendingUp className="h-4 w-4" />} trend={totals.invReturn >= 0 ? "up" : "down"} />
        <KpiCard label="Loans Outstanding" value={formatINR(loans.reduce((s, l) => s + l.outstanding, 0), { compact: true })} sub={`${loans.length} active`} icon={<Landmark className="h-4 w-4" />} />
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
          <div className="h-64">
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
          </div>
        </Card>

        <Card className="card-luxe p-6">
          <h3 className="font-display text-lg font-semibold">Expense Mix</h3>
          <p className="text-xs text-muted-foreground">By category</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="card-luxe p-6 lg:col-span-2">
          <div className="mb-4 flex items-end justify-between">
            <h3 className="font-display text-lg font-semibold">Recent Transactions</h3>
            <a href="/transactions" className="text-xs font-medium text-primary hover:underline">View all →</a>
          </div>
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
        </Card>

        <Card className="card-luxe p-6">
          <h3 className="font-display text-lg font-semibold">Goal Progress</h3>
          <p className="text-xs text-muted-foreground">Top savings targets</p>
          <div className="mt-4 space-y-4">
            {goals.slice(0, 3).map(g => {
              const p = Math.min(100, (g.saved / g.target) * 100);
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{g.name}</span>
                    <span className="font-numeric text-xs text-muted-foreground">{formatINR(g.saved, { compact: true })} / {formatINR(g.target, { compact: true })}</span>
                  </div>
                  <Progress value={p} className="mt-2 h-1.5" />
                </div>
              );
            })}
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

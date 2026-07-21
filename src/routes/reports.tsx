import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { formatINR, formatDate } from "@/lib/format";
import { SelectorEngine, ExportEngine, MetricsRegistry } from "@/lib/financial-engine";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WidgetErrorBoundary } from "@/components/widget-error-boundary";
import {
  FileDown,
  TrendingUp,
  FileText,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Search,
  Sparkles,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Financial Intelligence Reports · GloriousFinance" }] }),
  component: ReportsPage,
});

type ReportTemplate =
  | "income"
  | "expense"
  | "cash_flow"
  | "net_worth"
  | "budget"
  | "goal"
  | "loan"
  | "investment"
  | "bills_subscriptions"
  | "tax_ready";

function ReportsPage() {
  const { state, loading } = useStore();

  // Filters State
  const [template, setTemplate] = useState<ReportTemplate>("cash_flow");
  const [presetRange, setPresetRange] = useState<"30days" | "90days" | "custom">("30days");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [merchantQuery, setMerchantQuery] = useState<string>("");

  // Resolving dates based on preset
  const finalRange = useMemo(() => {
    const now = new Date();
    if (presetRange === "30days") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return { from: d.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
    }
    if (presetRange === "90days") {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      return { from: d.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
    }
    return { from: fromDate, to: toDate };
  }, [presetRange, fromDate, toDate]);

  // Construct filters
  const filters = useMemo(() => {
    return {
      dateRange: finalRange,
      accountId: selectedAccount !== "all" ? selectedAccount : undefined,
      category: selectedCategory !== "all" ? selectedCategory : undefined,
      merchant: merchantQuery.trim() !== "" ? merchantQuery : undefined,
    };
  }, [finalRange, selectedAccount, selectedCategory, merchantQuery]);

  // Call Report selector
  const reportPayload = useMemo(() => {
    if (loading) return null;
    return SelectorEngine.getReport(state, template, filters);
  }, [state, template, filters, loading]);

  // Deterministic Forecasts
  const netWorthForecast = useMemo(() => {
    if (loading) return [];
    return SelectorEngine.getNetWorthForecast(state, 6);
  }, [state, loading]);

  const cashFlowForecast = useMemo(() => {
    if (loading) return [];
    return SelectorEngine.getCashFlowForecast(state, 6);
  }, [state, loading]);

  if (loading || !reportPayload) {
    return <ReportsSkeleton />;
  }

  // Categories list for filter dropdown
  const uniqueCategories = Array.from(
    new Set((state.transactions ?? []).map((t) => t.category))
  ).filter(Boolean);

  // Accounts list for filter dropdown
  const accounts = state.accounts ?? [];

  return (
    <div className="space-y-6 pb-12" role="main" aria-label="Financial Intelligence Console">
      <PageHeader
        title="Financial Intelligence & Analytics"
        subtitle="Canonical, zero-overhead financial statements, deterministic growth models, and exports."
      />

      <div className="grid gap-6 px-6 md:px-10 lg:grid-cols-4">
        {/* Sidebar Controls */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="card-luxe p-5 space-y-5">
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-widest">
                Statement Template
              </h3>
              <p className="text-xs text-muted-foreground">Select report structure</p>
            </div>
            
            <div className="space-y-2">
              <Select value={template} onValueChange={(val) => setTemplate(val as ReportTemplate)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash_flow">Cash Flow Statement</SelectItem>
                  <SelectItem value="net_worth">Net Worth Balance Sheet</SelectItem>
                  <SelectItem value="income">Income Distribution</SelectItem>
                  <SelectItem value="expense">Expense Performance</SelectItem>
                  <SelectItem value="budget">Budget Utilization</SelectItem>
                  <SelectItem value="goal">Goal Capital Targets</SelectItem>
                  <SelectItem value="loan">Amortization & Debt</SelectItem>
                  <SelectItem value="investment">Wealth Portfolio</SelectItem>
                  <SelectItem value="bills_subscriptions">Obligations & Subs</SelectItem>
                  <SelectItem value="tax_ready">Tax Exposure Bracket</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="card-luxe p-5 space-y-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-widest">
                Filter Engine
              </h3>
              <p className="text-xs text-muted-foreground">Adjust filters & dates</p>
            </div>

            {/* Date Range Preset */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Date Window</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["30days", "90days", "custom"] as const).map((r) => (
                  <Button
                    key={r}
                    type="button"
                    variant={presetRange === r ? "default" : "outline"}
                    onClick={() => setPresetRange(r)}
                    className="text-[10px] h-7 px-1 capitalize"
                  >
                    {r === "30days" ? "30 Days" : r === "90days" ? "90 Days" : "Custom"}
                  </Button>
                ))}
              </div>
            </div>

            {presetRange === "custom" && (
              <div className="grid grid-cols-2 gap-2 animate-fadeIn">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Start</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs px-2"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">End</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs px-2"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Account Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Account</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Merchant query */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Merchant Source</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search merchant..."
                  value={merchantQuery}
                  onChange={(e) => setMerchantQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
          </Card>

          {/* Export Panel */}
          <Card className="card-luxe p-5 space-y-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-widest">
                Export Branded Statement
              </h3>
              <p className="text-xs text-muted-foreground">Download in physical formats</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="w-full text-xs h-9 justify-center gap-1.5"
                onClick={() => ExportEngine.exportToPdf(reportPayload)}
              >
                <FileDown className="h-3.5 w-3.5" /> PDF
              </Button>
              <Button
                variant="outline"
                className="w-full text-xs h-9 justify-center gap-1.5"
                onClick={() => ExportEngine.exportToCsv(reportPayload)}
              >
                <FileDown className="h-3.5 w-3.5" /> CSV
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full text-xs h-8 text-muted-foreground justify-center gap-1"
              onClick={() => ExportEngine.exportToJson(reportPayload)}
            >
              Export raw JSON payload
            </Button>
          </Card>
        </div>

        {/* Report Display Console */}
        <div className="lg:col-span-3 space-y-6">
          {/* Header Preview Band */}
          <WidgetErrorBoundary title="Executive Metrics Summary">
            <Card className="card-luxe relative overflow-hidden p-6">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-gold to-primary" />
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    <FileText className="h-3.5 w-3.5" /> Previewing Statement
                  </div>
                  <h2 className="mt-1 font-display text-2xl font-bold text-foreground">
                    {reportPayload.title}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{reportPayload.subtitle}</p>
                </div>
                <div className="flex items-center gap-2 self-start md:self-center text-xs bg-muted/50 px-3 py-1.5 rounded-full text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {formatDate(reportPayload.dateRange.from)} to {formatDate(reportPayload.dateRange.to)}
                  </span>
                </div>
              </div>

              {/* KPI metrics */}
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(reportPayload.metrics).map(([key, val]) => (
                  <div key={key} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {key}
                    </div>
                    <div className="mt-1 font-display text-lg font-bold text-foreground">{val}</div>
                  </div>
                ))}
              </div>
            </Card>
          </WidgetErrorBoundary>

          {/* Chart Section */}
          {reportPayload.charts && reportPayload.charts.length > 0 && (
            <WidgetErrorBoundary title="Statement Trends Chart">
              <Card className="card-luxe p-6">
                <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-widest mb-4">
                  Visual Statement Model
                </h3>
                <div className="h-64 flex items-center justify-center">
                  {reportPayload.charts[0].data.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No trend data available for filters</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      {reportPayload.charts[0].type === "pie" ? (
                        <PieChart>
                          <Pie
                            data={reportPayload.charts[0].data}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                          >
                            {reportPayload.charts[0].data.map((_, index) => (
                              <Cell
                                key={index}
                                fill={
                                  [
                                    "var(--color-primary)",
                                    "var(--color-gold)",
                                    "var(--color-success)",
                                    "var(--color-warning)",
                                    "var(--color-peach)",
                                  ][index % 5]
                                }
                              />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: any) => formatINR(v)} />
                          <Legend />
                        </PieChart>
                      ) : reportPayload.charts[0].type === "area" ? (
                        <AreaChart data={reportPayload.charts[0].data}>
                          <defs>
                            <linearGradient id="chartInc" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="chartExp" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--color-gold)" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={11} />
                          <YAxis
                            stroke="var(--color-muted-foreground)"
                            fontSize={11}
                            tickFormatter={(v) => formatINR(v, { compact: true })}
                          />
                          <Tooltip formatter={(v: any) => formatINR(v)} />
                          <Area
                            type="monotone"
                            dataKey="income"
                            stroke="var(--color-primary)"
                            strokeWidth={2}
                            fill="url(#chartInc)"
                            name="Income"
                          />
                          <Area
                            type="monotone"
                            dataKey="expense"
                            stroke="var(--color-gold)"
                            strokeWidth={2}
                            fill="url(#chartExp)"
                            name="Expense"
                          />
                        </AreaChart>
                      ) : (
                        <BarChart data={reportPayload.charts[0].data}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} />
                          <YAxis
                            stroke="var(--color-muted-foreground)"
                            fontSize={11}
                            tickFormatter={(v) => formatINR(v, { compact: true })}
                          />
                          <Tooltip formatter={(v: any) => formatINR(v)} />
                          <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
            </WidgetErrorBoundary>
          )}

          {/* Details Table List */}
          {reportPayload.sections.map((section, idx) => (
            <WidgetErrorBoundary key={idx} title={section.title}>
              <Card className="card-luxe p-6">
                <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-widest mb-4">
                  {section.title}
                </h3>
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <table className="w-full text-left border-collapse" role="table">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/80 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {section.headers.map((h, hIdx) => (
                          <th key={hIdx} className="p-3" role="columnheader">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 text-xs">
                      {section.rows.length === 0 ? (
                        <tr>
                          <td colSpan={section.headers.length} className="p-8 text-center text-muted-foreground">
                            No ledger entries found matching criteria.
                          </td>
                        </tr>
                      ) : (
                        section.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-muted/15 transition-colors">
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="p-3 font-medium text-foreground">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </WidgetErrorBoundary>
          ))}

          {/* Deterministic Forecast / Growth Engine Section */}
          <WidgetErrorBoundary title="Forward-Looking Projections">
            <Card className="card-luxe p-6">
              <div className="mb-4">
                <div className="flex items-center gap-1 text-xs text-primary uppercase tracking-wider font-semibold">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Growth Modeling Engine
                </div>
                <h3 className="mt-0.5 font-display text-base font-semibold text-foreground">
                  Deterministic Forecast Models
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  6-month future growth trends calculated using average monthly cash flows and allocations.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 mt-6">
                {/* Net Worth Forecast Chart */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Net Worth Projection Model
                  </h4>
                  <div className="h-44 bg-muted/10 border border-border/60 rounded-xl p-3 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={netWorthForecast}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={9} />
                        <YAxis
                          stroke="var(--color-muted-foreground)"
                          fontSize={9}
                          tickFormatter={(v) => formatINR(v, { compact: true })}
                        />
                        <Tooltip formatter={(v: any) => formatINR(v)} />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="var(--color-primary)"
                          strokeWidth={1.5}
                          fill="var(--color-primary-soft)"
                          name="Net Worth"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Cash Flow Forecast Chart */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Cash Flow Surplus Projection Model
                  </h4>
                  <div className="h-44 bg-muted/10 border border-border/60 rounded-xl p-3 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cashFlowForecast}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={9} />
                        <YAxis
                          stroke="var(--color-muted-foreground)"
                          fontSize={9}
                          tickFormatter={(v) => formatINR(v, { compact: true })}
                        />
                        <Tooltip formatter={(v: any) => formatINR(v)} />
                        <Bar dataKey="income" fill="var(--color-primary)" stackId="cf" name="Income" />
                        <Bar dataKey="expense" fill="var(--color-gold)" stackId="cf" name="Expense" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </Card>
          </WidgetErrorBoundary>
        </div>
      </div>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6 pb-12 animate-pulse p-6 md:p-10">
      <div className="h-8 w-64 bg-muted rounded mb-2" />
      <div className="h-4 w-96 bg-muted rounded mb-8" />
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="space-y-6 lg:col-span-1">
          <div className="h-32 bg-muted rounded-xl" />
          <div className="h-56 bg-muted rounded-xl" />
          <div className="h-32 bg-muted rounded-xl" />
        </div>
        <div className="lg:col-span-3 space-y-6">
          <div className="h-40 bg-muted rounded-xl" />
          <div className="h-72 bg-muted rounded-xl" />
          <div className="h-72 bg-muted rounded-xl" />
        </div>
      </div>
    </div>
  );
}

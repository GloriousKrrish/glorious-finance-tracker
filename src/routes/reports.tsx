import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useStore } from "@/lib/store";
import { formatINR, formatDate } from "@/lib/format";
import { SelectorEngine } from "@/lib/financial-engine";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown, FileText } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports · GloriousFinance" }] }),
  component: ReportsPage,
});

type Preset = "week" | "month" | "custom";

function ReportsPage() {
  const { state } = useStore();
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState(() => new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const range = useMemo(() => {
    const now = new Date();
    if (preset === "week") {
      const s = new Date(now); s.setDate(s.getDate() - 7);
      return { from: s.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
    }
    if (preset === "month") {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: s.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
    }
    return { from, to };
  }, [preset, from, to]);

  const txns = useMemo(() => state.transactions.filter(t => t.date >= range.from && t.date <= range.to)
    .sort((a, b) => a.date.localeCompare(b.date)), [state.transactions, range]);

  const summary = useMemo(() => {
    const income = txns.filter(t => t.kind === "income").reduce((s, t) => s + t.amount, 0);
    const expense = txns.filter(t => t.kind === "expense").reduce((s, t) => s + t.amount, 0);
    const byCat: Record<string, number> = {};
    txns.filter(t => t.kind === "expense").forEach(t => { byCat[t.category] = (byCat[t.category] ?? 0) + t.amount; });
    const budgetStatus = state.budgets.map(b => {
      const metrics = SelectorEngine.getBudgetMetrics(state, b);
      return { ...b, spent: metrics.spent };
    });
    // Rough tax proxy — informational only
    const gross = income * 12; // annualized rough estimate over the period assumption not applied
    return { income, expense, net: income - expense, byCat, budgetStatus, gross };
  }, [txns, state.budgets, state]);

  const generatePdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    const margin = 40;

    // Cover / header band
    doc.setFillColor(26, 54, 93); doc.rect(0, 0, w, 90, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(20);
    doc.text("GloriousFinance", margin, 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text("Private Wealth Console — Financial Report", margin, 58);
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(9);
    doc.text(`${formatDate(range.from)}  —  ${formatDate(range.to)}`, margin, 74);

    let y = 120;
    doc.setTextColor(26, 54, 93); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("EXECUTIVE SUMMARY", margin, y); y += 18;

    doc.setTextColor(40, 40, 40); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const rows: Array<[string, string]> = [
      ["Total Income", formatINR(summary.income)],
      ["Total Expenses", formatINR(summary.expense)],
      ["Net Cash Flow", formatINR(summary.net)],
      ["Savings Rate", summary.income > 0 ? `${((summary.net / summary.income) * 100).toFixed(1)}%` : "—"],
      ["Transactions", String(txns.length)],
    ];
    autoTable(doc, {
      startY: y, head: [["Metric", "Value"]], body: rows,
      theme: "plain", margin: { left: margin, right: margin },
      headStyles: { fillColor: [245, 240, 232], textColor: [80, 80, 80], fontStyle: "bold" },
      bodyStyles: { textColor: [30, 30, 30] },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    });
    y = (doc as any).lastAutoTable.finalY + 24;

    // Category breakdown
    doc.setTextColor(26, 54, 93); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("SPEND BY CATEGORY", margin, y); y += 8;
    autoTable(doc, {
      startY: y + 4,
      head: [["Category", "Amount", "% of Expenses"]],
      body: Object.entries(summary.byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => [
        c, formatINR(v), summary.expense > 0 ? `${((v / summary.expense) * 100).toFixed(1)}%` : "—",
      ]),
      theme: "striped", margin: { left: margin, right: margin },
      headStyles: { fillColor: [26, 54, 93], textColor: 255 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 24;

    // Budget performance
    if (summary.budgetStatus.length) {
      if (y > 700) { doc.addPage(); y = 60; }
      doc.setTextColor(26, 54, 93); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text("BUDGET PERFORMANCE", margin, y); y += 8;
      autoTable(doc, {
        startY: y + 4,
        head: [["Category", "Limit", "Spent", "Remaining", "Status"]],
        body: summary.budgetStatus.map(b => {
          const rem = b.limit - b.spent;
          return [b.category, formatINR(b.limit), formatINR(b.spent), formatINR(rem), rem < 0 ? "Over budget" : rem < b.limit * 0.2 ? "Watch" : "On track"];
        }),
        theme: "striped", margin: { left: margin, right: margin },
        headStyles: { fillColor: [26, 54, 93], textColor: 255 },
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      });
      y = (doc as any).lastAutoTable.finalY + 24;
    }

    // Transactions ledger
    doc.addPage(); y = 60;
    doc.setTextColor(26, 54, 93); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("TRANSACTION LEDGER", margin, y);
    autoTable(doc, {
      startY: y + 12,
      head: [["Date", "Kind", "Category", "Merchant", "Amount"]],
      body: txns.map(t => [
        formatDate(t.date), t.kind, t.category, t.merchant ?? "—",
        (t.kind === "expense" ? "-" : t.kind === "income" ? "+" : "") + formatINR(t.amount),
      ]),
      theme: "striped", margin: { left: margin, right: margin }, styles: { fontSize: 9 },
      headStyles: { fillColor: [26, 54, 93], textColor: 255 },
      columnStyles: { 4: { halign: "right" } },
    });

    // Footer on all pages
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(120, 120, 120);
      doc.text(`GloriousFinance · Generated ${new Date().toLocaleString("en-IN")}`, margin, doc.internal.pageSize.getHeight() - 20);
      doc.text(`Page ${i} of ${pages}`, w - margin, doc.internal.pageSize.getHeight() - 20, { align: "right" });
    }

    doc.save(`GloriousFinance-Report-${range.from}_to_${range.to}.pdf`);
  };

  return (
    <div>
      <PageHeader title="Reports" subtitle="Branded PDF summaries of your cash flow, budgets and ledger." />
      <div className="grid gap-6 p-6 md:grid-cols-3 md:p-10">
        <Card className="card-luxe p-6 md:col-span-1">
          <h3 className="font-display text-lg font-semibold">Configure report</h3>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {(["week", "month", "custom"] as Preset[]).map(p => (
                <Button key={p} type="button" variant={preset === p ? "default" : "outline"} onClick={() => setPreset(p)} className="capitalize">
                  {p}
                </Button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
              </div>
            )}
            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              Range: <span className="font-medium text-foreground">{formatDate(range.from)} → {formatDate(range.to)}</span>
            </div>
            <Button className="w-full" onClick={generatePdf}>
              <FileDown className="mr-2 h-4 w-4" />Download PDF report
            </Button>
          </div>
        </Card>

        <Card className="card-luxe p-6 md:col-span-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />Preview
          </div>
          <h3 className="mt-1 font-display text-xl font-semibold">Executive Summary</h3>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Kpi label="Income" value={formatINR(summary.income)} />
            <Kpi label="Expenses" value={formatINR(summary.expense)} />
            <Kpi label="Net Cash Flow" value={formatINR(summary.net)} accent={summary.net >= 0 ? "success" : "danger"} />
            <Kpi label="Savings Rate" value={summary.income > 0 ? `${((summary.net / summary.income) * 100).toFixed(1)}%` : "—"} />
          </div>

          <h4 className="mt-8 font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">Spend by category</h4>
          <div className="mt-3 divide-y divide-border/60">
            {Object.entries(summary.byCat).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, v]) => (
              <div key={c} className="flex items-center justify-between py-2 text-sm">
                <span>{c}</span>
                <span className="font-numeric font-medium">{formatINR(v)}</span>
              </div>
            ))}
            {Object.keys(summary.byCat).length === 0 && (
              <div className="py-4 text-sm text-muted-foreground">No expenses in this period.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "success" | "danger" }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-xl font-semibold ${accent === "success" ? "text-success" : accent === "danger" ? "text-destructive" : ""}`}>
        {value}
      </div>
    </div>
  );
}

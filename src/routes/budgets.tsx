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
import { toast } from "sonner";

export const Route = createFileRoute("/budgets")({
  head: () => ({ meta: [{ title: "Budgets · GloriousFinance" }] }),
  component: BudgetsPage,
});

const empty = (): Budget => ({ id: uid(), category: "Food", limit: 0, period: "monthly" });

function BudgetForm({ initial, onSubmit, onCancel }: { initial: Budget; onSubmit: (b: Budget) => void; onCancel: () => void }) {
  const [b, setB] = useState<Budget>(initial);
  const set = <K extends keyof Budget>(k: K, v: Budget[K]) => setB(p => ({ ...p, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!b.limit) return toast.error("Set a limit"); onSubmit(b); }} className="space-y-4">
      <FormDialogHeader title={initial.limit ? "Edit budget" : "New budget"} />
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Category</Label>
          <Select value={b.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Period</Label>
          <Select value={b.period} onValueChange={(v) => set("period", v as Budget["period"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label>Limit (₹)</Label><Input type="number" step="0.01" value={b.limit || ""} onChange={(e) => set("limit", parseFloat(e.target.value) || 0)} /></div>
      </div>
      <FormFooter onCancel={onCancel} />
    </form>
  );
}

function BudgetsPage() {
  const { state, dispatch } = useStore();
  const [openAdd, setOpenAdd] = useState(false);

  const spend = useMemo(() => {
    const now = new Date();
    const map = new Map<string, number>();
    state.transactions.filter(t => t.kind === "expense").forEach(t => {
      const d = new Date(t.date);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        map.set(t.category, (map.get(t.category) || 0) + t.amount);
      }
    });
    return map;
  }, [state.transactions]);

  return (
    <div>
      <PageHeader title="Budgets" subtitle="Envelope-style limits with live progress from your transactions."
        action={<AddButton label="Add budget" open={openAdd} onOpenChange={setOpenAdd}>
          <BudgetForm initial={empty()} onCancel={() => setOpenAdd(false)} onSubmit={(b) => { dispatch({ type: "budget:add", payload: b }); setOpenAdd(false); toast.success("Budget added"); }} />
        </AddButton>}
      />
      <div className="grid gap-4 p-6 md:grid-cols-2 md:p-10 lg:grid-cols-3">
        {state.budgets.map(b => {
          const used = spend.get(b.category) || 0;
          const p = Math.min(100, (used / b.limit) * 100);
          const over = used > b.limit;
          return (
            <Card key={b.id} className="card-luxe p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">{b.period}</div>
                  <div className="mt-1 font-display text-lg font-semibold">{b.category}</div>
                </div>
                <div className="flex">
                  <EditIconButton>{(close) => <BudgetForm initial={b} onCancel={close} onSubmit={(u) => { dispatch({ type: "budget:update", payload: u }); close(); toast.success("Updated"); }} />}</EditIconButton>
                  <DeleteIconButton itemLabel="budget" onConfirm={() => { dispatch({ type: "budget:remove", payload: b.id }); toast.success("Deleted"); }} />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <div className="font-numeric text-2xl font-semibold">{formatINR(used, { compact: true })}</div>
                <div className="text-xs text-muted-foreground">of {formatINR(b.limit, { compact: true })}</div>
              </div>
              <Progress value={p} className={`mt-3 h-1.5 ${over ? "[&>div]:bg-destructive" : ""}`} />
              <div className={`mt-2 text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>
                {over ? `Over by ${formatINR(used - b.limit)}` : `${formatINR(b.limit - used)} remaining`}
              </div>
            </Card>
          );
        })}
        {state.budgets.length === 0 && <Card className="card-luxe col-span-full p-12 text-center text-sm text-muted-foreground">No budgets yet. Create your first envelope.</Card>}
      </div>
    </div>
  );
}

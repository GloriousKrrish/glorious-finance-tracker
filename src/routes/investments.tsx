import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore, uid, type Investment } from "@/lib/store";
import { formatINR } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { AddButton, EditIconButton, DeleteIconButton, FormDialogHeader, FormFooter } from "@/components/crud";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

export const Route = createFileRoute("/investments")({
  head: () => ({ meta: [{ title: "Investments · GloriousFinance" }] }),
  component: InvPage,
});

const TYPES: { v: Investment["type"]; label: string }[] = [
  { v: "stock", label: "Stock" }, { v: "mutual_fund", label: "Mutual Fund" }, { v: "gold", label: "Gold" },
  { v: "fd", label: "Fixed Deposit" }, { v: "ppf", label: "PPF" }, { v: "nps", label: "NPS" },
  { v: "bond", label: "Bond" }, { v: "crypto", label: "Crypto" }, { v: "other", label: "Other" },
];

const empty = (): Investment => ({ id: uid(), name: "", type: "mutual_fund", invested: 0, current: 0 });

function InvForm({ initial, onSubmit, onCancel }: { initial: Investment; onSubmit: (i: Investment) => void; onCancel: () => void }) {
  const [i, setI] = useState<Investment>(initial);
  const set = <K extends keyof Investment>(k: K, v: Investment[K]) => setI(p => ({ ...p, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!i.name) return toast.error("Name required"); onSubmit(i); }} className="space-y-4">
      <FormDialogHeader title={initial.name ? "Edit holding" : "New holding"} />
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Name</Label><Input value={i.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. HDFC Flexi Cap" /></div>
        <div><Label>Type</Label>
          <Select value={i.type} onValueChange={(v) => set("type", v as Investment["type"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Units</Label><Input type="number" step="0.0001" value={i.units || ""} onChange={(e) => set("units", parseFloat(e.target.value) || undefined)} /></div>
        <div><Label>Invested (₹)</Label><Input type="number" step="0.01" value={i.invested || ""} onChange={(e) => set("invested", parseFloat(e.target.value) || 0)} /></div>
        <div><Label>Current value (₹)</Label><Input type="number" step="0.01" value={i.current || ""} onChange={(e) => set("current", parseFloat(e.target.value) || 0)} /></div>
      </div>
      <FormFooter onCancel={onCancel} />
    </form>
  );
}

function InvPage() {
  const { state, dispatch } = useStore();
  const [openAdd, setOpenAdd] = useState(false);

  const totals = useMemo(() => {
    const invested = state.investments.reduce((s, i) => s + i.invested, 0);
    const current = state.investments.reduce((s, i) => s + i.current, 0);
    return { invested, current, ret: current - invested, pct: invested ? ((current - invested) / invested) * 100 : 0 };
  }, [state.investments]);

  const alloc = useMemo(() => {
    const m = new Map<string, number>();
    state.investments.forEach(i => m.set(labelFor(i.type), (m.get(labelFor(i.type)) || 0) + i.current));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [state.investments]);

  const COLORS = ["var(--color-primary)", "var(--color-gold)", "var(--color-success)", "var(--color-warning)", "var(--color-peach)", "var(--color-navy-soft)", "#8a8fa3", "#c58a5d", "#7a94b8"];

  return (
    <div>
      <PageHeader title="Investments" subtitle="Track every holding — stocks, MFs, gold, PPF, NPS and more."
        action={<AddButton label="Add holding" open={openAdd} onOpenChange={setOpenAdd}>
          <InvForm initial={empty()} onCancel={() => setOpenAdd(false)} onSubmit={(i) => { dispatch({ type: "inv:add", payload: i }); setOpenAdd(false); toast.success("Holding added"); }} />
        </AddButton>}
      />
      <div className="grid gap-4 p-6 md:grid-cols-4 md:p-10">
        <Card className="card-luxe p-5 ring-1 ring-gold/30"><div className="text-xs uppercase tracking-widest text-muted-foreground">Portfolio Value</div><div className="mt-2 font-numeric text-2xl font-semibold text-gold">{formatINR(totals.current, { compact: true })}</div></Card>
        <Card className="card-luxe p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">Invested</div><div className="mt-2 font-numeric text-2xl font-semibold">{formatINR(totals.invested, { compact: true })}</div></Card>
        <Card className="card-luxe p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">Unrealised P/L</div><div className={`mt-2 font-numeric text-2xl font-semibold ${totals.ret >= 0 ? "text-success" : "text-destructive"}`}>{formatINR(totals.ret, { compact: true, sign: true })}</div></Card>
        <Card className="card-luxe p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">Return</div><div className={`mt-2 font-numeric text-2xl font-semibold ${totals.pct >= 0 ? "text-success" : "text-destructive"}`}>{totals.pct >= 0 ? "+" : ""}{totals.pct.toFixed(2)}%</div></Card>
      </div>

      <div className="grid gap-6 px-6 pb-10 md:px-10 lg:grid-cols-3">
        <Card className="card-luxe p-6">
          <h3 className="font-display text-lg font-semibold">Asset Allocation</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={alloc} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {alloc.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="card-luxe overflow-hidden lg:col-span-2">
          <div className="border-b border-border/60 p-4"><h3 className="font-display text-lg font-semibold">Holdings</h3></div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Type</TableHead>
                  <TableHead className="text-right">Invested</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">P/L</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.investments.map(inv => {
                  const pl = inv.current - inv.invested;
                  const pct = inv.invested ? (pl / inv.invested) * 100 : 0;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.name}{inv.units ? <div className="text-xs text-muted-foreground">{inv.units} units</div> : null}</TableCell>
                      <TableCell><Badge variant="secondary" className="font-normal">{labelFor(inv.type)}</Badge></TableCell>
                      <TableCell className="text-right font-numeric">{formatINR(inv.invested)}</TableCell>
                      <TableCell className="text-right font-numeric font-semibold">{formatINR(inv.current)}</TableCell>
                      <TableCell className={`text-right font-numeric ${pl >= 0 ? "text-success" : "text-destructive"}`}>{formatINR(pl, { sign: true })}<div className="text-xs">{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</div></TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <EditIconButton>{(close) => <InvForm initial={inv} onCancel={close} onSubmit={(u) => { dispatch({ type: "inv:update", payload: u }); close(); toast.success("Updated"); }} />}</EditIconButton>
                          <DeleteIconButton itemLabel="holding" onConfirm={() => { dispatch({ type: "inv:remove", payload: inv.id }); toast.success("Deleted"); }} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {state.investments.length === 0 && <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">Add your first holding to see analytics.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function labelFor(t: Investment["type"]) {
  return TYPES.find(x => x.v === t)?.label || t;
}

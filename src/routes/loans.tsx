import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, uid, type Loan } from "@/lib/store";
import { formatINR, todayISO } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { AddButton, EditIconButton, DeleteIconButton, FormDialogHeader, FormFooter } from "@/components/crud";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export const Route = createFileRoute("/loans")({
  head: () => ({ meta: [{ title: "Loans · GloriousFinance" }] }),
  component: LoansPage,
});

const TYPES: { v: Loan["type"]; label: string }[] = [
  { v: "home", label: "Home Loan" }, { v: "car", label: "Car Loan" }, { v: "personal", label: "Personal Loan" },
  { v: "education", label: "Education Loan" }, { v: "gold", label: "Gold Loan" }, { v: "business", label: "Business Loan" },
];

const empty = (): Loan => ({ id: uid(), name: "", type: "personal", principal: 0, outstanding: 0, rate: 0, emi: 0, tenureMonths: 12, startDate: todayISO() });

function LoanForm({ initial, onSubmit, onCancel }: { initial: Loan; onSubmit: (l: Loan) => void; onCancel: () => void }) {
  const [l, setL] = useState<Loan>(initial);
  const set = <K extends keyof Loan>(k: K, v: Loan[K]) => setL(p => ({ ...p, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!l.name) return toast.error("Name required"); onSubmit(l); }} className="space-y-4">
      <FormDialogHeader title={initial.name ? "Edit loan" : "New loan"} />
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Name</Label><Input value={l.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. HDFC Home Loan" /></div>
        <div><Label>Type</Label>
          <Select value={l.type} onValueChange={(v) => set("type", v as Loan["type"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Rate (% p.a.)</Label><Input type="number" step="0.01" value={l.rate || ""} onChange={(e) => set("rate", parseFloat(e.target.value) || 0)} /></div>
        <div><Label>Principal (₹)</Label><Input type="number" step="0.01" value={l.principal || ""} onChange={(e) => set("principal", parseFloat(e.target.value) || 0)} /></div>
        <div><Label>Outstanding (₹)</Label><Input type="number" step="0.01" value={l.outstanding || ""} onChange={(e) => set("outstanding", parseFloat(e.target.value) || 0)} /></div>
        <div><Label>EMI (₹)</Label><Input type="number" step="0.01" value={l.emi || ""} onChange={(e) => set("emi", parseFloat(e.target.value) || 0)} /></div>
        <div><Label>Tenure (months)</Label><Input type="number" value={l.tenureMonths || ""} onChange={(e) => set("tenureMonths", parseInt(e.target.value) || 0)} /></div>
        <div className="col-span-2"><Label>Start Date</Label><Input type="date" value={l.startDate} onChange={(e) => set("startDate", e.target.value)} /></div>
      </div>
      <FormFooter onCancel={onCancel} />
    </form>
  );
}

function LoansPage() {
  const { state, dispatch } = useStore();
  const [openAdd, setOpenAdd] = useState(false);
  const totalOut = state.loans.reduce((s, l) => s + l.outstanding, 0);
  const totalEmi = state.loans.reduce((s, l) => s + l.emi, 0);

  return (
    <div>
      <PageHeader title="Loans" subtitle="Home, car, personal — repayment progress and monthly obligations."
        action={<AddButton label="Add loan" open={openAdd} onOpenChange={setOpenAdd}>
          <LoanForm initial={empty()} onCancel={() => setOpenAdd(false)} onSubmit={(l) => { dispatch({ type: "loan:add", payload: l }); setOpenAdd(false); toast.success("Loan added"); }} />
        </AddButton>}
      />
      <div className="grid gap-4 p-6 md:grid-cols-3 md:p-10">
        <Card className="card-luxe p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">Total Outstanding</div><div className="mt-2 font-numeric text-2xl font-semibold">{formatINR(totalOut, { compact: true })}</div></Card>
        <Card className="card-luxe p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">Monthly EMI</div><div className="mt-2 font-numeric text-2xl font-semibold">{formatINR(totalEmi, { compact: true })}</div></Card>
        <Card className="card-luxe p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">Active Loans</div><div className="mt-2 font-numeric text-2xl font-semibold">{state.loans.length}</div></Card>
      </div>

      <div className="grid gap-4 px-6 pb-10 md:grid-cols-2 md:px-10">
        {state.loans.map(l => {
          const paid = l.principal - l.outstanding;
          const p = l.principal ? (paid / l.principal) * 100 : 0;
          return (
            <Card key={l.id} className="card-luxe p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">{TYPES.find(t => t.v === l.type)?.label}</div>
                  <div className="mt-1 font-display text-lg font-semibold">{l.name}</div>
                </div>
                <div className="flex">
                  <EditIconButton>{(close) => <LoanForm initial={l} onCancel={close} onSubmit={(u) => { dispatch({ type: "loan:update", payload: u }); close(); toast.success("Updated"); }} />}</EditIconButton>
                  <DeleteIconButton itemLabel="loan" onConfirm={() => { dispatch({ type: "loan:remove", payload: l.id }); toast.success("Deleted"); }} />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div><div className="text-xs text-muted-foreground">Outstanding</div><div className="mt-1 font-numeric font-semibold">{formatINR(l.outstanding, { compact: true })}</div></div>
                <div><div className="text-xs text-muted-foreground">EMI</div><div className="mt-1 font-numeric font-semibold">{formatINR(l.emi, { compact: true })}</div></div>
                <div><div className="text-xs text-muted-foreground">Rate</div><div className="mt-1 font-numeric font-semibold">{l.rate}%</div></div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground"><span>{p.toFixed(1)}% repaid</span><span>{formatINR(paid, { compact: true })} of {formatINR(l.principal, { compact: true })}</span></div>
                <Progress value={p} className="mt-2 h-1.5" />
              </div>
            </Card>
          );
        })}
        {state.loans.length === 0 && <Card className="card-luxe col-span-full p-12 text-center text-sm text-muted-foreground">No active loans</Card>}
      </div>
    </div>
  );
}

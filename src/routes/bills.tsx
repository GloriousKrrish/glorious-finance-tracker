import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore, uid, CATEGORIES, type Bill } from "@/lib/store";
import { formatINR, formatDate, todayISO } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { AddButton, EditIconButton, DeleteIconButton, FormDialogHeader, FormFooter } from "@/components/crud";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/bills")({
  head: () => ({ meta: [{ title: "Bills · GloriousFinance" }] }),
  component: BillsPage,
});

const empty = (): Bill => ({ id: uid(), name: "", amount: 0, dueDate: todayISO(), category: "Utilities", recurring: "monthly", paid: false });

function BillForm({ initial, onSubmit, onCancel }: { initial: Bill; onSubmit: (b: Bill) => void; onCancel: () => void }) {
  const [b, setB] = useState<Bill>(initial);
  const set = <K extends keyof Bill>(k: K, v: Bill[K]) => setB(p => ({ ...p, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!b.name) return toast.error("Name required"); onSubmit(b); }} className="space-y-4">
      <FormDialogHeader title={initial.name ? "Edit bill" : "New bill"} />
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Name</Label><Input value={b.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Electricity" /></div>
        <div><Label>Amount (₹)</Label><Input type="number" step="0.01" value={b.amount || ""} onChange={(e) => set("amount", parseFloat(e.target.value) || 0)} /></div>
        <div><Label>Due date</Label><Input type="date" value={b.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></div>
        <div><Label>Category</Label>
          <Select value={b.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Recurring</Label>
          <Select value={b.recurring} onValueChange={(v) => set("recurring", v as Bill["recurring"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">One-time</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <FormFooter onCancel={onCancel} />
    </form>
  );
}

function BillsPage() {
  const { state, dispatch } = useStore();
  const [openAdd, setOpenAdd] = useState(false);

  const upcoming = useMemo(() => {
    const list: Array<Bill & { isLoanEmi?: boolean; loanId?: string }> = state.bills.filter(b => !b.paid).map(b => ({ ...b }));
    
    // Add active loan EMIs as upcoming bills
    state.loans.forEach(l => {
      if (l.outstanding > 0 && l.emi > 0) {
        // Assume EMI is due on the 5th of this month or next month depending on current date
        const today = new Date();
        const due = new Date(today.getFullYear(), today.getMonth(), 5);
        if (due < today) {
          due.setMonth(due.getMonth() + 1);
        }

        // Check if there is already a transaction for this loan's EMI this month to avoid duplicates
        const alreadyPaidThisMonth = state.transactions.some(t => {
          const td = new Date(t.date);
          return t.category === "EMI" && 
                 t.merchant === `${l.name} EMI` && 
                 td.getMonth() === today.getMonth() && 
                 td.getFullYear() === today.getFullYear();
        });

        if (!alreadyPaidThisMonth) {
          list.push({
            id: `loan-emi-${l.id}`,
            name: `${l.name} EMI`,
            amount: l.emi,
            dueDate: due.toISOString().slice(0, 10),
            category: "EMI",
            recurring: "monthly",
            paid: false,
            isLoanEmi: true,
            loanId: l.id
          });
        }
      }
    });

    return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [state.bills, state.loans, state.transactions]);

  const paid = state.bills.filter(b => b.paid);
  const dueTotal = upcoming.reduce((s, b) => s + b.amount, 0);

  const toggle = (b: any) => {
    if (b.isLoanEmi) {
      const loan = state.loans.find(l => l.id === b.loanId);
      if (loan) {
        const bankAcc = state.accounts.find(a => a.type === "bank") || state.accounts[0];
        if (!bankAcc) return toast.error("Please add a bank account first in Accounts");

        dispatch({
          type: "txn:add",
          payload: {
            id: uid(),
            date: todayISO(),
            amount: b.amount,
            kind: "expense",
            category: "EMI",
            accountId: bankAcc.id,
            merchant: `${loan.name} EMI`,
            note: `EMI Payment for ${loan.name}`
          }
        });

        dispatch({
          type: "loan:update",
          payload: {
            ...loan,
            outstanding: Math.max(0, loan.outstanding - b.amount)
          }
        });

        toast.success(`EMI of ${formatINR(b.amount)} paid. Outstanding reduced.`);
      }
      return;
    }

    const isPaying = !b.paid;
    if (isPaying) {
      const bankAcc = state.accounts.find(a => a.type === "bank") || state.accounts[0];
      if (!bankAcc) return toast.error("Please add a bank account first in Accounts");

      dispatch({
        type: "txn:add",
        payload: {
          id: uid(),
          date: todayISO(),
          amount: b.amount,
          kind: "expense",
          category: b.category,
          accountId: bankAcc.id,
          merchant: b.name,
          note: `Bill payment for ${b.name}`
        }
      });
    }

    dispatch({ type: "bill:update", payload: { ...b, paid: isPaying } });
    toast.success(isPaying ? "Bill paid and transaction recorded" : "Bill marked unpaid");
  };

  return (
    <div>
      <PageHeader title="Bills & Subscriptions" subtitle="Never miss a due date. Track recurring obligations at a glance."
        action={<AddButton label="Add bill" open={openAdd} onOpenChange={setOpenAdd}>
          <BillForm initial={empty()} onCancel={() => setOpenAdd(false)} onSubmit={(b) => { dispatch({ type: "bill:add", payload: b }); setOpenAdd(false); toast.success("Bill added"); }} />
        </AddButton>}
      />
      <div className="grid gap-4 p-6 md:grid-cols-3 md:p-10">
        <Card className="card-luxe p-5 ring-1 ring-gold/30"><div className="text-xs uppercase tracking-widest text-muted-foreground">Due Total</div><div className="mt-2 font-numeric text-2xl font-semibold text-gold">{formatINR(dueTotal, { compact: true })}</div></Card>
        <Card className="card-luxe p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">Upcoming</div><div className="mt-2 font-numeric text-2xl font-semibold">{upcoming.length}</div></Card>
        <Card className="card-luxe p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">Paid</div><div className="mt-2 font-numeric text-2xl font-semibold text-success">{paid.length}</div></Card>
      </div>
      <div className="grid gap-4 px-6 pb-10 md:px-10 lg:grid-cols-2">
        {[...upcoming, ...paid].map(b => {
          const overdue = !b.paid && new Date(b.dueDate) < new Date();
          const isLoanEmi = (b as any).isLoanEmi;
          return (
            <Card key={b.id} className={`card-luxe flex items-center gap-4 p-5 ${overdue ? "ring-1 ring-destructive/40" : ""}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${b.paid ? "bg-success/10 text-success" : "bg-primary/5 text-primary"}`}>
                {b.paid ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2"><span className="font-semibold">{b.name}</span><Badge variant="secondary" className="font-normal">{b.category}</Badge>{b.recurring !== "none" && <Badge variant="outline" className="font-normal">{b.recurring}</Badge>}</div>
                <div className={`text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>Due {formatDate(b.dueDate)}{overdue ? " · overdue" : ""}</div>
              </div>
              <div className="font-numeric text-lg font-semibold">{formatINR(b.amount)}</div>
              <div className="flex items-center gap-1">
                {!b.paid && <Button variant="default" size="sm" onClick={() => toggle(b)}>Mark paid</Button>}
                {b.paid && !isLoanEmi && <Button variant="outline" size="sm" onClick={() => toggle(b)}>Unpay</Button>}
                {!isLoanEmi && (
                  <>
                    <EditIconButton>{(close) => <BillForm initial={b as Bill} onCancel={close} onSubmit={(u) => { dispatch({ type: "bill:update", payload: u }); close(); toast.success("Updated"); }} />}</EditIconButton>
                    <DeleteIconButton itemLabel="bill" onConfirm={() => { dispatch({ type: "bill:remove", payload: b.id }); toast.success("Deleted"); }} />
                  </>
                )}
              </div>
            </Card>
          );
        })}
        {state.bills.length === 0 && upcoming.length === 0 && paid.length === 0 && <Card className="card-luxe col-span-full p-12 text-center text-sm text-muted-foreground">No recurring bills</Card>}
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore, uid, CATEGORIES, type Transaction, type TxnKind } from "@/lib/store";
import { SelectorEngine } from "@/lib/financial-engine";
import { formatINR, formatDate, todayISO } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { AddButton, EditIconButton, DeleteIconButton, FormDialogHeader, FormFooter } from "@/components/crud";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, ArrowUpRight, ArrowDownRight, ArrowLeftRight } from "lucide-react";

export const Route = createFileRoute("/transactions")({
  head: () => ({ meta: [{ title: "Transactions · GloriousFinance" }] }),
  component: TxnPage,
});

const KINDS: { v: TxnKind; label: string }[] = [
  { v: "expense", label: "Expense" },
  { v: "income", label: "Income" },
  { v: "transfer", label: "Transfer" },
  { v: "loan_payment", label: "Loan Payment" },
  { v: "investment_purchase", label: "Investment Purchase" },
  { v: "investment_sale", label: "Investment Sale" },
  { v: "goal_contribution", label: "Goal Contribution" },
  { v: "bill_payment", label: "Bill Payment" },
  { v: "refund", label: "Refund" },
  { v: "interest", label: "Interest" },
  { v: "dividend", label: "Dividend" },
  { v: "adjustment", label: "Adjustment" },
];

const empty = (): Transaction => ({
  id: uid(), date: todayISO(), amount: 0, kind: "expense", category: "Food", accountId: "", merchant: "", note: "",
});

function TxnForm({ initial, onSubmit, onCancel }: { initial: Transaction; onSubmit: (t: Transaction) => void; onCancel: () => void }) {
  const { state } = useStore();
  const [t, setT] = useState<Transaction>(initial);
  const set = <K extends keyof Transaction>(k: K, v: Transaction[K]) => setT(p => ({ ...p, [k]: v }));
  
  return (
    <form onSubmit={(e) => { 
      e.preventDefault(); 
      if (!t.accountId) return toast.error("Select an account"); 
      if (t.kind === "transfer" && !t.toAccountId) return toast.error("Select destination account");
      if (t.kind === "transfer" && t.accountId === t.toAccountId) return toast.error("Source and destination accounts must differ");
      if (!t.amount) return toast.error("Enter an amount"); 
      onSubmit(t); 
    }} className="space-y-4">
      <FormDialogHeader title={initial.merchant || initial.category ? "Edit transaction" : "New transaction"} />
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Type</Label>
          <Select value={t.kind} onValueChange={(v) => set("kind", v as TxnKind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {KINDS.map(k => <SelectItem key={k.v} value={k.v}>{k.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Amount (₹)</Label><Input type="number" step="0.01" value={t.amount || ""} onChange={(e) => set("amount", parseFloat(e.target.value) || 0)} /></div>
        <div><Label>Date</Label><Input type="date" value={t.date} onChange={(e) => set("date", e.target.value)} /></div>
        <div><Label>Category</Label>
          <Select value={t.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className={t.kind === "transfer" ? "col-span-1" : "col-span-2"}><Label>Source Account</Label>
          <Select value={t.accountId} onValueChange={(v) => set("accountId", v)}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{state.accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {t.kind === "transfer" && (
          <div className="col-span-1"><Label>Destination Account</Label>
            <Select value={t.toAccountId || ""} onValueChange={(v) => set("toAccountId", v)}>
              <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
              <SelectContent>
                {state.accounts.filter(a => a.id !== t.accountId).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="col-span-2"><Label>Merchant</Label><Input value={t.merchant || ""} onChange={(e) => set("merchant", e.target.value)} placeholder="e.g. Zomato" /></div>
        <div className="col-span-2"><Label>Note</Label><Textarea value={t.note || ""} onChange={(e) => set("note", e.target.value)} rows={2} /></div>
      </div>
      <FormFooter onCancel={onCancel} />
    </form>
  );
}

function TxnPage() {
  const { state, dispatch } = useStore();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<string>("all");
  const [cat, setCat] = useState<string>("all");

  const filtered = useMemo(() => {
    return SelectorEngine.searchTransactions(state, q, { kind, category: cat === "all" ? undefined : cat });
  }, [state, q, kind, cat]);

  const [openAdd, setOpenAdd] = useState(false);
  const accountName = (id: string) => state.accounts.find(a => a.id === id)?.name || "—";

  const totals = useMemo(() => {
    const income = filtered
      .filter((t: any) => ["income", "investment_sale", "refund", "interest", "dividend"].includes(t.kind))
      .reduce((s: number, t: any) => s + t.amount, 0);
    const expense = filtered
      .filter((t: any) => ["expense", "bill_payment", "loan_payment", "goal_contribution"].includes(t.kind))
      .reduce((s: number, t: any) => s + t.amount, 0);
    return { income, expense, net: income - expense };
  }, [filtered]);

  return (
    <div>
      <PageHeader title="Transactions" subtitle="Every rupee in and out. Search, filter, edit, and reconcile."
        action={<AddButton label="Add transaction" open={openAdd} onOpenChange={setOpenAdd}>
          <TxnForm initial={empty()} onCancel={() => setOpenAdd(false)} onSubmit={(t) => { dispatch({ type: "txn:add", payload: t }); setOpenAdd(false); toast.success("Transaction added"); }} />
        </AddButton>}
      />
      <div className="grid gap-4 p-6 md:grid-cols-3 md:p-10">
        <Card className="card-luxe p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">Income</div><div className="mt-2 font-numeric text-2xl font-semibold text-success">{formatINR(totals.income, { compact: true })}</div></Card>
        <Card className="card-luxe p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">Expense</div><div className="mt-2 font-numeric text-2xl font-semibold text-destructive">{formatINR(totals.expense, { compact: true })}</div></Card>
        <Card className="card-luxe p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">Net</div><div className={`mt-2 font-numeric text-2xl font-semibold ${totals.net >= 0 ? "text-foreground" : "text-destructive"}`}>{formatINR(totals.net, { compact: true, sign: true })}</div></Card>
      </div>

      <Card className="card-luxe mx-6 mb-10 md:mx-10">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/60 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search merchant or category" className="pl-9" />
          </div>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {KINDS.map(k => <SelectItem key={k.v} value={k.v}>{k.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.transactions.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No transactions recorded</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No transactions match your filters.</TableCell></TableRow>
              ) : null}
              {filtered.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(t.date)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full ${t.kind === "income" ? "bg-success/10 text-success" : t.kind === "transfer" ? "bg-muted text-foreground" : "bg-muted text-foreground"}`}>
                        {t.kind === "income" ? <ArrowDownRight className="h-3.5 w-3.5" /> : t.kind === "transfer" ? <ArrowLeftRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                      </span>
                      <span className="font-medium">{t.merchant || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="font-normal">{t.category}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.kind === "transfer" ? (
                      <span>
                        {accountName(t.accountId)} → {accountName(t.toAccountId || "")}
                      </span>
                    ) : (
                      accountName(t.accountId)
                    )}
                  </TableCell>
                  <TableCell className={`text-right font-numeric font-semibold ${t.kind === "income" ? "text-success" : "text-foreground"}`}>
                    {t.kind === "income" ? "+" : "−"}{formatINR(t.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <EditIconButton>{(close) =>
                        <TxnForm initial={t} onCancel={close} onSubmit={(u) => { dispatch({ type: "txn:update", payload: u }); close(); toast.success("Updated"); }} />
                      }</EditIconButton>
                      <DeleteIconButton itemLabel="transaction" onConfirm={() => { dispatch({ type: "txn:remove", payload: t.id }); toast.success("Deleted"); }} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

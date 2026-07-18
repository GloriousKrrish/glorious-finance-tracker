import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore, uid, CATEGORIES, type Transaction, type TxnKind } from "@/lib/store";
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

const empty = (): Transaction => ({
  id: uid(), date: todayISO(), amount: 0, kind: "expense", category: "Food", accountId: "", merchant: "", note: "",
});

function TxnForm({ initial, onSubmit, onCancel }: { initial: Transaction; onSubmit: (t: Transaction) => void; onCancel: () => void }) {
  const { state } = useStore();
  const [t, setT] = useState<Transaction>(initial);
  const set = <K extends keyof Transaction>(k: K, v: Transaction[K]) => setT(p => ({ ...p, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!t.accountId) return toast.error("Select an account"); if (!t.amount) return toast.error("Enter an amount"); onSubmit(t); }} className="space-y-4">
      <FormDialogHeader title={initial.merchant || initial.category ? "Edit transaction" : "New transaction"} />
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Type</Label>
          <Select value={t.kind} onValueChange={(v) => set("kind", v as TxnKind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
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
        <div className="col-span-2"><Label>Account</Label>
          <Select value={t.accountId} onValueChange={(v) => set("accountId", v)}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{state.accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
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

  const filtered = useMemo(() => state.transactions.filter(t =>
    (kind === "all" || t.kind === kind) &&
    (cat === "all" || t.category === cat) &&
    (!q || (t.merchant || "").toLowerCase().includes(q.toLowerCase()) || t.category.toLowerCase().includes(q.toLowerCase()))
  ), [state.transactions, q, kind, cat]);

  const [openAdd, setOpenAdd] = useState(false);
  const accountName = (id: string) => state.accounts.find(a => a.id === id)?.name || "—";

  const totals = useMemo(() => {
    const income = filtered.filter(t => t.kind === "income").reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter(t => t.kind === "expense").reduce((s, t) => s + t.amount, 0);
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
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
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
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No transactions match your filters.</TableCell></TableRow>}
              {filtered.map(t => (
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
                  <TableCell className="text-sm text-muted-foreground">{accountName(t.accountId)}</TableCell>
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

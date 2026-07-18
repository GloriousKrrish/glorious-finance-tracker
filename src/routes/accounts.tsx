import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, uid, type Account } from "@/lib/store";
import { formatINR } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { AddButton, EditIconButton, DeleteIconButton, FormDialogHeader, FormFooter } from "@/components/crud";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Wallet, Landmark, CreditCard, Coins, LineChart } from "lucide-react";

export const Route = createFileRoute("/accounts")({
  head: () => ({ meta: [{ title: "Accounts · GloriousFinance" }] }),
  component: AccountsPage,
});

const TYPES: { v: Account["type"]; label: string; icon: any }[] = [
  { v: "bank", label: "Bank Account", icon: Landmark },
  { v: "cash", label: "Cash Wallet", icon: Wallet },
  { v: "credit_card", label: "Credit Card", icon: CreditCard },
  { v: "wallet", label: "Digital Wallet", icon: Coins },
  { v: "investment", label: "Investment Account", icon: LineChart },
];

const empty = (): Account => ({ id: uid(), name: "", type: "bank", balance: 0, institution: "" });

function AccountForm({ initial, onSubmit, onCancel }: { initial: Account; onSubmit: (a: Account) => void; onCancel: () => void }) {
  const [a, setA] = useState<Account>(initial);
  const set = <K extends keyof Account>(k: K, v: Account[K]) => setA(p => ({ ...p, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!a.name) return toast.error("Name required"); onSubmit(a); }} className="space-y-4">
      <FormDialogHeader title={initial.name ? "Edit account" : "New account"} />
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Name</Label><Input value={a.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. HDFC Savings" /></div>
        <div><Label>Type</Label>
          <Select value={a.type} onValueChange={(v) => set("type", v as Account["type"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Balance (₹)</Label><Input type="number" step="0.01" value={a.balance || ""} onChange={(e) => set("balance", parseFloat(e.target.value) || 0)} /></div>
        <div className="col-span-2"><Label>Institution</Label><Input value={a.institution || ""} onChange={(e) => set("institution", e.target.value)} placeholder="e.g. HDFC Bank" /></div>
      </div>
      <FormFooter onCancel={onCancel} />
    </form>
  );
}

function AccountsPage() {
  const { state, dispatch } = useStore();
  const [openAdd, setOpenAdd] = useState(false);
  const total = state.accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div>
      <PageHeader title="Accounts" subtitle="All balances across banks, cards, cash and investment accounts."
        action={<AddButton label="Add account" open={openAdd} onOpenChange={setOpenAdd}>
          <AccountForm initial={empty()} onCancel={() => setOpenAdd(false)} onSubmit={(a) => { dispatch({ type: "account:add", payload: a }); setOpenAdd(false); toast.success("Account added"); }} />
        </AddButton>}
      />
      <div className="p-6 md:p-10">
        <Card className="card-luxe mb-6 flex items-center justify-between p-6 ring-1 ring-gold/30">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Total Position</div>
            <div className="mt-2 font-numeric text-3xl font-semibold text-gold">{formatINR(total, { compact: true })}</div>
          </div>
          <div className="text-right text-sm text-muted-foreground">Across {state.accounts.length} accounts</div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {state.accounts.map(a => {
            const T = TYPES.find(t => t.v === a.type)!;
            return (
              <Card key={a.id} className="card-luxe p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary"><T.icon className="h-5 w-5" /></div>
                    <div>
                      <div className="font-semibold">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{T.label}{a.institution ? ` · ${a.institution}` : ""}</div>
                    </div>
                  </div>
                  <div className="flex">
                    <EditIconButton>{(close) => <AccountForm initial={a} onCancel={close} onSubmit={(u) => { dispatch({ type: "account:update", payload: u }); close(); toast.success("Updated"); }} />}</EditIconButton>
                    <DeleteIconButton itemLabel="account" onConfirm={() => { dispatch({ type: "account:remove", payload: a.id }); toast.success("Deleted"); }} />
                  </div>
                </div>
                <div className={`mt-4 font-numeric text-2xl font-semibold ${a.balance < 0 ? "text-destructive" : "text-foreground"}`}>{formatINR(a.balance)}</div>
              </Card>
            );
          })}
          {state.accounts.length === 0 && <Card className="card-luxe col-span-full p-12 text-center text-sm text-muted-foreground">No accounts yet. Add your first account to get started.</Card>}
        </div>
      </div>
    </div>
  );
}

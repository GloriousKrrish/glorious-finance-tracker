import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore, uid, type Loan, type Transaction } from "@/lib/store";
import { formatINR, todayISO, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { AddButton, EditIconButton, DeleteIconButton, FormDialogHeader, FormFooter } from "@/components/crud";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { SelectorEngine } from "@/lib/financial-engine";
import { toast } from "sonner";
import { Landmark, Calendar, Percent, ShieldCheck, ArrowRightLeft, Sparkles, Receipt, Trash2, PlusCircle, CheckCircle, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/loans")({
  head: () => ({ meta: [{ title: "Loans & Liability OS · GloriousFinance" }] }),
  component: LoansPage,
});

const TYPES: { v: Loan["type"]; label: string }[] = [
  { v: "home", label: "Home Loan" },
  { v: "car", label: "Car Loan" },
  { v: "personal", label: "Personal Loan" },
  { v: "education", label: "Education Loan" },
  { v: "gold", label: "Gold Loan" },
  { v: "business", label: "Business Loan" },
];

const empty = (): Loan => ({
  id: uid(),
  name: "",
  type: "personal",
  principal: 0,
  outstanding: 0,
  rate: 0,
  emi: 0,
  tenureMonths: 12,
  startDate: todayISO(),
  accountId: undefined,
});

function LoanForm({ initial, onSubmit, onCancel }: { initial: Loan; onSubmit: (l: Loan) => void; onCancel: () => void }) {
  const { state } = useStore();
  const [l, setL] = useState<Loan>({ ...initial });
  const set = <K extends keyof Loan>(k: K, v: Loan[K]) => setL(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!l.name.trim()) return toast.error("Name required");
      if (l.principal <= 0) return toast.error("Principal must be greater than zero");
      onSubmit(l);
    }} className="space-y-4">
      <FormDialogHeader title={initial.name ? "Edit Loan Parameters" : "Create New Loan Target"} />
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Loan Name</Label>
          <Input value={l.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. HDFC Home Loan" className="bg-muted/40 border-border/80" />
        </div>
        <div>
          <Label>Loan Type</Label>
          <Select value={l.type} onValueChange={(v) => set("type", v as Loan["type"])}>
            <SelectTrigger className="bg-muted/40 border-border/80"><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Interest Rate (% p.a.)</Label>
          <Input type="number" step="0.01" value={l.rate || ""} onChange={(e) => set("rate", parseFloat(e.target.value) || 0)} className="bg-muted/40 border-border/80" />
        </div>
        <div>
          <Label>Principal (₹)</Label>
          <Input type="number" step="0.01" value={l.principal || ""} onChange={(e) => set("principal", parseFloat(e.target.value) || 0)} className="bg-muted/40 border-border/80" />
        </div>
        <div>
          <Label>Tenure (Months)</Label>
          <Input type="number" value={l.tenureMonths || ""} onChange={(e) => set("tenureMonths", parseInt(e.target.value) || 0)} className="bg-muted/40 border-border/80" />
        </div>
        <div>
          <Label>Monthly EMI (₹, Optional)</Label>
          <Input type="number" step="0.01" value={l.emi || ""} onChange={(e) => set("emi", parseFloat(e.target.value) || 0)} placeholder="Auto-calculated if 0" className="bg-muted/40 border-border/80" />
        </div>
        <div className="col-span-2">
          <Label>Linked Account (For Quick Repayments)</Label>
          <Select value={l.accountId || "none"} onValueChange={(v) => set("accountId", v === "none" ? undefined : v)}>
            <SelectTrigger className="bg-muted/40 border-border/80"><SelectValue placeholder="Select Account" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (Select manually later)</SelectItem>
              {state.accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} (₹{a.balance.toLocaleString()})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Start Date</Label>
          <Input type="date" value={l.startDate} onChange={(e) => set("startDate", e.target.value)} className="bg-muted/40 border-border/80" />
        </div>
      </div>
      <FormFooter onCancel={onCancel} />
    </form>
  );
}

function RepayModal({ loan, open, onClose }: { loan: Loan & { metrics: any }; open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [accountId, setAccountId] = useState(loan.accountId || (state.accounts[0]?.id || ""));
  const [amount, setAmount] = useState(loan.metrics.monthlyEmi);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState(`Repayment for ${loan.name}`);

  const handleRepay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) return toast.error("Please select a funding account");
    if (amount <= 0) return toast.error("Amount must be positive");

    dispatch({
      type: "txn:add",
      payload: {
        id: uid(),
        date,
        amount,
        kind: "loan_payment",
        category: "EMI",
        accountId,
        merchant: `${loan.name} EMI`,
        note,
        linkedEntityId: loan.id,
        linkedEntityType: "loan",
      }
    });
    
    toast.success("Repayment transaction generated successfully");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[425px] bg-card border border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-semibold flex items-center gap-2 text-foreground">
            <PlusCircle className="h-5 w-5 text-primary" />
            Record Loan Repayment
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Creates a matching payment transaction in the ledger.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleRepay} className="space-y-4 mt-2">
          <div>
            <Label>Funding Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="bg-muted/40 border border-border/80"><SelectValue /></SelectTrigger>
              <SelectContent>
                {state.accounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name} (₹{a.balance.toLocaleString()})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Repayment Amount (₹)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} className="bg-muted/40 border border-border/80" />
            <div className="text-[10px] text-muted-foreground mt-1 flex justify-between">
              <span>Standard EMI: ₹{loan.metrics.monthlyEmi.toLocaleString()}</span>
              <span>Outstanding: ₹{loan.metrics.outstandingBalance.toLocaleString()}</span>
            </div>
          </div>
          <div>
            <Label>Repayment Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-muted/40 border border-border/80" />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="bg-muted/40 border border-border/80" />
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose} className="border border-border hover:bg-muted/40">Cancel</Button>
            <Button type="submit">Post Repayment</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LoansPage() {
  const { state, dispatch } = useStore();
  const [openAdd, setOpenAdd] = useState(false);
  const [repayLoan, setRepayLoan] = useState<(Loan & { metrics: any }) | null>(null);

  // Derived OS-level Loan metrics via SelectorEngine
  const allLoans = SelectorEngine.getLoans(state);
  const activeLoans = SelectorEngine.getActiveLoans(state);
  const closedLoans = SelectorEngine.getClosedLoans(state);

  const totalOutstanding = SelectorEngine.getLoansOutstandingSummary(state);
  const totalEmi = SelectorEngine.getLoansEmiSummary(state);
  const debtRatio = SelectorEngine.getDebtRatio(state);
  const interestSummary = SelectorEngine.getLoanInterestSummary(state);

  // Fetch all loan repayment transactions
  const allRepayments = useMemo(() => {
    return state.transactions
      .filter(t => t.linkedEntityType === "loan" && t.kind === "loan_payment")
      .map(t => {
        const loan = state.loans.find(l => l.id === t.linkedEntityId);
        return {
          ...t,
          loanName: loan ? loan.name : "Orphaned Loan",
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.transactions, state.loans]);

  return (
    <div>
      <PageHeader
        title="Loans & Liabilities"
        subtitle="Manage obligations, compute interest amortizations, and verify dynamic outstanding balances."
        action={
          <AddButton label="Add Loan" open={openAdd} onOpenChange={setOpenAdd}>
            <LoanForm initial={empty()} onCancel={() => setOpenAdd(false)} onSubmit={(l) => { dispatch({ type: "loan:add", payload: l }); setOpenAdd(false); toast.success("Loan successfully created"); }} />
          </AddButton>
        }
      />

      {/* KPI Section */}
      <div className="grid gap-4 p-6 md:grid-cols-4 md:p-10">
        <Card className="card-luxe p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-widest font-semibold">Total Outstanding</span>
            <Landmark className="h-4 w-4" />
          </div>
          <div className="mt-2 font-numeric text-2xl font-semibold text-foreground">{formatINR(totalOutstanding)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{activeLoans.length} active loan obligations</div>
        </Card>
        <Card className="card-luxe p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-widest font-semibold">Monthly EMI Obligation</span>
            <Calendar className="h-4 w-4" />
          </div>
          <div className="mt-2 font-numeric text-2xl font-semibold text-foreground">{formatINR(totalEmi)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Due on 5th of each month</div>
        </Card>
        <Card className="card-luxe p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-widest font-semibold">Debt-to-Asset Ratio</span>
            <Percent className="h-4 w-4" />
          </div>
          <div className="mt-2 font-numeric text-2xl font-semibold text-foreground">{debtRatio.toFixed(1)}%</div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {debtRatio > 50 ? "High leverage risk alert" : "Within optimal leverage limits"}
          </div>
        </Card>
        <Card className="card-luxe p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs uppercase tracking-widest font-semibold">Interest Obligation</span>
            <Sparkles className="h-4 w-4 text-gold" />
          </div>
          <div className="mt-2 font-numeric text-2xl font-semibold text-foreground">
            {formatINR(interestSummary.paid)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            ₹{interestSummary.remaining.toLocaleString()} remaining interest
          </div>
        </Card>
      </div>

      <div className="px-6 pb-10 md:px-10">
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="bg-muted/30 border border-border/40 p-1 mb-6 rounded-lg">
            <TabsTrigger value="active" className="rounded-md px-4 py-1.5 text-xs">Active Debts ({activeLoans.length})</TabsTrigger>
            <TabsTrigger value="closed" className="rounded-md px-4 py-1.5 text-xs">Settled Debts ({closedLoans.length})</TabsTrigger>
            <TabsTrigger value="history" className="rounded-md px-4 py-1.5 text-xs">Repayment Ledger ({allRepayments.length})</TabsTrigger>
          </TabsList>

          {/* Active Loans */}
          <TabsContent value="active" className="grid gap-6 md:grid-cols-2">
            {activeLoans.map(l => {
              const paid = l.principal - l.outstanding;
              const p = l.metrics.progressPercent;
              const health = l.metrics.loanHealth;

              return (
                <Card key={l.id} className="card-luxe p-6 relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            {TYPES.find(t => t.v === l.type)?.label}
                          </span>
                          <Badge variant="outline" className={`text-[9px] uppercase px-1.5 py-0.5 rounded-full ${
                            health === "Excellent" ? "border-success/30 text-success bg-success/5" :
                            health === "Overdue" ? "border-destructive/30 text-destructive bg-destructive/5 animate-pulse" :
                            "border-warning/30 text-warning bg-warning/5"
                          }`}>
                            {health}
                          </Badge>
                        </div>
                        <div className="mt-1 font-display text-lg font-semibold text-foreground">{l.name}</div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <EditIconButton>{(close) => <LoanForm initial={l} onCancel={close} onSubmit={(u) => { dispatch({ type: "loan:update", payload: u }); close(); toast.success("Loan parameters synchronized"); }} />}</EditIconButton>
                        <DeleteIconButton itemLabel="loan" onConfirm={() => { dispatch({ type: "loan:remove", payload: l.id }); toast.success("Loan and repayment linkage removed"); }} />
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-4 text-xs border-y border-border/40 py-4">
                      <div>
                        <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Outstanding</div>
                        <div className="mt-1 font-numeric text-base font-semibold text-foreground">{formatINR(l.outstanding)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[10px] uppercase tracking-wider">EMI</div>
                        <div className="mt-1 font-numeric text-base font-semibold text-foreground">{formatINR(l.emi)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Rate</div>
                        <div className="mt-1 font-numeric text-base font-semibold text-foreground">{l.rate}%</div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Principal Paid:</span>
                        <span className="font-medium text-foreground">{formatINR(l.metrics.principalPaid, { compact: true })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Interest Paid:</span>
                        <span className="font-medium text-foreground">{formatINR(l.metrics.interestPaid, { compact: true })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Remaining Tenure:</span>
                        <span className="font-medium text-foreground">{l.metrics.remainingTenure} / {l.tenureMonths} Months</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Next Due Date:</span>
                        <span className="font-medium text-foreground">{formatDate(l.metrics.nextDueDate)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>{p.toFixed(1)}% repaid</span>
                      <span>Total Paid: {formatINR(paid, { compact: true })} / {formatINR(l.principal, { compact: true })}</span>
                    </div>
                    <Progress value={p} className="h-1.5 bg-muted/65" />
                    <Button onClick={() => setRepayLoan(l)} className="mt-4 w-full text-xs font-semibold" size="sm">
                      Record Repayment
                    </Button>
                  </div>
                </Card>
              );
            })}
            {activeLoans.length === 0 && (
              <Card className="card-luxe col-span-full p-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <CheckCircle className="h-8 w-8 text-success/70" />
                No active loans. You are debt-free!
              </Card>
            )}
          </TabsContent>

          {/* Closed Loans */}
          <TabsContent value="closed" className="grid gap-6 md:grid-cols-2">
            {closedLoans.map(l => (
              <Card key={l.id} className="card-luxe p-6 border-success/20 bg-success/5 relative overflow-hidden flex flex-col justify-between opacity-80">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {TYPES.find(t => t.v === l.type)?.label}
                        </span>
                        <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0.5 rounded-full border-success/30 text-success bg-success/10">
                          Closed
                        </Badge>
                      </div>
                      <div className="mt-1 font-display text-lg font-semibold text-foreground line-through decoration-muted-foreground/45">{l.name}</div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <DeleteIconButton itemLabel="loan" onConfirm={() => { dispatch({ type: "loan:remove", payload: l.id }); toast.success("Settled loan target removed"); }} />
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4 text-xs border-t border-border/40 pt-4">
                    <div>
                      <div className="text-muted-foreground text-[10px] uppercase">Principal Closed</div>
                      <div className="mt-1 font-numeric text-base font-semibold text-foreground">{formatINR(l.principal)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[10px] uppercase">Interest Paid</div>
                      <div className="mt-1 font-numeric text-base font-semibold text-foreground">{formatINR(l.metrics.interestPaid)}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center gap-2 text-xs text-success font-medium">
                    <CheckCircle className="h-4 w-4" />
                    Loan closed and fully amortized.
                  </div>
                </div>
              </Card>
            ))}
            {closedLoans.length === 0 && (
              <Card className="card-luxe col-span-full p-12 text-center text-sm text-muted-foreground">
                No historical closed loans found.
              </Card>
            )}
          </TabsContent>

          {/* Repayment History Ledger */}
          <TabsContent value="history">
            <Card className="card-luxe overflow-hidden border border-border/60">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 uppercase tracking-widest text-muted-foreground border-b border-border/50">
                    <tr>
                      <th className="p-4 font-semibold">Date</th>
                      <th className="p-4 font-semibold">Loan Reference</th>
                      <th className="p-4 font-semibold">Funding Account</th>
                      <th className="p-4 font-semibold">Note / Memo</th>
                      <th className="p-4 font-semibold text-right">Amount Paid</th>
                      <th className="p-4 font-semibold text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/55">
                    {allRepayments.map(t => {
                      const acc = state.accounts.find(a => a.id === t.accountId);
                      return (
                        <tr key={t.id} className="hover:bg-muted/15 transition-colors">
                          <td className="p-4 font-numeric text-muted-foreground">{formatDate(t.date)}</td>
                          <td className="p-4 font-medium text-foreground">{t.loanName}</td>
                          <td className="p-4 text-muted-foreground">{acc ? acc.name : "Unknown Account"}</td>
                          <td className="p-4 text-muted-foreground max-w-[200px] truncate">{t.note}</td>
                          <td className="p-4 font-numeric font-semibold text-right text-foreground">{formatINR(t.amount)}</td>
                          <td className="p-4 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                dispatch({ type: "txn:remove", payload: t.id });
                                toast.success("Repayment ledger transaction reversed");
                              }}
                              className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-full"
                              title="Delete repayment (reverses balance & outstanding changes)"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {allRepayments.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-sm text-muted-foreground">
                          No repayment transactions logged in the ledger yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Record Repayment Dialog wrapper */}
      {repayLoan && (
        <RepayModal
          loan={repayLoan}
          open={!!repayLoan}
          onClose={() => setRepayLoan(null)}
        />
      )}
    </div>
  );
}

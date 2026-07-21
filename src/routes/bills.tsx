import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore, uid, CATEGORIES, type Bill, type Account, type Loan, type Budget } from "@/lib/store";
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
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Play, 
  RefreshCw, 
  XCircle, 
  CreditCard, 
  ShieldAlert, 
  Award, 
  Calendar, 
  Activity, 
  Filter, 
  Search, 
  FileText,
  BadgeAlert,
  HelpCircle
} from "lucide-react";
import { SelectorEngine } from "@/lib/financial-engine/selectors";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export const Route = createFileRoute("/bills")({
  head: () => ({ meta: [{ title: "Financial Obligations · GloriousFinance" }] }),
  component: BillsPage,
});

const empty = (): Bill => ({ 
  id: uid(), 
  name: "", 
  amount: 0, 
  dueDate: todayISO(), 
  category: "Utilities", 
  paymentFrequency: "monthly",
  status: "unpaid",
  autoPayEnabled: false,
});

function BillForm({ initial, onSubmit, onCancel, accounts, loans, budgets }: { 
  initial: Bill; 
  onSubmit: (b: Bill) => void; 
  onCancel: () => void;
  accounts: Account[];
  loans: Loan[];
  budgets: Budget[];
}) {
  const [b, setB] = useState<Bill>(() => ({
    ...initial,
    paymentFrequency: initial.paymentFrequency || (initial.recurring === "none" ? "one-time" : (initial.recurring as any) || "monthly"),
    status: initial.status || (initial.paid ? "paid" : "unpaid"),
    autoPayEnabled: initial.autoPayEnabled ?? false,
    currency: initial.currency || "INR",
  }));

  const set = <K extends keyof Bill>(k: K, v: Bill[K]) => setB(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={(e) => { 
      e.preventDefault(); 
      if (!b.name) return toast.error("Name required"); 
      if (b.amount <= 0) return toast.error("Amount must be positive");
      
      // Preserve backwards compatibility fields
      const submitted: Bill = {
        ...b,
        paid: b.status === "paid",
        recurring: b.paymentFrequency === "one-time" ? "none" : 
                   b.paymentFrequency === "weekly" ? "weekly" :
                   b.paymentFrequency === "yearly" ? "yearly" : "monthly"
      };
      
      onSubmit(submitted); 
    }} className="space-y-4 max-h-[85vh] overflow-y-auto px-1">
      <FormDialogHeader title={initial.name ? "Edit obligation" : "New obligation"} />
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Name</Label>
          <Input value={b.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Netflix, Rent, Car Loan EMI" className="border-gold/20 focus:border-gold" />
        </div>
        <div>
          <Label>Amount (₹)</Label>
          <Input type="number" step="0.01" value={b.amount || ""} onChange={(e) => set("amount", parseFloat(e.target.value) || 0)} className="border-gold/20 focus:border-gold" />
        </div>
        <div>
          <Label>Due date</Label>
          <Input type="date" value={b.dueDate} onChange={(e) => set("dueDate", e.target.value)} className="border-gold/20 focus:border-gold" />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={b.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger className="border-gold/20 focus:ring-gold"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              <SelectItem value="Streaming Subscription">Streaming Subscription</SelectItem>
              <SelectItem value="Membership">Membership</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Frequency</Label>
          <Select value={b.paymentFrequency} onValueChange={(v) => set("paymentFrequency", v as any)}>
            <SelectTrigger className="border-gold/20 focus:ring-gold"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="one-time">One-time</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="biweekly">Bi-weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="half-yearly">Half-yearly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
              <SelectItem value="custom">Custom (RRule)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Linked Account</Label>
          <Select value={b.linkedAccountId || "none"} onValueChange={(v) => set("linkedAccountId", v === "none" ? undefined : v)}>
            <SelectTrigger className="border-gold/20 focus:ring-gold">
              <SelectValue placeholder="Select account (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No account linked</SelectItem>
              {accounts.map(acc => (
                <SelectItem key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2 mt-6">
          <input 
            type="checkbox" 
            id="autoPayEnabled" 
            checked={b.autoPayEnabled} 
            onChange={(e) => set("autoPayEnabled", e.target.checked)}
            className="rounded border-gold/30 text-gold focus:ring-gold h-4 w-4 bg-background"
          />
          <Label htmlFor="autoPayEnabled" className="cursor-pointer font-medium">Enable Auto-Pay</Label>
        </div>
        <div>
          <Label>Grace Period (Days)</Label>
          <Input type="number" value={b.gracePeriod || ""} onChange={(e) => set("gracePeriod", parseInt(e.target.value) || undefined)} placeholder="0" className="border-gold/20 focus:border-gold" />
        </div>
        <div>
          <Label>Reminder Days Before</Label>
          <Input type="number" value={b.reminderDays || ""} onChange={(e) => set("reminderDays", parseInt(e.target.value) || undefined)} placeholder="3" className="border-gold/20 focus:border-gold" />
        </div>
        <div>
          <Label>Linked Loan</Label>
          <Select value={b.linkedLoanId || "none"} onValueChange={(v) => set("linkedLoanId", v === "none" ? undefined : v)}>
            <SelectTrigger className="border-gold/20 focus:ring-gold">
              <SelectValue placeholder="Select loan (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No loan linked</SelectItem>
              {loans.map(loan => (
                <SelectItem key={loan.id} value={loan.id}>{loan.name} (EMI: ₹{loan.emi.toLocaleString()})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Linked Budget</Label>
          <Select value={b.linkedBudgetId || "none"} onValueChange={(v) => set("linkedBudgetId", v === "none" ? undefined : v)}>
            <SelectTrigger className="border-gold/20 focus:ring-gold">
              <SelectValue placeholder="Select budget (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No budget linked</SelectItem>
              {budgets.map(bg => (
                <SelectItem key={bg.id} value={bg.id}>{bg.category} ({bg.period} limit: ₹{bg.limit.toLocaleString()})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Notes</Label>
          <textarea
            value={b.notes || ""}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Add notes, tags, or subscription details"
            className="flex min-h-[60px] w-full rounded-md border border-gold/20 bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>
      <FormFooter onCancel={onCancel} />
    </form>
  );
}

function PaymentDialog({ bill, accounts, onSubmit, onCancel }: {
  bill: Bill;
  accounts: Account[];
  onSubmit: (accountId: string, date: string) => void;
  onCancel: () => void;
}) {
  const defaultAcc = bill.linkedAccountId || accounts.find(a => a.type === "bank")?.id || accounts[0]?.id || "";
  const [selectedAcc, setSelectedAcc] = useState(defaultAcc);
  const [date, setDate] = useState(todayISO());

  return (
    <div className="space-y-5 p-5">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Record Payment: {bill.name}</h3>
        <p className="text-sm text-muted-foreground mt-1">Select payment account and date to settle this obligation.</p>
      </div>

      <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex items-center justify-between">
        <span className="text-sm text-muted-foreground font-medium">Obligation Amount</span>
        <span className="text-xl font-bold text-primary font-numeric">{formatINR(bill.amount)}</span>
      </div>
      
      <div className="space-y-4">
        <div>
          <Label className="text-muted-foreground">Pay From Account</Label>
          <Select value={selectedAcc} onValueChange={setSelectedAcc}>
            <SelectTrigger className="border-gold/20 mt-1">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map(acc => (
                <SelectItem key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-muted-foreground">Payment Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-gold/20 mt-1" />
        </div>
      </div>
      
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => {
          if (!selectedAcc) return toast.error("Please select a payment account");
          onSubmit(selectedAcc, date);
        }}>Confirm Settle</Button>
      </div>
    </div>
  );
}

function BillsPage() {
  const { state, dispatch } = useStore();
  const [openAdd, setOpenAdd] = useState(false);
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [filterType, setFilterType] = useState<"all" | "upcoming" | "overdue" | "subscriptions" | "autopay">("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"dueDate" | "amount" | "name">("dueDate");

  // Fetch memoized details & summaries from SelectorEngine
  const obligationSummary = useMemo(() => SelectorEngine.getFinancialObligationSummary(state), [state]);
  const subscriptionSummary = useMemo(() => SelectorEngine.getSubscriptionSummary(state), [state]);
  const detailedBills = useMemo(() => SelectorEngine.getBillsDetailed(state), [state]);

  const bankBalance = useMemo(() => {
    return state.accounts
      .filter(a => a.type === "bank" || a.type === "wallet" || a.type === "cash")
      .reduce((sum, a) => sum + a.balance, 0);
  }, [state.accounts]);

  // Combined lists
  const allObligations = useMemo(() => {
    return SelectorEngine.getAllBills(state);
  }, [state]);

  const filteredObligations = useMemo(() => {
    let list = [...allObligations];

    // Filter
    if (filterType === "upcoming") {
      list = list.filter(b => b.status === "unpaid" || b.status === "overdue" || !b.paid);
    } else if (filterType === "overdue") {
      list = list.filter(b => b.status === "overdue" || b.status === "missed");
    } else if (filterType === "subscriptions") {
      list = list.filter(b => 
        b.category === "Streaming Subscription" || 
        b.category === "Membership" || 
        b.metadata?.isSubscription
      );
    } else if (filterType === "autopay") {
      list = list.filter(b => b.autoPayEnabled);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b => 
        b.name.toLowerCase().includes(q) || 
        b.category.toLowerCase().includes(q) ||
        (b.notes && b.notes.toLowerCase().includes(q))
      );
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === "dueDate") return a.dueDate.localeCompare(b.dueDate);
      if (sortBy === "amount") return b.amount - a.amount;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [allObligations, filterType, search, sortBy]);

  const handlePayConfirm = (accountId: string, date: string) => {
    if (!payingBill) return;
    dispatch({
      type: "bill:pay",
      payload: {
        billId: payingBill.id,
        accountId,
        date
      }
    });
    setPayingBill(null);
    toast.success("Obligation paid successfully");
  };

  const handleUnpay = (billId: string) => {
    // Revert status to unpaid
    const bill = state.bills.find(b => b.id === billId);
    if (bill) {
      dispatch({
        type: "bill:update",
        payload: {
          ...bill,
          status: "unpaid",
          paid: false
        }
      });
      // Revert the last payment transaction too if possible
      const lastTx = state.transactions.find(t => t.linkedEntityId === billId && t.linkedEntityType === "bill");
      if (lastTx) {
        dispatch({
          type: "txn:remove",
          payload: lastTx.id
        });
      }
      toast.success("Payment reverted and bill set to unpaid");
    }
  };

  // Obligation health status
  const healthStatus = useMemo(() => {
    const score = obligationSummary.obligationScore;
    if (score >= 90) return { label: "Excellent", color: "text-success bg-success/10 border-success/30", icon: Award };
    if (score >= 70) return { label: "Good", color: "text-primary bg-primary/10 border-primary/30", icon: ShieldAlert };
    if (score >= 50) return { label: "Warning", color: "text-warning bg-warning/10 border-warning/30", icon: AlertTriangle };
    return { label: "Critical", color: "text-destructive bg-destructive/10 border-destructive/30", icon: XCircle };
  }, [obligationSummary.obligationScore]);

  // Cash burn alert
  const cashBurnWarning = bankBalance < obligationSummary.upcomingTotal;

  return (
    <div className="pb-12">
      <PageHeader 
        title="Financial Obligations Engine" 
        subtitle="Event-driven tracking of recurring bills, active subscriptions, and loan repayments."
        action={
          <AddButton label="Add obligation" open={openAdd} onOpenChange={setOpenAdd}>
            <BillForm 
              initial={empty()} 
              accounts={state.accounts} 
              loans={state.loans}
              budgets={state.budgets}
              onCancel={() => setOpenAdd(false)} 
              onSubmit={(b) => { 
                dispatch({ type: "bill:add", payload: b }); 
                setOpenAdd(false); 
                toast.success("Obligation registered"); 
              }} 
            />
          </AddButton>
        }
      />

      {/* METRICS WIDGETS */}
      <div className="grid gap-6 px-6 md:px-10 lg:grid-cols-4 md:grid-cols-2 mt-6">
        {/* Obligation Health Score Gauge */}
        <Card className="card-luxe p-6 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Obligation Health</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${healthStatus.color}`}>
              {healthStatus.label}
            </span>
          </div>
          <div className="my-4 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold font-numeric text-primary">{obligationSummary.obligationScore}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span>Success Rate: {obligationSummary.paymentSuccessRate.toFixed(1)}%</span>
            {obligationSummary.latePayments > 0 && (
              <span className="text-warning ml-1">({obligationSummary.latePayments} late)</span>
            )}
          </div>
          <div className="absolute right-[-10px] bottom-[-10px] opacity-5 group-hover:opacity-10 transition-opacity">
            <healthStatus.icon size={110} />
          </div>
        </Card>

        {/* Subscription Burn Rate */}
        <Card className="card-luxe p-6 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Subscriptions Burn</span>
            <Badge variant="outline" className="border-gold/30 text-gold">{subscriptionSummary.totalCount} active</Badge>
          </div>
          <div className="my-4">
            <div className="text-2xl font-bold font-numeric">{formatINR(subscriptionSummary.monthlyCost)}/mo</div>
            <div className="text-xs text-muted-foreground mt-1">Annual: {formatINR(subscriptionSummary.annualCost)}</div>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5 text-gold" />
            <span>Unused: {subscriptionSummary.unusedCount} · Inactive: {subscriptionSummary.inactiveCount}</span>
          </div>
          <div className="absolute right-[-10px] bottom-[-10px] opacity-5 group-hover:opacity-10 transition-opacity">
            <RefreshCw size={110} />
          </div>
        </Card>

        {/* Cash Burn Warning Card */}
        <Card className={`card-luxe p-6 flex flex-col justify-between relative overflow-hidden group border ${cashBurnWarning ? "ring-1 ring-destructive/40" : ""}`}>
          <div className="flex justify-between items-start">
            <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Upcoming Cash Need</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${cashBurnWarning ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-success/10 text-success border border-success/20"}`}>
              {cashBurnWarning ? "Deficit Alert" : "Covered"}
            </span>
          </div>
          <div className="my-4">
            <div className="text-2xl font-bold font-numeric text-gold">{formatINR(obligationSummary.upcomingTotal || detailedBills.upcomingAmount)}</div>
            <div className="text-xs text-muted-foreground mt-1">Cash Reserve: {formatINR(bankBalance)}</div>
          </div>
          <div className="text-xs flex items-center gap-1">
            {cashBurnWarning ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-destructive animate-pulse" />
                <span className="text-destructive font-medium">Insufficient bank reserves</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                <span className="text-success">Reserves sufficient for obligations</span>
              </>
            )}
          </div>
        </Card>

        {/* Total Monthly Commitments */}
        <Card className="card-luxe p-6 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Total Monthly Load</span>
            <span className="text-xs text-muted-foreground font-medium">All recurring</span>
          </div>
          <div className="my-4">
            <div className="text-2xl font-bold font-numeric">{formatINR(obligationSummary.monthlyTotal || detailedBills.monthlyObligations)}</div>
            <div className="text-xs text-muted-foreground mt-1">Yearly equivalent: {formatINR(obligationSummary.yearlyTotal || detailedBills.yearlyObligations)}</div>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span>Paid this month: {obligationSummary.paidCount} / {allObligations.length}</span>
          </div>
        </Card>
      </div>

      {/* FILTER & CONTROL PANEL */}
      <div className="px-6 md:px-10 mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["all", "upcoming", "overdue", "subscriptions", "autopay"] as const).map((t) => (
            <Button
              key={t}
              variant={filterType === t ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType(t)}
              className="capitalize"
            >
              {t}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search obligations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 border-gold/20 focus:border-gold"
            />
          </div>

          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-40 border-gold/20">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dueDate">Due Date</SelectItem>
              <SelectItem value="amount">Amount</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* MAIN OBLIGATIONS GRID */}
      <div className="grid gap-6 px-6 pb-12 mt-6 md:px-10 lg:grid-cols-2">
        {filteredObligations.map(bill => {
          const isPaid = bill.status === "paid" || bill.paid;
          const isOverdue = bill.status === "overdue" || bill.status === "missed";
          const isRecurring = bill.paymentFrequency && bill.paymentFrequency !== "one-time";

          return (
            <Card key={bill.id} className={`card-luxe flex flex-col justify-between p-5 relative transition-all hover:translate-y-[-2px] border ${isOverdue ? "border-destructive/40 shadow-destructive/5" : "border-gold/10"}`}>
              <div className="flex items-start gap-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${isPaid ? "bg-success/10 text-success" : "bg-primary/5 text-primary"}`}>
                  {isPaid ? <CheckCircle2 className="h-5.5 w-5.5" /> : <Clock className="h-5.5 w-5.5" />}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-lg text-foreground">{bill.name}</span>
                    <Badge variant="secondary" className="font-normal text-xs">{bill.category}</Badge>
                    {isRecurring && (
                      <Badge variant="outline" className="border-gold/30 text-gold font-normal text-[10px] capitalize">
                        {bill.paymentFrequency}
                      </Badge>
                    )}
                    {bill.autoPayEnabled && (
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/15 font-semibold text-[10px] border border-primary/20">
                        AutoPay
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className={isOverdue ? "text-destructive font-medium" : ""}>
                      Due {formatDate(bill.dueDate)}
                    </span>
                    {isOverdue && (
                      <span className="text-destructive font-semibold flex items-center gap-0.5">
                        <BadgeAlert className="h-3 w-3" />
                        Overdue
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-numeric text-xl font-bold text-foreground">{formatINR(bill.amount)}</div>
                </div>
              </div>

              {/* Notes & metadata if present */}
              {bill.notes && (
                <div className="mt-3 bg-secondary/20 p-2.5 rounded-lg text-xs text-muted-foreground flex items-start gap-1.5">
                  <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{bill.notes}</span>
                </div>
              )}

              {/* Actions row */}
              <div className="flex items-center justify-between border-t border-gold/10 mt-4 pt-3">
                <div className="text-xs text-muted-foreground">
                  {bill.linkedAccountId ? (
                    <span className="flex items-center gap-1 text-[11px]">
                      <CreditCard className="h-3 w-3" />
                      Linked: {state.accounts.find(a => a.id === bill.linkedAccountId)?.name || "Unknown"}
                    </span>
                  ) : (
                    <span className="text-[10px]">No linked account</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!isPaid ? (
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={() => setPayingBill(bill)}
                      className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold"
                    >
                      Settle obligation
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleUnpay(bill.id)}
                      className="border-gold/20 text-muted-foreground hover:text-foreground font-medium"
                    >
                      Unpay
                    </Button>
                  )}

                  <EditIconButton>
                    {(close) => (
                      <BillForm 
                        initial={bill} 
                        accounts={state.accounts} 
                        loans={state.loans}
                        budgets={state.budgets}
                        onCancel={close} 
                        onSubmit={(u) => { 
                          dispatch({ type: "bill:update", payload: u }); 
                          close(); 
                          toast.success("Obligation updated"); 
                        }} 
                      />
                    )}
                  </EditIconButton>

                  <DeleteIconButton 
                    itemLabel="obligation" 
                    onConfirm={() => { 
                      dispatch({ type: "bill:remove", payload: bill.id }); 
                      toast.success("Obligation deleted"); 
                    }} 
                  />
                </div>
              </div>
            </Card>
          );
        })}

        {filteredObligations.length === 0 && (
          <Card className="card-luxe col-span-full p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
            <Calendar size={36} className="text-muted-foreground/40" />
            <span>No recurring obligations or subscriptions match current filters.</span>
          </Card>
        )}
      </div>

      {/* RECORD PAYMENT DIALOG */}
      <Dialog open={payingBill !== null} onOpenChange={(o) => !o && setPayingBill(null)}>
        <DialogContent className="max-w-md p-0">
          {payingBill && (
            <PaymentDialog 
              bill={payingBill} 
              accounts={state.accounts} 
              onSubmit={handlePayConfirm} 
              onCancel={() => setPayingBill(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore, uid, type Investment } from "@/lib/store";
import { formatINR } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { AddButton, EditIconButton, DeleteIconButton, FormDialogHeader, FormFooter } from "@/components/crud";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { SelectorEngine } from "@/lib/financial-engine";
import { 
  TrendingUp, TrendingDown, Coins, Plus, Scale, Percent, 
  History, AlertTriangle, AlertCircle, HeartPulse, ChevronRight,
  ShieldAlert, Settings, DollarSign, Receipt, Info, Sparkles, Activity, Pencil
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/investments")({
  head: () => ({ meta: [{ title: "Investments · GloriousFinance" }] }),
  component: InvPage,
});

const TYPES: { v: Investment["type"]; label: string; assetClass: Investment["assetClass"] }[] = [
  { v: "stock", label: "Stock", assetClass: "equity" },
  { v: "mutual_fund", label: "Mutual Fund", assetClass: "equity" },
  { v: "etf", label: "ETF", assetClass: "equity" },
  { v: "bond", label: "Bond", assetClass: "fixed_income" },
  { v: "fd", label: "Fixed Deposit", assetClass: "cash_equivalent" },
  { v: "ppf", label: "PPF", assetClass: "fixed_income" },
  { v: "nps", label: "NPS", assetClass: "equity" },
  { v: "gold", label: "Gold", assetClass: "gold_silver" },
  { v: "silver", label: "Silver", assetClass: "gold_silver" },
  { v: "crypto", label: "Crypto", assetClass: "crypto" },
  { v: "real_estate", label: "Real Estate", assetClass: "real_estate" },
  { v: "reit", label: "REIT", assetClass: "real_estate" },
  { v: "commodity", label: "Commodity", assetClass: "other" },
  { v: "custom", label: "Custom Asset", assetClass: "other" }
];

const ASSET_CLASSES: { v: Investment["assetClass"]; label: string }[] = [
  { v: "equity", label: "Equity" },
  { v: "fixed_income", label: "Fixed Income" },
  { v: "gold_silver", label: "Gold & Silver" },
  { v: "cash_equivalent", label: "Cash Equivalent" },
  { v: "real_estate", label: "Real Estate" },
  { v: "crypto", label: "Cryptocurrency" },
  { v: "other", label: "Other Assets" }
];

const empty = (): Investment => ({
  id: uid(),
  name: "",
  type: "stock",
  assetClass: "equity",
  units: 0,
  averageBuyPrice: 0,
  currentPrice: 0,
  purchaseQuantity: 0,
  fees: 0,
  taxes: 0,
  status: "active",
  tags: [],
  notes: ""
});

interface ActionFormProps {
  investment: Investment;
  accounts: any[];
  onSubmit: (payload: any) => void;
  onCancel: () => void;
}

function BuyForm({ investment, accounts, onSubmit, onCancel }: ActionFormProps) {
  const [units, setUnits] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("0");
  const [taxes, setTaxes] = useState("0");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const totalCost = (parseFloat(units) || 0) * (parseFloat(price) || 0) + (parseFloat(fees) || 0) + (parseFloat(taxes) || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = parseFloat(units);
    const p = parseFloat(price);
    if (!u || u <= 0) return toast.error("Enter valid quantity");
    if (!p || p <= 0) return toast.error("Enter valid price");
    onSubmit({ investmentId: investment.id, units: u, price: p, accountId, date, fees: parseFloat(fees) || 0, taxes: parseFloat(taxes) || 0 });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormDialogHeader title={`Buy ${investment.name}`} subtitle={`Current holdings: ${investment.units ?? 0} units`} />
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Quantity (Units)</Label><Input type="number" step="any" required value={units} onChange={e => setUnits(e.target.value)} placeholder="0.00" /></div>
        <div><Label>Price per Unit (₹)</Label><Input type="number" step="any" required value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" /></div>
        <div><Label>Fees (₹)</Label><Input type="number" step="any" value={fees} onChange={e => setFees(e.target.value)} /></div>
        <div><Label>Taxes (₹)</Label><Input type="number" step="any" value={taxes} onChange={e => setTaxes(e.target.value)} /></div>
        <div className="col-span-2"><Label>Linked Payment Account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} (₹{a.balance.toLocaleString()})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label>Transaction Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      </div>
      <div className="rounded-lg bg-muted/50 p-3 text-xs flex justify-between items-center border">
        <span className="text-muted-foreground font-medium">Total Cost:</span>
        <span className="font-semibold font-numeric text-sm text-foreground">{formatINR(totalCost)}</span>
      </div>
      <FormFooter onCancel={onCancel} submitLabel="Log Purchase" />
    </form>
  );
}

function SellForm({ investment, accounts, onSubmit, onCancel }: ActionFormProps) {
  const [units, setUnits] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("0");
  const [taxes, setTaxes] = useState("0");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const totalPayout = (parseFloat(units) || 0) * (parseFloat(price) || 0) - (parseFloat(fees) || 0) - (parseFloat(taxes) || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = parseFloat(units);
    const p = parseFloat(price);
    if (!u || u <= 0) return toast.error("Enter valid quantity");
    if (u > (investment.units ?? 0)) return toast.error(`Cannot sell more than owned (${investment.units ?? 0} units)`);
    if (!p || p <= 0) return toast.error("Enter valid price");
    onSubmit({ investmentId: investment.id, units: u, price: p, accountId, date, fees: parseFloat(fees) || 0, taxes: parseFloat(taxes) || 0 });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormDialogHeader title={`Sell ${investment.name}`} subtitle={`Available holdings: ${investment.units ?? 0} units`} />
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Quantity to Sell</Label><Input type="number" step="any" required max={investment.units} value={units} onChange={e => setUnits(e.target.value)} placeholder="0.00" /></div>
        <div><Label>Price per Unit (₹)</Label><Input type="number" step="any" required value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" /></div>
        <div><Label>Fees (₹)</Label><Input type="number" step="any" value={fees} onChange={e => setFees(e.target.value)} /></div>
        <div><Label>Taxes (₹)</Label><Input type="number" step="any" value={taxes} onChange={e => setTaxes(e.target.value)} /></div>
        <div className="col-span-2"><Label>Linked Deposit Account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} (₹{a.balance.toLocaleString()})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label>Transaction Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      </div>
      <div className="rounded-lg bg-muted/50 p-3 text-xs flex justify-between items-center border">
        <span className="text-muted-foreground font-medium">Estimated Net Credit:</span>
        <span className="font-semibold font-numeric text-sm text-foreground">{formatINR(totalPayout)}</span>
      </div>
      <FormFooter onCancel={onCancel} submitLabel="Log Sale" />
    </form>
  );
}

function DividendForm({ investment, accounts, onSubmit, onCancel }: ActionFormProps) {
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter valid dividend amount");
    onSubmit({ investmentId: investment.id, amount: amt, accountId, date });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormDialogHeader title={`Record Dividend for ${investment.name}`} subtitle="Records dividend income received in your account ledger." />
      <div className="space-y-3">
        <div><Label>Dividend Payout Amount (₹)</Label><Input type="number" step="any" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></div>
        <div><Label>Deposit Account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Payout Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      </div>
      <FormFooter onCancel={onCancel} submitLabel="Record Payout" />
    </form>
  );
}

function BonusForm({ investment, onSubmit, onCancel }: Omit<ActionFormProps, "accounts">) {
  const [units, setUnits] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = parseFloat(units);
    if (!u || u <= 0) return toast.error("Enter valid bonus quantity");
    onSubmit({ investmentId: investment.id, units: u, date });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormDialogHeader title={`Record Bonus Shares: ${investment.name}`} subtitle="Adds free shares to holdings. Decreases average buy price automatically." />
      <div className="space-y-3">
        <div><Label>Bonus Shares Received (Units)</Label><Input type="number" step="any" required value={units} onChange={e => setUnits(e.target.value)} placeholder="0.00" /></div>
        <div><Label>Record Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      </div>
      <FormFooter onCancel={onCancel} submitLabel="Apply Bonus Shares" />
    </form>
  );
}

function SplitForm({ investment, onSubmit, onCancel }: Omit<ActionFormProps, "accounts">) {
  const [ratio, setRatio] = useState("2");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = parseFloat(ratio);
    if (!r || r <= 0) return toast.error("Enter valid split ratio");
    onSubmit({ investmentId: investment.id, ratio: r, date });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormDialogHeader title={`Record Stock Split: ${investment.name}`} subtitle="Updates shares quantity and adjusts prices proportionally." />
      <div className="space-y-3">
        <div><Label>Split Ratio (e.g. 2 for 2-for-1 split)</Label><Input type="number" step="any" required value={ratio} onChange={e => setRatio(e.target.value)} placeholder="e.g. 2" /></div>
        <div><Label>Record Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      </div>
      <FormFooter onCancel={onCancel} submitLabel="Apply Split" />
    </form>
  );
}

function InvForm({ initial, accounts, onSubmit, onCancel }: { initial: Investment; accounts: any[]; onSubmit: (inv: Investment, logPurchase: boolean) => void; onCancel: () => void }) {
  const [i, setI] = useState<Investment>(initial);
  const [logPurchase, setLogPurchase] = useState(false);
  const set = <K extends keyof Investment>(k: K, v: Investment[K]) => setI(p => ({ ...p, [k]: v }));
  
  // Custom advanced metadata keys
  const [sector, setSector] = useState(initial.metadata?.sector || "");
  const [broker, setBroker] = useState(initial.broker || "");
  const [exchange, setExchange] = useState(initial.exchange || "");
  const [currency, setCurrency] = useState(initial.currency || "INR");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!i.name) return toast.error("Holding name is required");
    const updated = {
      ...i,
      broker: broker || undefined,
      exchange: exchange || undefined,
      currency: currency || undefined,
      metadata: {
        ...i.metadata,
        sector: sector || undefined
      }
    };
    onSubmit(updated, logPurchase);
  };

  const currentType = TYPES.find(t => t.v === i.type);

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      <FormDialogHeader title={initial.name ? "Edit Investment Asset" : "Add Investment Asset"} subtitle="Register a stocks, mutual funds, or custom asset in your portfolio." />
      <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
        <div className="col-span-2"><Label>Asset Name</Label><Input value={i.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Reliance Industries, HDFC Mutual Fund" /></div>
        <div><Label>Asset Type</Label>
          <Select value={i.type} onValueChange={(v) => {
            const typ = TYPES.find(x => x.v === v);
            setI(prev => ({
              ...prev,
              type: v as Investment["type"],
              assetClass: typ ? typ.assetClass : prev.assetClass
            }));
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Asset Class</Label>
          <Select value={i.assetClass} onValueChange={(v) => set("assetClass", v as Investment["assetClass"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ASSET_CLASSES.map(ac => <SelectItem key={ac.v} value={ac.v}>{ac.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {/* Initial Holdings block (available only on creation) */}
        {!initial.name && (
          <>
            <div className="col-span-2 border-t pt-2 mt-2"><h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Initial Holdings (Optional)</h4></div>
            <div><Label>Units Owned</Label><Input type="number" step="any" value={i.units || ""} onChange={(e) => set("units", parseFloat(e.target.value) || 0)} /></div>
            <div><Label>Average Buy Price (₹)</Label><Input type="number" step="any" value={i.averageBuyPrice || ""} onChange={(e) => set("averageBuyPrice", parseFloat(e.target.value) || 0)} /></div>
            <div className="col-span-2"><Label>Current Market Price (₹)</Label><Input type="number" step="any" value={i.currentPrice || ""} onChange={(e) => set("currentPrice", parseFloat(e.target.value) || 0)} /></div>
            
            {i.units > 0 && (
              <div className="col-span-2 flex items-center space-x-2 border rounded-lg p-2.5 bg-muted/20">
                <input type="checkbox" id="logPurchase" checked={logPurchase} onChange={e => setLogPurchase(e.target.checked)} className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4" />
                <Label htmlFor="logPurchase" className="text-xs font-normal cursor-pointer leading-tight">
                  Log as bank purchase transaction (debits linked account below)
                </Label>
              </div>
            )}

            {logPurchase && i.units > 0 && (
              <div className="col-span-2"><Label>Funding Account</Label>
                <Select value={i.linkedAccountId || ""} onValueChange={(v) => set("linkedAccountId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} (₹{a.balance.toLocaleString()})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </>
        )}

        {/* Current price editor for edits */}
        {initial.name && (
          <div className="col-span-2 border-t pt-2 mt-2">
            <Label>Current Market Price (₹)</Label>
            <Input type="number" step="any" value={i.currentPrice || ""} onChange={(e) => set("currentPrice", parseFloat(e.target.value) || 0)} />
          </div>
        )}

        {/* Advanced metadata section */}
        <div className="col-span-2 border-t pt-2 mt-2">
          <Button type="button" variant="ghost" size="sm" className="w-full justify-between px-2 text-muted-foreground" onClick={() => setShowAdvanced(!showAdvanced)}>
            <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1"><Settings className="h-3 w-3" /> Advanced Specifications</span>
            <ChevronRight className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`} />
          </Button>
          
          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3 mt-3 pt-1">
              <div><Label>Broker / Custodian</Label><Input value={broker} onChange={e => setBroker(e.target.value)} placeholder="e.g. Zerodha, Groww" /></div>
              <div><Label>Exchange</Label><Input value={exchange} onChange={e => setExchange(e.target.value)} placeholder="e.g. NSE, BSE" /></div>
              <div><Label>Sector</Label><Input value={sector} onChange={e => setSector(e.target.value)} placeholder="e.g. Tech, Finance, Energy" /></div>
              <div><Label>Currency</Label><Input value={currency} onChange={e => setCurrency(e.target.value)} placeholder="INR" /></div>
              <div className="col-span-2"><Label>Notes</Label><Input value={i.notes} onChange={e => set("notes", e.target.value)} placeholder="Investment strategy, targets, exit criteria..." /></div>
            </div>
          )}
        </div>
      </div>
      <FormFooter onCancel={onCancel} />
    </form>
  );
}

function InvPage() {
  const { state, dispatch } = useStore();
  const [openAdd, setOpenAdd] = useState(false);
  const [activeAction, setActiveAction] = useState<{ type: "buy" | "sell" | "dividend" | "bonus" | "split" | "edit"; inv: Investment } | null>(null);

  // Compute detailed metrics via SelectorEngine
  const summary = useMemo(() => SelectorEngine.getPortfolioSummary(state), [state]);
  const holdings = useMemo(() => SelectorEngine.getInvestments(state), [state]);
  const assetAllocation = useMemo(() => SelectorEngine.getAssetAllocation(state), [state]);
  const sectorAllocation = useMemo(() => SelectorEngine.getSectorAllocation(state), [state]);
  const topGainers = useMemo(() => SelectorEngine.getTopGainers(state), [state]);
  const topLosers = useMemo(() => SelectorEngine.getTopLosers(state), [state]);
  const timeline = useMemo(() => SelectorEngine.getInvestmentTimeline(state), [state]);
  const netWorthPct = useMemo(() => SelectorEngine.getNetWorthContribution(state), [state]);

  const accounts = useMemo(() => state.accounts.filter(a => a.type !== "credit_card"), [state.accounts]);

  const COLORS = [
    "var(--color-primary)", 
    "var(--color-gold)", 
    "var(--color-success)", 
    "var(--color-warning)", 
    "var(--color-peach)", 
    "var(--color-navy-soft)", 
    "#8a8fa3", 
    "#c58a5d", 
    "#7a94b8"
  ];

  const handleActionSubmit = (payload: any) => {
    if (!activeAction) return;
    try {
      const typeMap: Record<string, string> = {
        buy: "inv:buy",
        sell: "inv:sell",
        dividend: "inv:dividend",
        bonus: "inv:bonus",
        split: "inv:split"
      };
      
      dispatch({ type: typeMap[activeAction.type] as any, payload });
      setActiveAction(null);
      toast.success(`${activeAction.type.charAt(0).toUpperCase() + activeAction.type.slice(1)} logged successfully`);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit action");
    }
  };

  return (
    <div>
      <PageHeader 
        title="Investments" 
        subtitle="Manage and analyze your multi-asset portfolio with professional performance analytics."
        action={
          <AddButton label="Add Holding" open={openAdd} onOpenChange={setOpenAdd}>
            <InvForm 
              initial={empty()} 
              accounts={accounts}
              onCancel={() => setOpenAdd(false)} 
              onSubmit={(inv, logPurchase) => {
                if (logPurchase && (inv.units ?? 0) > 0) {
                  const initialInv = { ...inv, units: 0, averageBuyPrice: 0 };
                  dispatch({ type: "inv:add", payload: initialInv });
                  dispatch({
                    type: "inv:buy",
                    payload: {
                      investmentId: inv.id,
                      units: inv.units,
                      price: inv.averageBuyPrice,
                      accountId: inv.linkedAccountId || accounts[0]?.id || "",
                      date: new Date().toISOString().slice(0, 10),
                      fees: inv.fees ?? 0,
                      taxes: inv.taxes ?? 0
                    }
                  });
                  toast.success("Holding added and buy transaction logged");
                } else {
                  dispatch({ type: "inv:add", payload: inv });
                  toast.success("Holding added to portfolio");
                }
                setOpenAdd(false);
              }} 
            />
          </AddButton>
        }
      />

      {/* Alert banner for portfolio health notifications */}
      {summary.healthAlerts.length > 0 && (
        <div className="px-6 md:px-10 mt-4">
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex gap-3 text-warning">
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="text-sm font-semibold">Portfolio Optimization Recommendations</div>
              <ul className="text-xs space-y-1 opacity-90 list-disc list-inside">
                {summary.healthAlerts.map((a: string, idx: number) => <li key={idx}>{a}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Performance Summary Cards */}
      <div className="grid gap-4 p-6 md:grid-cols-5 md:p-10">
        <Card className="card-luxe p-5 ring-1 ring-gold/30">
          <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Coins className="h-3 w-3 text-gold" /> Portfolio Value</div>
          <div className="mt-2 font-numeric text-2xl font-semibold text-gold">{formatINR(summary.portfolioValue)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{netWorthPct.toFixed(1)}% of Net Worth</div>
        </Card>
        <Card className="card-luxe p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Invested Capital</div>
          <div className="mt-2 font-numeric text-2xl font-semibold">{formatINR(summary.portfolioInvested)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Absolute Cost Basis</div>
        </Card>
        <Card className="card-luxe p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Unrealized P&L</div>
          <div className={`mt-2 font-numeric text-2xl font-semibold flex items-center gap-1 ${summary.unrealizedPl >= 0 ? "text-success" : "text-destructive"}`}>
            {summary.unrealizedPl >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            {formatINR(summary.unrealizedPl, { sign: true })}
          </div>
          <div className={`text-xs ${summary.unrealizedPl >= 0 ? "text-success" : "text-destructive"}`}>
            {summary.unrealizedPl >= 0 ? "+" : ""}{summary.returnPercentage.toFixed(2)}% Simple ROI
          </div>
        </Card>
        <Card className="card-luxe p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">CAGR / XIRR</div>
          <div className="mt-2 font-numeric text-2xl font-semibold text-primary">{summary.cagr.toFixed(1)}% / {summary.xirr.toFixed(1)}%</div>
          <div className="mt-1 text-xs text-muted-foreground">Annualized Returns</div>
        </Card>
        <Card className="card-luxe p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Receipt className="h-3.5 w-3.5 text-success" /> Dividends</div>
          <div className="mt-2 font-numeric text-2xl font-semibold text-success">{formatINR(summary.totalDividends)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Yield: {summary.dividendYield.toFixed(2)}%</div>
        </Card>
      </div>

      <div className="px-6 pb-10 md:px-10">
        <Tabs defaultValue="holdings" className="space-y-6">
          <TabsList className="bg-muted/30 border p-1 rounded-xl">
            <TabsTrigger value="holdings" className="rounded-lg text-sm px-4">Holdings Ledger</TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-lg text-sm px-4">Diversification & Analytics</TabsTrigger>
            <TabsTrigger value="timeline" className="rounded-lg text-sm px-4">Activity Timeline</TabsTrigger>
          </TabsList>

          {/* HOLDINGS TAB */}
          <TabsContent value="holdings">
            <Card className="card-luxe overflow-hidden border">
              <div className="border-b border-border/60 p-4 flex justify-between items-center bg-card-header/10">
                <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Active Holdings
                </h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset Specifications</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Quantity (Units)</TableHead>
                      <TableHead className="text-right">Avg Buy Price</TableHead>
                      <TableHead className="text-right">Market Price</TableHead>
                      <TableHead className="text-right">Current Value</TableHead>
                      <TableHead className="text-right">Unrealized P&L</TableHead>
                      <TableHead className="text-right">Dividends</TableHead>
                      <TableHead className="text-right pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holdings.map(inv => {
                      const label = TYPES.find(t => t.v === inv.type)?.label || inv.type;
                      return (
                        <TableRow key={inv.id} className="hover:bg-muted/10 transition-colors">
                          <TableCell className="font-medium pl-6">
                            <div>{inv.name}</div>
                            {inv.broker && <div className="text-[10px] text-muted-foreground font-mono">{inv.broker} • {inv.exchange || "CUSTOM"}</div>}
                          </TableCell>
                          <TableCell><Badge variant="secondary" className="font-normal capitalize">{label}</Badge></TableCell>
                          <TableCell className="text-right font-numeric font-medium">{inv.units?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) || "0.00"}</TableCell>
                          <TableCell className="text-right font-numeric">{formatINR(inv.averageBuyPrice)}</TableCell>
                          <TableCell className="text-right font-numeric">{formatINR(inv.currentPrice)}</TableCell>
                          <TableCell className="text-right font-numeric font-semibold text-foreground">{formatINR(inv.currentValue)}</TableCell>
                          <TableCell className={`text-right font-numeric font-medium ${inv.gainLoss >= 0 ? "text-success" : "text-destructive"}`}>
                            <div>{formatINR(inv.gainLoss, { sign: true })}</div>
                            <div className="text-[10px] font-normal">{inv.gainLoss >= 0 ? "+" : ""}{inv.gainLossPercentage.toFixed(1)}%</div>
                          </TableCell>
                          <TableCell className="text-right font-numeric text-success/90">{formatINR(inv.totalDividends || 0)}</TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-1.5">
                              {/* Quick actions dropdown replacement: Simple Action Buttons */}
                              <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] border-primary/20 text-primary hover:bg-primary/5" onClick={() => setActiveAction({ type: "buy", inv })}>Buy</Button>
                              <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] border-destructive/20 text-destructive hover:bg-destructive/5" disabled={!inv.units} onClick={() => setActiveAction({ type: "sell", inv })}>Sell</Button>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-success hover:bg-success/5" onClick={() => setActiveAction({ type: "dividend", inv })}>Div</Button>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-muted-foreground hover:bg-muted" onClick={() => setActiveAction({ type: "edit", inv })}><Pencil className="h-3 w-3" /></Button>
                              <DeleteIconButton itemLabel="holding" onConfirm={() => { dispatch({ type: "inv:remove", payload: inv.id }); toast.success("Holding deleted"); }} />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {holdings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                          <Info className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                          Track your first investment holding using the "Add Holding" button above.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* ANALYTICS TAB */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Asset Allocation Chart */}
              <Card className="card-luxe p-6">
                <h3 className="font-display text-lg font-semibold flex items-center gap-1.5 mb-4">
                  <PieChart className="h-4.5 w-4.5 text-primary" /> Asset Allocation
                </h3>
                {assetAllocation.length === 0 ? (
                  <div className="flex h-64 flex-col items-center justify-center text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                    No financial data available
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={assetAllocation} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
                          {assetAllocation.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => <span className="capitalize">{TYPES.find(t => t.v === value)?.label || value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>

              {/* Sector Allocation Chart */}
              <Card className="card-luxe p-6">
                <h3 className="font-display text-lg font-semibold flex items-center gap-1.5 mb-4">
                  <PieChart className="h-4.5 w-4.5 text-gold" /> Sector Allocation
                </h3>
                {sectorAllocation.length === 0 ? (
                  <div className="flex h-64 flex-col items-center justify-center text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                    No financial data available
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={sectorAllocation} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
                          {sectorAllocation.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>

              {/* Diversification Card */}
              <Card className="card-luxe p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-display text-base font-semibold flex items-center gap-1.5">
                    <Scale className="h-4 w-4 text-primary" /> Diversification score
                  </h3>
                  <span className="font-numeric text-sm font-semibold">{summary.diversificationScore}/100</span>
                </div>
                <Progress value={summary.diversificationScore} className="h-2" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Calculated using Herfindahl-Hirschman Index (HHI) weights. A score of 70+ indicates a well-balanced, low-correlated holdings spread.
                </p>
                <div className="text-xs font-medium border-t pt-3 flex justify-between">
                  <span className="text-muted-foreground">Diversification grade:</span>
                  <span className={summary.diversificationScore >= 70 ? "text-success" : summary.diversificationScore >= 45 ? "text-warning" : "text-destructive"}>
                    {summary.diversificationScore >= 70 ? "Highly Diversified" : summary.diversificationScore >= 45 ? "Moderately Concentrated" : "Critically Concentrated"}
                  </span>
                </div>
              </Card>

              {/* Risk Level Card */}
              <Card className="card-luxe p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-display text-base font-semibold flex items-center gap-1.5">
                    <HeartPulse className="h-4 w-4 text-destructive" /> Portfolio Risk Profile
                  </h3>
                  <span className="font-numeric text-sm font-semibold">{summary.riskScore}/100</span>
                </div>
                <Progress value={summary.riskScore} className="h-2" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Weighted average score based on asset class volatility weights. High risk is associated with cryptocurrencies and high-beta stocks.
                </p>
                <div className="text-xs font-medium border-t pt-3 flex justify-between">
                  <span className="text-muted-foreground">Risk Rating:</span>
                  <span className={summary.riskScore >= 70 ? "text-destructive" : summary.riskScore >= 35 ? "text-warning" : "text-success"}>
                    {summary.riskScore >= 70 ? "Aggressive (High)" : summary.riskScore >= 35 ? "Balanced (Medium)" : "Conservative (Low)"}
                  </span>
                </div>
              </Card>
            </div>

            {/* Top Performers and Losers */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="card-luxe p-5 border border-success/20">
                <h4 className="text-xs font-bold uppercase tracking-wider text-success mb-3 flex items-center gap-1"><TrendingUp className="h-4 w-4" /> Top Performers</h4>
                <div className="space-y-2">
                  {topGainers.map((i: any) => (
                    <div key={i.id} className="flex justify-between items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                      <span className="font-medium">{i.name}</span>
                      <span className="font-numeric text-success font-semibold flex items-center gap-1">
                        {formatINR(i.gainLoss, { compact: true })} (+{i.gainLossPercentage.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                  {topGainers.length === 0 && <div className="text-center text-xs text-muted-foreground py-4">No profitable assets yet</div>}
                </div>
              </Card>

              <Card className="card-luxe p-5 border border-destructive/20">
                <h4 className="text-xs font-bold uppercase tracking-wider text-destructive mb-3 flex items-center gap-1"><TrendingDown className="h-4 w-4" /> Bottom Performers</h4>
                <div className="space-y-2">
                  {topLosers.map((i: any) => (
                    <div key={i.id} className="flex justify-between items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                      <span className="font-medium">{i.name}</span>
                      <span className="font-numeric text-destructive font-semibold flex items-center gap-1">
                        {formatINR(i.gainLoss, { compact: true })} ({i.gainLossPercentage.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                  {topLosers.length === 0 && <div className="text-center text-xs text-muted-foreground py-4">No loss-making assets yet</div>}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* ACTIVITY TIMELINE TAB */}
          <TabsContent value="timeline">
            <Card className="card-luxe p-6">
              <h3 className="font-display text-lg font-semibold flex items-center gap-1.5 mb-6">
                <History className="h-5 w-5 text-primary" /> Portfolio Ledger Timeline
              </h3>
              <div className="relative border-l border-border pl-6 space-y-6">
                {timeline.map((t: any) => {
                  let isCredit = ["investment_sale", "dividend"].includes(t.kind);
                  let kindLabel = t.kind.split("_").join(" ");
                  return (
                    <div key={t.id} className="relative">
                      {/* Timeline dot */}
                      <span className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full border bg-background ${isCredit ? "border-success bg-success/20" : t.amount === 0 ? "border-muted bg-muted" : "border-destructive bg-destructive/20"}`} />
                      
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wider text-foreground capitalize flex items-center gap-1.5">
                            {kindLabel}
                            <span className="font-normal lowercase text-muted-foreground">on {new Date(t.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                          </div>
                          <div className="text-sm font-medium mt-0.5 text-muted-foreground">{t.merchant}</div>
                          {t.note && <div className="text-xs text-muted-foreground mt-1 italic">"{t.note}"</div>}
                        </div>
                        <div className="text-right">
                          {t.amount > 0 ? (
                            <div className={`font-numeric text-sm font-semibold ${isCredit ? "text-success" : "text-destructive"}`}>
                              {isCredit ? "+" : "-"}{formatINR(t.amount)}
                            </div>
                          ) : (
                            <div className="text-xs font-semibold text-muted-foreground font-mono uppercase">Holding Adjustment</div>
                          )}
                          {t.metadata?.units && (
                            <div className="text-[10px] text-muted-foreground font-numeric mt-0.5">{t.metadata.units} units @ ₹{t.metadata.price}</div>
                          )}
                          {t.metadata?.realizedGainLoss !== undefined && (
                            <div className={`text-[10px] font-numeric mt-0.5 font-medium ${t.metadata.realizedGainLoss >= 0 ? "text-success" : "text-destructive"}`}>
                              Realized: {formatINR(t.metadata.realizedGainLoss, { sign: true })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {timeline.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-10">
                    No transactions registered. Log your first buy or sell to generate ledger timeline.
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dynamic Action Modals Overlay */}
      {activeAction && (
        <Dialog open={true} onOpenChange={() => setActiveAction(null)}>
          <DialogContent className="max-w-lg">
            {activeAction.type === "buy" && (
              <BuyForm 
                investment={activeAction.inv} 
                accounts={accounts} 
                onSubmit={handleActionSubmit} 
                onCancel={() => setActiveAction(null)} 
              />
            )}
            {activeAction.type === "sell" && (
              <SellForm 
                investment={activeAction.inv} 
                accounts={accounts} 
                onSubmit={handleActionSubmit} 
                onCancel={() => setActiveAction(null)} 
              />
            )}
            {activeAction.type === "dividend" && (
              <DividendForm 
                investment={activeAction.inv} 
                accounts={accounts} 
                onSubmit={handleActionSubmit} 
                onCancel={() => setActiveAction(null)} 
              />
            )}
            {activeAction.type === "bonus" && (
              <BonusForm 
                investment={activeAction.inv} 
                onSubmit={handleActionSubmit} 
                onCancel={() => setActiveAction(null)} 
              />
            )}
            {activeAction.type === "split" && (
              <SplitForm 
                investment={activeAction.inv} 
                onSubmit={handleActionSubmit} 
                onCancel={() => setActiveAction(null)} 
              />
            )}
            {activeAction.type === "edit" && (
              <InvForm 
                initial={activeAction.inv} 
                accounts={accounts}
                onCancel={() => setActiveAction(null)} 
                onSubmit={(updated) => {
                  dispatch({ type: "inv:update", payload: updated });
                  setActiveAction(null);
                  toast.success("Holding updated successfully");
                }} 
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

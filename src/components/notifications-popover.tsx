import { useStore } from "@/lib/store";
import { useMemo } from "react";
import { Bell, BellOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate } from "@/lib/format";

export function NotificationsPopover() {
  const { state } = useStore();
  const { transactions, budgets, bills, goals, accounts, loans, investments } = state;

  const notifications = useMemo(() => {
    const list: Array<{ id: string; type: "budget" | "bill" | "goal" | "loan"; title: string; message: string; severity: "info" | "warning" | "error"; date: string }> = [];

    // 1. Budgets Exceeded Check
    const now = new Date();
    const currentMonthExpenses = new Map<string, number>();
    transactions
      .filter(t => t.kind === "expense")
      .forEach(t => {
        const d = new Date(t.date);
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          currentMonthExpenses.set(t.category, (currentMonthExpenses.get(t.category) || 0) + t.amount);
        }
      });

    budgets.forEach(b => {
      const spent = currentMonthExpenses.get(b.category) || 0;
      if (spent > b.limit) {
        list.push({
          id: `budget-${b.id}`,
          type: "budget",
          title: "Budget Exceeded",
          message: `Your budget for ${b.category} (${formatINR(b.limit)}) has been exceeded by ${formatINR(spent - b.limit)}.`,
          severity: "error",
          date: todayISOString(),
        });
      } else if (spent > b.limit * 0.8) {
        list.push({
          id: `budget-warn-${b.id}`,
          type: "budget",
          title: "Budget Warning",
          message: `You've used ${((spent / b.limit) * 100).toFixed(0)}% of your ${b.category} budget.`,
          severity: "warning",
          date: todayISOString(),
        });
      }
    });

    // 2. Upcoming / Overdue Bills Check
    bills.filter(b => !b.paid).forEach(b => {
      const dueDate = new Date(b.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        list.push({
          id: `bill-overdue-${b.id}`,
          type: "bill",
          title: "Overdue Bill",
          message: `Bill "${b.name}" of ${formatINR(b.amount)} was due on ${formatDate(b.dueDate)}.`,
          severity: "error",
          date: b.dueDate,
        });
      } else if (diffDays <= 7) {
        list.push({
          id: `bill-due-${b.id}`,
          type: "bill",
          title: "Upcoming Bill Due",
          message: `Bill "${b.name}" of ${formatINR(b.amount)} is due in ${diffDays} day${diffDays === 1 ? "" : "s"}.`,
          severity: "warning",
          date: b.dueDate,
        });
      }
    });

    // 3. Goal milestones Check
    goals.forEach(g => {
      const pct = g.target ? (g.saved / g.target) * 100 : 0;
      if (pct >= 100) {
        list.push({
          id: `goal-done-${g.id}`,
          type: "goal",
          title: "Goal Reached! 🌟",
          message: `Congratulations! You've achieved your goal "${g.name}" by saving ${formatINR(g.target)}.`,
          severity: "info",
          date: todayISOString(),
        });
      } else if (pct >= 75) {
        list.push({
          id: `goal-near-${g.id}`,
          type: "goal",
          title: "Goal Milestone Reached",
          message: `Goal "${g.name}" is ${pct.toFixed(0)}% funded (${formatINR(g.saved)} / ${formatINR(g.target)}).`,
          severity: "info",
          date: todayISOString(),
        });
      }
    });

    // 4. Debt-to-Asset check
    const assets = accounts.filter(a => a.balance > 0).reduce((s: number, a) => s + a.balance, 0)
      + investments.reduce((s: number, i) => s + i.current, 0);
    const totalLoans = loans.reduce((s: number, l) => s + l.outstanding, 0);
    if (assets > 0 && totalLoans > 0) {
      const ratio = totalLoans / assets;
      if (ratio > 0.5) {
        list.push({
          id: "loan-debt-high",
          type: "loan",
          title: "High Debt-to-Asset Ratio",
          message: `Your debt is ${(ratio * 100).toFixed(0)}% of your assets. Consider paying down loans.`,
          severity: "warning",
          date: todayISOString(),
        });
      }
    }

    return list;
  }, [transactions, budgets, bills, goals, accounts, loans, investments]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-full border border-border/40 bg-muted/40 hover:bg-muted/65">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {notifications.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground animate-pulse">
              {notifications.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 mr-4" align="end">
        <div className="border-b border-border/60 p-4">
          <h4 className="font-display text-sm font-semibold">Alerts & Notifications</h4>
          <p className="text-xs text-muted-foreground">Reactive financial system alerts</p>
        </div>
        <div className="max-h-[300px] overflow-y-auto divide-y divide-border/60">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-muted-foreground">
              <BellOff className="h-6 w-6 text-muted-foreground/45 mb-1.5" />
              All systems nominal. No alerts.
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id} className="p-3.5 text-xs text-left transition-colors hover:bg-muted/30">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  {n.severity === "error" && <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0 animate-pulse" />}
                  {n.severity === "warning" && <span className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" />}
                  {n.severity === "info" && <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />}
                  <span className="text-foreground">{n.title}</span>
                </div>
                <p className="text-muted-foreground leading-relaxed font-normal">{n.message}</p>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function todayISOString() {
  return new Date().toISOString().slice(0, 10);
}

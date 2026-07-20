import { useStore } from "@/lib/store";
import { useMemo } from "react";
import { Bell, BellOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate } from "@/lib/format";
import { SelectorEngine } from "@/lib/financial-engine";

export function NotificationsPopover() {
  const { state } = useStore();
  const { transactions, budgets, bills, goals } = state;

  const notifications = useMemo(() => {
    const list: Array<{ id: string; type: "budget" | "bill" | "goal" | "loan"; title: string; message: string; severity: "info" | "warning" | "error"; date: string }> = [];

    // 1. Budgets Exceeded Check
    SelectorEngine.getBudgets(state).forEach(b => {
      const { spent, utilization, overspending } = b.metrics;
      const threshold = b.alertThreshold !== undefined ? b.alertThreshold : 80;
      if (spent > b.limit) {
        list.push({
          id: `budget-${b.id}`,
          type: "budget",
          title: "Budget Exceeded",
          message: `Your ${b.period} budget for ${b.category} (${formatINR(b.limit)}) has been exceeded by ${formatINR(overspending)}.`,
          severity: "error",
          date: todayISOString(),
        });
      } else if (utilization > threshold) {
        list.push({
          id: `budget-warn-${b.id}`,
          type: "budget",
          title: "Budget Warning",
          message: `You've used ${utilization.toFixed(0)}% of your ${b.period} ${b.category} budget.`,
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
    SelectorEngine.getGoals(state).forEach(g => {
      const { progress, isCompleted, isOverdue, goalHealth } = g.metrics;
      if (isCompleted) {
        list.push({
          id: `goal-done-${g.id}`,
          type: "goal",
          title: "Goal Reached! 🌟",
          message: `Congratulations! You've achieved your goal "${g.name}" by saving ${formatINR(g.target)}.`,
          severity: "info",
          date: todayISOString(),
        });
      } else if (isOverdue) {
        list.push({
          id: `goal-overdue-${g.id}`,
          type: "goal",
          title: "Goal Overdue",
          message: `Goal "${g.name}" has passed its deadline. ${formatINR(g.metrics.fundingGap)} still needed.`,
          severity: "error",
          date: todayISOString(),
        });
      } else if (progress >= 75) {
        list.push({
          id: `goal-near-${g.id}`,
          type: "goal",
          title: "Goal Milestone Reached",
          message: `Goal "${g.name}" is ${progress.toFixed(0)}% funded (${formatINR(g.saved)} / ${formatINR(g.target)}).`,
          severity: "info",
          date: todayISOString(),
        });
      } else if (goalHealth === "Critical") {
        list.push({
          id: `goal-at-risk-${g.id}`,
          type: "goal",
          title: "Goal At Risk",
          message: `Goal "${g.name}" needs significantly higher contributions to meet its deadline.`,
          severity: "warning",
          date: todayISOString(),
        });
      }
    });

    // 4. Debt-to-Asset check
    const totalLoans = SelectorEngine.getLoansOutstandingSummary(state);
    const dashboard = SelectorEngine.getDashboard(state);
    const assets = dashboard.totalAssets;

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

    // 5. Loan upcoming & overdue check
    const activeLoans = SelectorEngine.getActiveLoans(state);
    const today = new Date();
    activeLoans.forEach(l => {
      const repayments = SelectorEngine.getLoanRepayments(state, l.id);
      const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const paidThisMonth = repayments.some(t => new Date(t.date) >= startOfCurrentMonth);

      if (!paidThisMonth) {
        const nextDue = new Date(l.metrics.nextDueDate);
        const diffTime = nextDue.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (today.getDate() > 5) {
          list.push({
            id: `loan-overdue-${l.id}`,
            type: "loan",
            title: "Overdue EMI Alert",
            message: `EMI of ${formatINR(l.emi)} for "${l.name}" was due on 5th of this month.`,
            severity: "error",
            date: todayISOString(),
          });
        } else if (diffDays >= 0 && diffDays <= 5) {
          list.push({
            id: `loan-due-${l.id}`,
            type: "loan",
            title: "Upcoming EMI Due",
            message: `EMI of ${formatINR(l.emi)} for "${l.name}" is due on ${formatDate(l.metrics.nextDueDate)}.`,
            severity: "warning",
            date: l.metrics.nextDueDate,
          });
        }
      }
    });

    return list;
  }, [state, transactions, budgets, bills, goals]);

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

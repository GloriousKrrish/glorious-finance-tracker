import type { State } from "../store";

export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  type: "transaction" | "goal" | "bill" | "investment" | "loan" | "security" | "system";
  badgeColor?: string;
}

export class ActivityTimelineEngine {
  public static getTimeline(state: State): TimelineEvent[] {
    const list: TimelineEvent[] = [];

    // 1. Transactions (e.g. Created / Completed)
    state.transactions.slice(0, 10).forEach(t => {
      list.push({
        id: `t_${t.id}`,
        timestamp: t.date + "T10:00:00Z",
        title: `${t.kind.toUpperCase()}: ${t.merchant || t.category}`,
        description: `Processed amount of ₹${t.amount.toLocaleString("en-IN")} via account.`,
        type: "transaction"
      });
    });

    // 2. Goal Achievements
    state.goals.forEach(g => {
      if (g.saved >= g.target) {
        list.push({
          id: `g_${g.id}`,
          timestamp: g.deadline + "T12:00:00Z",
          title: `Goal Achieved: ${g.name}`,
          description: `Fully funded target of ₹${g.target.toLocaleString("en-IN")} saved!`,
          type: "goal"
        });
      }
    });

    // 3. Bills paid
    state.bills.forEach(b => {
      if (b.status === "paid") {
        list.push({
          id: `b_${b.id}`,
          timestamp: b.dueDate + "T09:00:00Z",
          title: `Bill Paid: ${b.name}`,
          description: `Cleared payment invoice of ₹${b.amount.toLocaleString("en-IN")}.`,
          type: "bill"
        });
      }
    });

    // Sort by timestamp descending
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}

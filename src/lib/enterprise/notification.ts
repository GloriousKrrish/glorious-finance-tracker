export interface AppNotification {
  id: string;
  title: string;
  body: string;
  category: "bill" | "loan" | "goal" | "tax" | "investment" | "import" | "security" | "system";
  priority: "low" | "medium" | "high" | "critical";
  timestamp: string;
  read: boolean;
  snoozedUntil?: string;
  deepLink: string;
}

export class NotificationCenterEngine {
  private static STORAGE_KEY = "gf_notifications";

  public static getNotifications(): AppNotification[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      const seeds = this.getSeedNotifications();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seeds));
      return seeds;
    }
    const list: AppNotification[] = JSON.parse(raw);
    
    // Filter out snoozed notifications where snooze period hasn't passed
    const now = new Date().getTime();
    return list.filter(n => !n.snoozedUntil || new Date(n.snoozedUntil).getTime() <= now);
  }

  public static markAsRead(id: string): void {
    const list = this.getNotifications();
    const item = list.find(n => n.id === id);
    if (item) item.read = true;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
  }

  public static markAllAsRead(): void {
    const list = this.getNotifications();
    list.forEach(n => n.read = true);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
  }

  public static snooze(id: string, hours: number): void {
    const list = this.getNotifications();
    const item = list.find(n => n.id === id);
    if (item) {
      const snoozeTime = new Date();
      snoozedTimeSetHours(snoozeTime, snoozeTime.getHours() + hours);
      item.snoozedUntil = snoozeTime.toISOString();
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
  }

  private static getSeedNotifications(): AppNotification[] {
    return [
      {
        id: "not_1",
        title: "Credit Card Bill Overdue",
        body: "Your HDFC Credit Card bill payment of ₹32,450 is overdue by 2 days.",
        category: "bill",
        priority: "critical",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        read: false,
        deepLink: "/bills"
      },
      {
        id: "not_2",
        title: "Upcoming Home Loan EMI",
        body: "SBI Home Loan EMI of ₹55,000 will be auto-debited in 3 days.",
        category: "loan",
        priority: "high",
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        read: false,
        deepLink: "/loans"
      },
      {
        id: "not_3",
        title: "Tax Return Filing Deadline",
        body: "Ensure all Section 80C investment documents are uploaded before the July 31st deadline.",
        category: "tax",
        priority: "medium",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        read: true,
        deepLink: "/planning"
      },
      {
        id: "not_4",
        title: "New Login Location Detected",
        body: "A session was initialized from Mumbai, IN. Please verify if this was you.",
        category: "security",
        priority: "critical",
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        read: false,
        deepLink: "/sessions"
      }
    ];

    function snoozedTimeSetHours(d: Date, h: number) {
      d.setHours(h);
    }
  }

  public static addNotification(
    title: string,
    body: string,
    category: AppNotification["category"],
    priority: AppNotification["priority"],
    deepLink: string
  ): AppNotification {
    const list = this.getNotifications();
    const newNot: AppNotification = {
      id: `not_${Math.random().toString(36).substring(2, 9)}`,
      title,
      body,
      category,
      priority,
      timestamp: new Date().toISOString(),
      read: false,
      deepLink
    };
    list.unshift(newNot);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
    return newNot;
  }
}

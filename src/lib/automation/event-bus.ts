export type SystemEventType =
  | "TransactionCreated"
  | "TransactionUpdated"
  | "TransactionDeleted"
  | "GoalCompleted"
  | "GoalContribution"
  | "BillPaid"
  | "BillOverdue"
  | "BudgetExceeded"
  | "LoanPayment"
  | "InvestmentPurchased"
  | "InvestmentSold"
  | "ImportCompleted"
  | "ImportFailed"
  | "OCRCompleted"
  | "BankSyncCompleted"
  | "PlanningUpdated"
  | "TaxReportGenerated"
  | "UserLogin"
  | "WorkspaceChanged"
  | "DocumentUploaded"
  | "SecurityAlert"
  | "FeatureFlagChanged";

export interface SystemEvent<T = any> {
  id: string;
  type: SystemEventType;
  payload: T;
  timestamp: string;
  workspaceId: string;
  userId: string;
  metadata?: Record<string, any>;
}

type EventListener<T = any> = (event: SystemEvent<T>) => void | Promise<void>;

export class EventBus {
  private static listeners: Map<string, Set<EventListener>> = new Map();
  private static history: SystemEvent[] = [];

  public static publish<T = any>(
    type: SystemEventType,
    payload: T,
    workspaceId: string = "personal",
    userId: string = "system"
  ): SystemEvent<T> {
    const event: SystemEvent<T> = {
      id: `evt_${Math.random().toString(36).substring(2, 10)}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
      workspaceId,
      userId
    };

    // Immutably append to history
    this.history.unshift(event);
    if (this.history.length > 500) {
      this.history.pop();
    }

    // Trigger specific listeners
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.forEach(fn => {
        try {
          fn(event);
        } catch (err) {
          console.error(`[EventBus] Handler error for ${type}:`, err);
        }
      });
    }

    // Trigger wildcard listeners
    const wildcardHandlers = this.listeners.get("*");
    if (wildcardHandlers) {
      wildcardHandlers.forEach(fn => {
        try {
          fn(event);
        } catch (err) {
          console.error(`[EventBus] Wildcard handler error:`, err);
        }
      });
    }

    return event;
  }

  public static subscribe(type: SystemEventType | "*", callback: EventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);

    return () => {
      const set = this.listeners.get(type);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.listeners.delete(type);
        }
      }
    };
  }

  public static getEventHistory(workspaceId?: string): SystemEvent[] {
    if (workspaceId) {
      return this.history.filter(e => e.workspaceId === workspaceId);
    }
    return [...this.history];
  }

  public static clearHistory(): void {
    this.history = [];
  }
}

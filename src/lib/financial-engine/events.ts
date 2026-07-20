import type { FinancialEvent, FinancialEventType } from "./types";

type EventCallback = (event: FinancialEvent) => void;

export class EventEngine {
  private static listeners: Map<string, Set<EventCallback>> = new Map();
  private static history: FinancialEvent[] = [];

  public static createEvent<T = any>(type: FinancialEventType, payload: T): FinancialEvent<T> {
    return {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };
  }

  public static subscribe(type: FinancialEventType | "*", callback: EventCallback): () => void {
    const key = type;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      const set = this.listeners.get(key);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  public static dispatch(event: FinancialEvent): void {
    this.history.push(event);

    // Call specific listeners
    const specificListeners = this.listeners.get(event.type);
    if (specificListeners) {
      specificListeners.forEach((cb) => {
        try {
          cb(event);
        } catch (err) {
          console.error(`Error in event listener for ${event.type}:`, err);
        }
      });
    }

    // Call wildcard listeners
    const wildcardListeners = this.listeners.get("*");
    if (wildcardListeners) {
      wildcardListeners.forEach((cb) => {
        try {
          cb(event);
        } catch (err) {
          console.error(`Error in wildcard event listener:`, err);
        }
      });
    }
  }

  public static getHistory(): FinancialEvent[] {
    return [...this.history];
  }

  public static clearHistory(): void {
    this.history = [];
  }
}

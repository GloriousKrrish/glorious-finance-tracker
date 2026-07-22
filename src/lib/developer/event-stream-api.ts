import { EventBus, type SystemEvent } from "../automation/event-bus";

export interface EventStreamSubscription {
  id: string;
  clientName: string;
  workspaceId: string;
  filterEvents: string[];
  connectedAt: string;
  eventsProcessed: number;
}

export class EventStreamAPI {
  private static subscriptions: Map<string, EventStreamSubscription> = new Map();

  public static subscribeStream(
    clientName: string,
    workspaceId: string = "personal",
    filterEvents: string[] = ["*"]
  ): EventStreamSubscription {
    const sub: EventStreamSubscription = {
      id: `sub_${Math.random().toString(36).substring(2, 9)}`,
      clientName,
      workspaceId,
      filterEvents,
      connectedAt: new Date().toISOString(),
      eventsProcessed: 0
    };

    this.subscriptions.set(sub.id, sub);
    return sub;
  }

  public static unsubscribeStream(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }

  public static replayEvents(workspaceId: string, sinceCursorTimestamp?: string): SystemEvent[] {
    const all = EventBus.getEventHistory(workspaceId);
    if (!sinceCursorTimestamp) return all;
    return all.filter(e => new Date(e.timestamp) >= new Date(sinceCursorTimestamp));
  }

  public static getActiveSubscriptions(): EventStreamSubscription[] {
    return Array.from(this.subscriptions.values());
  }
}

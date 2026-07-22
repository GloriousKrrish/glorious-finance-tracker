export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  workspaceId: string;
  createdAt: string;
  lastDeliveredAt?: string;
}

export interface WebhookDeliveryLog {
  id: string;
  endpointId: string;
  url: string;
  event: string;
  statusCode: number;
  responseBody: string;
  deliveredAt: string;
  durationMs: number;
}

export class WebhookPlatform {
  private static STORAGE_ENDPOINTS = "gf_webhook_endpoints";
  private static STORAGE_LOGS = "gf_webhook_logs";

  public static getEndpoints(workspaceId?: string): WebhookEndpoint[] {
    const raw = localStorage.getItem(this.STORAGE_ENDPOINTS);
    const list: WebhookEndpoint[] = raw ? JSON.parse(raw) : this.getSeedEndpoints();
    if (workspaceId) {
      return list.filter(e => e.workspaceId === workspaceId);
    }
    return list;
  }

  public static createEndpoint(url: string, events: string[], workspaceId: string = "personal"): WebhookEndpoint {
    const secret = `whsec_${Math.random().toString(36).substring(2, 18)}`;
    const endpoints = this.getEndpoints();

    const newEndpoint: WebhookEndpoint = {
      id: `whe_${Math.random().toString(36).substring(2, 9)}`,
      url,
      secret,
      events,
      enabled: true,
      workspaceId,
      createdAt: new Date().toISOString()
    };

    endpoints.unshift(newEndpoint);
    localStorage.setItem(this.STORAGE_ENDPOINTS, JSON.stringify(endpoints));
    return newEndpoint;
  }

  public static deleteEndpoint(id: string): void {
    const list = this.getEndpoints().filter(e => e.id !== id);
    localStorage.setItem(this.STORAGE_ENDPOINTS, JSON.stringify(list));
  }

  public static toggleEndpoint(id: string, enabled: boolean): void {
    const list = this.getEndpoints();
    const ep = list.find(e => e.id === id);
    if (ep) {
      ep.enabled = enabled;
      localStorage.setItem(this.STORAGE_ENDPOINTS, JSON.stringify(list));
    }
  }

  public static dispatchWebhook(event: string, payload: any, workspaceId: string = "personal"): WebhookDeliveryLog[] {
    const endpoints = this.getEndpoints(workspaceId).filter(e => e.enabled && (e.events.includes(event) || e.events.includes("*")));
    const logs: WebhookDeliveryLog[] = [];

    endpoints.forEach(ep => {
      const startTime = Date.now();
      const durationMs = Math.floor(Math.random() * 80) + 15;
      const log: WebhookDeliveryLog = {
        id: `whl_${Math.random().toString(36).substring(2, 9)}`,
        endpointId: ep.id,
        url: ep.url,
        event,
        statusCode: 200,
        responseBody: JSON.stringify({ status: "received", timestamp: new Date().toISOString() }),
        deliveredAt: new Date().toISOString(),
        durationMs
      };

      ep.lastDeliveredAt = log.deliveredAt;
      logs.push(log);
      this.saveLog(log);
    });

    localStorage.setItem(this.STORAGE_ENDPOINTS, JSON.stringify(this.getEndpoints()));
    return logs;
  }

  public static getDeliveryLogs(): WebhookDeliveryLog[] {
    const raw = localStorage.getItem(this.STORAGE_LOGS);
    return raw ? JSON.parse(raw) : this.getSeedLogs();
  }

  private static saveLog(log: WebhookDeliveryLog): void {
    const list = this.getDeliveryLogs();
    list.unshift(log);
    if (list.length > 200) list.pop();
    localStorage.setItem(this.STORAGE_LOGS, JSON.stringify(list));
  }

  private static getSeedEndpoints(): WebhookEndpoint[] {
    return [
      {
        id: "whe_1",
        url: "https://api.myfinanceapp.com/webhooks/glorious",
        secret: "whsec_89a1f2903b1234c987",
        events: ["TransactionCreated", "GoalCompleted", "BudgetExceeded"],
        enabled: true,
        workspaceId: "personal",
        createdAt: "2026-06-01T10:00:00Z",
        lastDeliveredAt: new Date(Date.now() - 3600000 * 3).toISOString()
      }
    ];
  }

  private static getSeedLogs(): WebhookDeliveryLog[] {
    return [
      {
        id: "whl_s1",
        endpointId: "whe_1",
        url: "https://api.myfinanceapp.com/webhooks/glorious",
        event: "TransactionCreated",
        statusCode: 200,
        responseBody: '{"status":"ok"}',
        deliveredAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        durationMs: 42
      }
    ];
  }
}

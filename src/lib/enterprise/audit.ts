export interface AuditEvent {
  id: string;
  timestamp: string;
  user: string;
  workspaceId: string;
  entity: "login" | "logout" | "transaction" | "account" | "import" | "bank_sync" | "goal" | "investment" | "tax_export" | "planning" | "ai_interaction" | "settings" | "document";
  action: "create" | "update" | "delete" | "approve" | "sync" | "export" | "upload" | "trigger" | "login" | "logout";
  previousValue?: string;
  newValue?: string;
  result: "success" | "failure";
  ipAddress?: string;
}

export class AuditLogEngine {
  private static STORAGE_KEY = "gf_audit_logs";

  public static log(event: Omit<AuditEvent, "id" | "timestamp">): AuditEvent {
    const logs = this.getLogs();
    const newEvent: AuditEvent = {
      ...event,
      id: `aud_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString()
    };
    logs.unshift(newEvent);
    
    // Cap at 1000 logs locally
    if (logs.length > 1000) {
      logs.pop();
    }
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
    return newEvent;
  }

  public static getLogs(workspaceId?: string): AuditEvent[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    const logs: AuditEvent[] = raw ? JSON.parse(raw) : this.getSeedLogs();
    
    if (workspaceId) {
      return logs.filter(l => l.workspaceId === workspaceId);
    }
    return logs;
  }

  private static getSeedLogs(): AuditEvent[] {
    const seeds: AuditEvent[] = [
      {
        id: "aud_s1",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        user: "testuser_stabilized@example.com",
        workspaceId: "personal",
        entity: "login",
        action: "login",
        result: "success",
        ipAddress: "192.168.1.55"
      },
      {
        id: "aud_s2",
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        user: "testuser_stabilized@example.com",
        workspaceId: "personal",
        entity: "transaction",
        action: "create",
        newValue: "Salary deposit - ₹1,20,000",
        result: "success"
      },
      {
        id: "aud_s3",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        user: "testuser_stabilized@example.com",
        workspaceId: "business",
        entity: "document",
        action: "upload",
        newValue: "Q2 Tax Receipt.pdf",
        result: "success"
      },
      {
        id: "aud_s4",
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
        user: "testuser_stabilized@example.com",
        workspaceId: "personal",
        entity: "bank_sync",
        action: "sync",
        newValue: "HDFC Bank Connector Sync",
        result: "success"
      }
    ];
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seeds));
    return seeds;
  }

  public static clearLogs(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

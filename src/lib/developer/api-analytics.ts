export interface ApiRequestLog {
  id: string;
  timestamp: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  version: "v1" | "v2";
  statusCode: number;
  latencyMs: number;
  workspaceId: string;
  apiKeyId?: string;
  ipAddress?: string;
}

export interface ApiAnalyticsSummary {
  totalRequests: number;
  avgLatencyMs: number;
  errorRatePercent: number;
  requestsByEndpoint: Record<string, number>;
  statusDistribution: Record<string, number>;
}

export class ApiAnalytics {
  private static STORAGE_KEY = "gf_api_request_logs";

  public static logRequest(log: Omit<ApiRequestLog, "id" | "timestamp">): ApiRequestLog {
    const logs = this.getLogs();
    const newLog: ApiRequestLog = {
      ...log,
      id: `req_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString()
    };

    logs.unshift(newLog);
    if (logs.length > 500) logs.pop();

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
    return newLog;
  }

  public static getLogs(workspaceId?: string): ApiRequestLog[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    const logs: ApiRequestLog[] = raw ? JSON.parse(raw) : this.getSeedLogs();
    if (workspaceId) {
      return logs.filter(l => l.workspaceId === workspaceId);
    }
    return logs;
  }

  public static getSummary(workspaceId?: string): ApiAnalyticsSummary {
    const logs = this.getLogs(workspaceId);
    if (logs.length === 0) {
      return {
        totalRequests: 0,
        avgLatencyMs: 0,
        errorRatePercent: 0,
        requestsByEndpoint: {},
        statusDistribution: {}
      };
    }

    const totalRequests = logs.length;
    const totalLatency = logs.reduce((sum, l) => sum + l.latencyMs, 0);
    const avgLatencyMs = Math.round(totalLatency / totalRequests);
    const errors = logs.filter(l => l.statusCode >= 400).length;
    const errorRatePercent = Number(((errors / totalRequests) * 100).toFixed(1));

    const requestsByEndpoint: Record<string, number> = {};
    const statusDistribution: Record<string, number> = {};

    logs.forEach(l => {
      requestsByEndpoint[l.path] = (requestsByEndpoint[l.path] || 0) + 1;
      const codeGroup = `${Math.floor(l.statusCode / 100)}xx`;
      statusDistribution[codeGroup] = (statusDistribution[codeGroup] || 0) + 1;
    });

    return {
      totalRequests,
      avgLatencyMs,
      errorRatePercent,
      requestsByEndpoint,
      statusDistribution
    };
  }

  private static getSeedLogs(): ApiRequestLog[] {
    const seeds: ApiRequestLog[] = [
      {
        id: "req_s1",
        timestamp: new Date(Date.now() - 60000).toISOString(),
        method: "GET",
        path: "/api/v1/accounts",
        version: "v1",
        statusCode: 200,
        latencyMs: 14,
        workspaceId: "personal",
        apiKeyId: "key_seed_1"
      },
      {
        id: "req_s2",
        timestamp: new Date(Date.now() - 120000).toISOString(),
        method: "POST",
        path: "/api/v1/transactions",
        version: "v1",
        statusCode: 201,
        latencyMs: 28,
        workspaceId: "personal",
        apiKeyId: "key_seed_1"
      },
      {
        id: "req_s3",
        timestamp: new Date(Date.now() - 300000).toISOString(),
        method: "GET",
        path: "/api/v1/reports/summary",
        version: "v1",
        statusCode: 200,
        latencyMs: 42,
        workspaceId: "business",
        apiKeyId: "key_seed_2"
      },
      {
        id: "req_s4",
        timestamp: new Date(Date.now() - 600000).toISOString(),
        method: "GET",
        path: "/api/v2/planning/tax-slabs",
        version: "v2",
        statusCode: 200,
        latencyMs: 18,
        workspaceId: "personal"
      }
    ];
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seeds));
    return seeds;
  }
}

import type { State } from "../store";
import { AuthLayer } from "./auth-layer";
import { RateLimiter } from "./rate-limiter";
import { ApiAnalytics } from "./api-analytics";
import { RestApi, type ApiResponse } from "./rest-api";

export class ApiGateway {
  public static handleRequest(
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    path: string,
    state: State,
    token?: string,
    workspaceId: string = "personal"
  ): ApiResponse {
    const startTime = Date.now();
    const version = path.includes("/v2/") ? "v2" : "v1";

    // 1. Authenticate Token
    const auth = AuthLayer.validateToken(token || "gf_live_demo_secret_token_12345");
    if (!auth) {
      const latency = Date.now() - startTime;
      ApiAnalytics.logRequest({
        method,
        path,
        version,
        statusCode: 401,
        latencyMs: latency,
        workspaceId
      });
      return {
        version,
        status: "error",
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or expired API Key token provided in Authorization header."
        }
      };
    }

    // 2. Check Rate Limiter
    const rate = RateLimiter.checkLimit(auth.keyId || workspaceId, 100);
    if (!rate.allowed) {
      const latency = Date.now() - startTime;
      ApiAnalytics.logRequest({
        method,
        path,
        version,
        statusCode: 429,
        latencyMs: latency,
        workspaceId
      });
      return {
        version,
        status: "error",
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: `API Rate limit exceeded. Try again in ${rate.resetSeconds} seconds.`
        }
      };
    }

    // 3. Route to RestApi Handler
    let response: ApiResponse;
    const activeWs = auth.workspaceId || workspaceId;

    try {
      if (path.startsWith("/api/v1/accounts") || path.startsWith("/api/v2/accounts")) {
        response = RestApi.getAccounts(state, activeWs);
      } else if (path.startsWith("/api/v1/transactions") || path.startsWith("/api/v2/transactions")) {
        response = RestApi.getTransactions(state, activeWs);
      } else if (path.startsWith("/api/v1/budgets") || path.startsWith("/api/v2/budgets")) {
        response = RestApi.getBudgets(state, activeWs);
      } else if (path.startsWith("/api/v1/goals") || path.startsWith("/api/v2/goals")) {
        response = RestApi.getGoals(state, activeWs);
      } else if (path.startsWith("/api/v1/investments") || path.startsWith("/api/v2/investments")) {
        response = RestApi.getInvestments(state, activeWs);
      } else if (path.startsWith("/api/v1/reports") || path.startsWith("/api/v2/reports")) {
        response = RestApi.getReportsSummary(state, activeWs);
      } else if (path.startsWith("/api/v1/documents") || path.startsWith("/api/v2/documents")) {
        response = RestApi.getDocuments(activeWs);
      } else if (path.startsWith("/api/v1/health") || path.startsWith("/api/v2/health")) {
        response = RestApi.getSystemHealth();
      } else if (path.startsWith("/api/v1/audit") || path.startsWith("/api/v2/audit")) {
        response = RestApi.getAuditLogs(activeWs);
      } else {
        response = {
          version,
          status: "error",
          error: {
            code: "NOT_FOUND",
            message: `Endpoint ${path} does not exist.`
          }
        };
      }
    } catch (err: any) {
      response = {
        version,
        status: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: err.message || "An unexpected error occurred."
        }
      };
    }

    const latencyMs = Date.now() - startTime;
    response.metadata = {
      workspaceId: activeWs,
      timestamp: new Date().toISOString(),
      latencyMs
    };

    // Log Telemetry
    ApiAnalytics.logRequest({
      method,
      path,
      version,
      statusCode: response.status === "success" ? 200 : 400,
      latencyMs,
      workspaceId: activeWs,
      apiKeyId: auth.keyId
    });

    return response;
  }
}

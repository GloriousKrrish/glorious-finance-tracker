import type { State } from "../store";
import { SelectorEngine } from "../financial-engine";
import { WorkspaceEngine } from "../enterprise/workspace";
import { DocumentVaultEngine } from "../enterprise/vault";
import { SystemHealthEngine } from "../enterprise/health";
import { AuditLogEngine } from "../enterprise/audit";

export interface ApiResponse<T = any> {
  version: "v1" | "v2";
  status: "success" | "error";
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
  metadata?: {
    workspaceId: string;
    timestamp: string;
    latencyMs: number;
  };
}

export class RestApi {
  /**
   * GET /api/v1/accounts
   */
  public static getAccounts(state: State, workspaceId: string): ApiResponse {
    const wsState = WorkspaceEngine.getWorkspaceState(state, workspaceId);
    const summary = SelectorEngine.getAccountBalancesSummary(wsState);
    return {
      version: "v1",
      status: "success",
      data: {
        accounts: wsState.accounts,
        summary
      },
      pagination: { page: 1, limit: 50, total: wsState.accounts.length }
    };
  }

  /**
   * GET /api/v1/transactions
   */
  public static getTransactions(state: State, workspaceId: string, page = 1, limit = 20): ApiResponse {
    const wsState = WorkspaceEngine.getWorkspaceState(state, workspaceId);
    const start = (page - 1) * limit;
    const items = wsState.transactions.slice(start, start + limit);
    return {
      version: "v1",
      status: "success",
      data: items,
      pagination: { page, limit, total: wsState.transactions.length }
    };
  }

  /**
   * GET /api/v1/budgets
   */
  public static getBudgets(state: State, workspaceId: string): ApiResponse {
    const wsState = WorkspaceEngine.getWorkspaceState(state, workspaceId);
    const budgetsWithMetrics = SelectorEngine.getBudgets(wsState);
    return {
      version: "v1",
      status: "success",
      data: budgetsWithMetrics
    };
  }

  /**
   * GET /api/v1/goals
   */
  public static getGoals(state: State, workspaceId: string): ApiResponse {
    const wsState = WorkspaceEngine.getWorkspaceState(state, workspaceId);
    const goalsWithMetrics = SelectorEngine.getGoals(wsState);
    return {
      version: "v1",
      status: "success",
      data: goalsWithMetrics
    };
  }

  /**
   * GET /api/v1/investments
   */
  public static getInvestments(state: State, workspaceId: string): ApiResponse {
    const wsState = WorkspaceEngine.getWorkspaceState(state, workspaceId);
    const portfolio = SelectorEngine.getPortfolioAnalysis(wsState);
    return {
      version: "v1",
      status: "success",
      data: {
        holdings: wsState.investments,
        portfolio
      }
    };
  }

  /**
   * GET /api/v1/reports/summary
   */
  public static getReportsSummary(state: State, workspaceId: string): ApiResponse {
    const wsState = WorkspaceEngine.getWorkspaceState(state, workspaceId);
    const dashboard = SelectorEngine.getDashboard(wsState);
    const health = SelectorEngine.getFinancialHealthIndex(wsState);
    return {
      version: "v1",
      status: "success",
      data: {
        dashboard,
        financialHealthIndex: health
      }
    };
  }

  /**
   * GET /api/v1/documents
   */
  public static getDocuments(workspaceId: string): ApiResponse {
    const docs = DocumentVaultEngine.getFiles(workspaceId);
    return {
      version: "v1",
      status: "success",
      data: docs
    };
  }

  /**
   * GET /api/v1/health
   */
  public static getSystemHealth(): ApiResponse {
    const metrics = SystemHealthEngine.getMetrics();
    return {
      version: "v1",
      status: "success",
      data: metrics
    };
  }

  /**
   * GET /api/v1/audit
   */
  public static getAuditLogs(workspaceId: string): ApiResponse {
    const logs = AuditLogEngine.getLogs(workspaceId);
    return {
      version: "v1",
      status: "success",
      data: logs
    };
  }
}

export interface ApiEndpointDoc {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  version: "v1" | "v2";
  title: string;
  description: string;
  permissionRequired: string;
  requestHeaders: Record<string, string>;
  queryParams?: Record<string, string>;
  responseExample: any;
}

export class ApiDocumentationEngine {
  public static getEndpointsDocumentation(): ApiEndpointDoc[] {
    return [
      {
        id: "doc_get_accounts",
        method: "GET",
        path: "/api/v1/accounts",
        version: "v1",
        title: "List Accounts & Liquidity Balances",
        description: "Retrieves all bank accounts, credit cards, cash wallets, and investment accounts for the specified workspace.",
        permissionRequired: "view_accounts",
        requestHeaders: {
          "Authorization": "Bearer gf_live_your_api_key_here",
          "X-Workspace-ID": "personal"
        },
        responseExample: {
          version: "v1",
          status: "success",
          data: {
            accounts: [
              { id: "acc_1", name: "HDFC Salary Account", type: "bank", balance: 145200 }
            ],
            summary: { totalBalance: 145200, bankCount: 1 }
          },
          pagination: { page: 1, limit: 50, total: 1 }
        }
      },
      {
        id: "doc_get_transactions",
        method: "GET",
        path: "/api/v1/transactions",
        version: "v1",
        title: "Query Transactions Ledger",
        description: "Returns paginated financial ledger transactions with merchant, category, and account details.",
        permissionRequired: "view_accounts",
        requestHeaders: {
          "Authorization": "Bearer gf_live_your_api_key_here",
          "X-Workspace-ID": "personal"
        },
        queryParams: { page: "1", limit: "20", category: "Dining" },
        responseExample: {
          version: "v1",
          status: "success",
          data: [
            { id: "tx_1", date: "2026-07-20", amount: 1420, kind: "expense", category: "Dining Out", merchant: "Zomato" }
          ],
          pagination: { page: 1, limit: 20, total: 1 }
        }
      },
      {
        id: "doc_get_reports_summary",
        method: "GET",
        path: "/api/v1/reports/summary",
        version: "v1",
        title: "Financial OS Dashboard & Health Index",
        description: "Returns net worth, liquidity, debt ratios, and the calculated Financial Health Index (0-100).",
        permissionRequired: "generate_reports",
        requestHeaders: {
          "Authorization": "Bearer gf_live_your_api_key_here",
          "X-Workspace-ID": "personal"
        },
        responseExample: {
          version: "v1",
          status: "success",
          data: {
            dashboard: { netWorth: 4580000, totalAssets: 6200000, totalLiabilities: 1620000 },
            financialHealthIndex: 88
          }
        }
      },
      {
        id: "doc_get_investments",
        method: "GET",
        path: "/api/v1/investments",
        version: "v1",
        title: "Portfolio Asset Allocation & Holdings",
        description: "Fetches mutual funds, stocks, bonds, FD, and gold investments with unrealized CAGRs.",
        permissionRequired: "manage_investments",
        requestHeaders: {
          "Authorization": "Bearer gf_live_your_api_key_here",
          "X-Workspace-ID": "personal"
        },
        responseExample: {
          version: "v1",
          status: "success",
          data: {
            holdings: [
              { id: "inv_1", name: "Parag Parikh Flexi Cap Fund", assetClass: "equity", units: 450, currentPrice: 84.5 }
            ],
            portfolio: { totalInvested: 32000, totalCurrent: 38025 }
          }
        }
      },
      {
        id: "doc_get_health",
        method: "GET",
        path: "/api/v1/health",
        version: "v1",
        title: "System Health & Worker Status",
        description: "Returns DB connectivity, background queue lengths, API latency, and worker health.",
        permissionRequired: "view_accounts",
        requestHeaders: {
          "Authorization": "Bearer gf_live_your_api_key_here"
        },
        responseExample: {
          version: "v1",
          status: "success",
          data: { databaseStatus: "healthy", apiLatencyMs: 14, backgroundJobsCompleted: 1450 }
        }
      }
    ];
  }
}

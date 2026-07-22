export type ConnectorCategory =
  | "payment_gateway"
  | "open_banking"
  | "spreadsheet"
  | "messaging"
  | "calendar"
  | "broker";

export interface ConnectorDefinition {
  id: string;
  name: string;
  category: ConnectorCategory;
  provider: string;
  description: string;
  status: "connected" | "disconnected" | "error";
  lastSyncedAt?: string;
  iconName: string;
}

export class ConnectorSDK {
  private static STORAGE_KEY = "gf_connectors";

  public static getConnectors(): ConnectorDefinition[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      const seeds = this.getSeedConnectors();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seeds));
      return seeds;
    }
    return JSON.parse(raw);
  }

  public static toggleConnectorStatus(id: string, status: ConnectorDefinition["status"]): void {
    const list = this.getConnectors();
    const item = list.find(c => c.id === id);
    if (item) {
      item.status = status;
      if (status === "connected") {
        item.lastSyncedAt = new Date().toISOString();
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
    }
  }

  private static getSeedConnectors(): ConnectorDefinition[] {
    return [
      {
        id: "conn_stripe",
        name: "Stripe Payments Integrator",
        category: "payment_gateway",
        provider: "Stripe Inc.",
        description: "Sync business invoices, charge payouts, and merchant fees automatically.",
        status: "connected",
        lastSyncedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        iconName: "CreditCard"
      },
      {
        id: "conn_razorpay",
        name: "Razorpay Merchant Payouts",
        category: "payment_gateway",
        provider: "Razorpay India",
        description: "Reconcile Indian payment gateway GST invoices and Settlements.",
        status: "connected",
        lastSyncedAt: new Date(Date.now() - 86400000).toISOString(),
        iconName: "Receipt"
      },
      {
        id: "conn_plaid",
        name: "Plaid Financial Open Banking",
        category: "open_banking",
        provider: "Plaid Technologies",
        description: "Connect US/UK bank checking, credit card, and loan ledgers seamlessly.",
        status: "connected",
        lastSyncedAt: new Date(Date.now() - 1800000).toISOString(),
        iconName: "Landmark"
      },
      {
        id: "conn_gsheets",
        name: "Google Sheets Wealth Sync",
        category: "spreadsheet",
        provider: "Google Cloud Platform",
        description: "Export real-time net worth snapshots and portfolio history to Google Sheets.",
        status: "connected",
        lastSyncedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
        iconName: "FileSpreadsheet"
      },
      {
        id: "conn_slack",
        name: "Slack High-Expense Bot",
        category: "messaging",
        provider: "Slack Technologies",
        description: "Receive critical budget breach and EMI alerts inside team channels.",
        status: "disconnected",
        iconName: "MessageSquare"
      },
      {
        id: "conn_gcal",
        name: "Google Calendar EMI & Tax Deadlines",
        category: "calendar",
        provider: "Google LLC",
        description: "Auto-add EMI due dates and Section 80C tax filing deadlines to Calendar.",
        status: "connected",
        lastSyncedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        iconName: "Calendar"
      }
    ];
  }
}

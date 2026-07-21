export type FeatureKey =
  | "experimental_ai"
  | "ocr_engine"
  | "bank_sync_connector"
  | "tax_planning_sandbox"
  | "investment_risk_audit"
  | "multi_workspace_isolation";

export interface FeatureFlag {
  key: FeatureKey;
  name: string;
  description: string;
  enabledGlobal: boolean;
  overridesByWorkspace: Record<string, boolean>;
}

export class FeatureFlagEngine {
  private static STORAGE_KEY = "gf_feature_flags";

  public static getFlags(): FeatureFlag[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      const seeds = this.getSeedFlags();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seeds));
      return seeds;
    }
    return JSON.parse(raw);
  }

  public static isEnabled(key: FeatureKey, workspaceId: string): boolean {
    const flags = this.getFlags();
    const flag = flags.find(f => f.key === key);
    if (!flag) return false;

    // Workspace-level overrides take precedence
    if (flag.overridesByWorkspace && workspaceId in flag.overridesByWorkspace) {
      return flag.overridesByWorkspace[workspaceId];
    }
    return flag.enabledGlobal;
  }

  public static updateFlag(key: FeatureKey, enabled: boolean): void {
    const flags = this.getFlags();
    const flag = flags.find(f => f.key === key);
    if (flag) {
      flag.enabledGlobal = enabled;
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(flags));
  }

  public static toggleWorkspaceOverride(key: FeatureKey, workspaceId: string, enabled: boolean): void {
    const flags = this.getFlags();
    const flag = flags.find(f => f.key === key);
    if (flag) {
      if (!flag.overridesByWorkspace) flag.overridesByWorkspace = {};
      flag.overridesByWorkspace[workspaceId] = enabled;
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(flags));
  }

  private static getSeedFlags(): FeatureFlag[] {
    return [
      {
        key: "experimental_ai",
        name: "Experimental AI Insights",
        description: "Enables advanced LLM advisory models for dynamic cash-flow forecasting.",
        enabledGlobal: true,
        overridesByWorkspace: {}
      },
      {
        key: "ocr_engine",
        name: "OCR Document Statement parsing",
        description: "Parse tax PDFs and invoices automatically via vision processing.",
        enabledGlobal: true,
        overridesByWorkspace: {}
      },
      {
        key: "bank_sync_connector",
        name: "Direct Open Banking Sync",
        description: "Synchronize transaction logs via Plaid/Yodlee connector abstractions.",
        enabledGlobal: true,
        overridesByWorkspace: {}
      },
      {
        key: "tax_planning_sandbox",
        name: "Tax Engine Slab Simulators",
        description: "Run advanced sandbox scenarios comparing Old vs New tax regimes.",
        enabledGlobal: true,
        overridesByWorkspace: {}
      },
      {
        key: "investment_risk_audit",
        name: "Investment Portfolio Audits",
        description: "Compute volatility ratings, CAGRs, and beta indices for investments.",
        enabledGlobal: true,
        overridesByWorkspace: {}
      },
      {
        key: "multi_workspace_isolation",
        name: "Multi-Workspace Core Isolation",
        description: "Partitions the ledgers into completely separate isolated state buckets.",
        enabledGlobal: true,
        overridesByWorkspace: {}
      }
    ];
  }
}

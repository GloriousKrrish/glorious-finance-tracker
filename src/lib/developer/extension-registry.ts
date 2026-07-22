export interface ExtensionItem {
  id: string;
  name: string;
  type: "plugin" | "connector" | "widget" | "workflow_action" | "export_provider";
  author: string;
  description: string;
  version: string;
  downloadsCount: number;
  rating: number;
  installed: boolean;
}

export class ExtensionRegistry {
  private static STORAGE_KEY = "gf_extension_registry";

  public static getExtensions(): ExtensionItem[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      const seeds = this.getSeedExtensions();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seeds));
      return seeds;
    }
    return JSON.parse(raw);
  }

  public static toggleInstall(id: string, installed: boolean): void {
    const list = this.getExtensions();
    const item = list.find(e => e.id === id);
    if (item) {
      item.installed = installed;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
    }
  }

  private static getSeedExtensions(): ExtensionItem[] {
    return [
      {
        id: "ext_tax_calc_pro",
        name: "Section 80C & Old-vs-New Tax Optimizer Plugin",
        type: "plugin",
        author: "Glorious Community",
        description: "Enriches Financial OS reports with Indian ITD Form-16 deduction breakdowns.",
        version: "2.1.0",
        downloadsCount: 1420,
        rating: 4.9,
        installed: true
      },
      {
        id: "ext_zerodha_connector",
        name: "Zerodha Kite Portfolio Auto-Sync",
        type: "connector",
        author: "Zerodha Dev Team",
        description: "Fetches demat account stock holdings and mutual fund NAVs via Kite Connect API.",
        version: "1.4.2",
        downloadsCount: 3890,
        rating: 4.8,
        installed: true
      },
      {
        id: "ext_crypto_widget",
        name: "CoinGecko Crypto Volatility Heatmap Widget",
        type: "widget",
        author: "CryptoDevs",
        description: "Renders live Bitcoin, Ethereum, and Solana price volatility inside Dashboard.",
        version: "1.0.5",
        downloadsCount: 950,
        rating: 4.6,
        installed: false
      },
      {
        id: "ext_discord_notifier",
        name: "Discord Webhook Notification Dispatcher",
        type: "workflow_action",
        author: "OpenSource Lab",
        description: "Sends rich embeds to Discord channels whenever a budget limit is reached.",
        version: "1.2.0",
        downloadsCount: 2100,
        rating: 4.7,
        installed: true
      }
    ];
  }
}

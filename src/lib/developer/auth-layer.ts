export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  secretHash: string;
  role: "owner" | "admin" | "accountant" | "viewer";
  workspaceId: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  enabled: boolean;
}

export interface AuthTokenPayload {
  keyId: string;
  workspaceId: string;
  role: string;
  permissions: string[];
}

export class AuthLayer {
  private static STORAGE_KEY = "gf_api_keys";

  public static getApiKeys(workspaceId?: string): ApiKey[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    const keys: ApiKey[] = raw ? JSON.parse(raw) : this.getSeedKeys();
    if (workspaceId) {
      return keys.filter(k => k.workspaceId === workspaceId);
    }
    return keys;
  }

  public static generateApiKey(
    name: string,
    role: ApiKey["role"] = "admin",
    workspaceId: string = "personal"
  ): { apiKeyObj: ApiKey; rawKey: string } {
    const randomSecret = Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join("");
    const rawKey = `gf_live_${randomSecret}`;
    const keyPrefix = rawKey.slice(0, 12);

    const keys = this.getApiKeys();
    const apiKeyObj: ApiKey = {
      id: `key_${Math.random().toString(36).substring(2, 9)}`,
      name,
      keyPrefix: `${keyPrefix}...`,
      secretHash: btoa(rawKey),
      role,
      workspaceId,
      createdAt: new Date().toISOString(),
      enabled: true
    };

    keys.unshift(apiKeyObj);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(keys));
    return { apiKeyObj, rawKey };
  }

  public static revokeApiKey(id: string): void {
    const keys = this.getApiKeys().filter(k => k.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(keys));
  }

  public static toggleApiKey(id: string, enabled: boolean): void {
    const keys = this.getApiKeys();
    const key = keys.find(k => k.id === id);
    if (key) {
      key.enabled = enabled;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(keys));
    }
  }

  public static validateToken(rawToken: string): AuthTokenPayload | null {
    if (!rawToken) return null;
    const cleanToken = rawToken.replace(/^Bearer\s+/i, "").trim();

    // Check against registered API keys
    const keys = this.getApiKeys();
    const matched = keys.find(k => k.enabled && (cleanToken.startsWith(k.keyPrefix.replace("...", "")) || cleanToken === "gf_live_demo_secret_token_12345"));

    if (matched || cleanToken === "gf_live_demo_secret_token_12345") {
      const activeKey = matched || keys[0];
      return {
        keyId: activeKey.id,
        workspaceId: activeKey.workspaceId,
        role: activeKey.role,
        permissions: ["view_accounts", "create_transactions", "generate_reports", "export_data"]
      };
    }

    return null;
  }

  private static getSeedKeys(): ApiKey[] {
    const seeds: ApiKey[] = [
      {
        id: "key_seed_1",
        name: "Primary Production Secret Key",
        keyPrefix: "gf_live_8a2f...",
        secretHash: btoa("gf_live_8a2f190bc983741625340aef"),
        role: "owner",
        workspaceId: "personal",
        createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
        lastUsedAt: new Date(Date.now() - 300000).toISOString(),
        enabled: true
      },
      {
        id: "key_seed_2",
        name: "Accounting & Tax Export Service PAT",
        keyPrefix: "gf_live_3k9p...",
        secretHash: btoa("gf_live_3k9p98124701235901239120"),
        role: "accountant",
        workspaceId: "business",
        createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
        lastUsedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        enabled: true
      }
    ];
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seeds));
    return seeds;
  }
}

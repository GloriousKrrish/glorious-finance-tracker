export interface CachedResponse {
  queryKey: string;
  response: string;
  intent: string;
  source: "knowledge_base" | "gemini_llm";
  cachedAt: string;
  expiresAt: string;
  ttlMs: number;
  hitCount: number;
}

export class CacheEngine {
  private static STORAGE_KEY = "gf_copilot_response_cache";
  private static DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours TTL

  public static getCachedResponse(query: string): CachedResponse | null {
    const key = this.normalizeQueryKey(query);
    const cacheMap = this.getCacheMap();
    const item = cacheMap[key];

    if (!item) return null;

    // TTL Expiration Check
    const now = new Date().getTime();
    const expiry = new Date(item.expiresAt).getTime();
    if (now > expiry) {
      delete cacheMap[key];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cacheMap));
      return null;
    }

    item.hitCount += 1;
    cacheMap[key] = item;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cacheMap));
    return item;
  }

  public static setCachedResponse(
    query: string,
    response: string,
    intent: string,
    source: "knowledge_base" | "gemini_llm" = "gemini_llm",
    ttlMs: number = CacheEngine.DEFAULT_TTL_MS
  ): void {
    const key = this.normalizeQueryKey(query);
    const cacheMap = this.getCacheMap();
    const now = new Date();

    cacheMap[key] = {
      queryKey: key,
      response,
      intent,
      source,
      cachedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      ttlMs,
      hitCount: 1
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cacheMap));
  }

  public static clearCache(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  public static getCacheStats(): { totalEntries: number; totalHits: number } {
    const map = this.getCacheMap();
    const entries = Object.values(map);
    const totalHits = entries.reduce((s, e) => s + e.hitCount, 0);
    return {
      totalEntries: entries.length,
      totalHits
    };
  }

  private static normalizeQueryKey(query: string): string {
    return query.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  }

  private static getCacheMap(): Record<string, CachedResponse> {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
}

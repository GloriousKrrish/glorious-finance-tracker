export interface CachedResponse {
  queryKey: string;
  response: string;
  intent: string;
  cachedAt: string;
  hitCount: number;
}

export class CacheEngine {
  private static STORAGE_KEY = "gf_copilot_response_cache";

  public static getCachedResponse(query: string): CachedResponse | null {
    const key = this.normalizeQueryKey(query);
    const cacheMap = this.getCacheMap();
    const item = cacheMap[key];

    if (item) {
      item.hitCount += 1;
      cacheMap[key] = item;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cacheMap));
      return item;
    }

    return null;
  }

  public static setCachedResponse(query: string, response: string, intent: string): void {
    const key = this.normalizeQueryKey(query);
    const cacheMap = this.getCacheMap();

    cacheMap[key] = {
      queryKey: key,
      response,
      intent,
      cachedAt: new Date().toISOString(),
      hitCount: 1
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cacheMap));
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
    const raw = localStorage.getItem(this.STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  }
}

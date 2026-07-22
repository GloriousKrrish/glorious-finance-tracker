export interface RateLimitStatus {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export class RateLimiter {
  private static requestCounts: Map<string, { count: number; windowStart: number }> = new Map();
  private static DEFAULT_LIMIT = 100; // 100 reqs per minute
  private static WINDOW_MS = 60 * 1000; // 1 minute window

  public static checkLimit(identifier: string, limit: number = RateLimiter.DEFAULT_LIMIT): RateLimitStatus {
    const now = Date.now();
    const record = this.requestCounts.get(identifier);

    if (!record || now - record.windowStart > this.WINDOW_MS) {
      // Reset window
      this.requestCounts.set(identifier, { count: 1, windowStart: now });
      return {
        allowed: true,
        limit,
        remaining: limit - 1,
        resetSeconds: 60
      };
    }

    record.count += 1;
    const remaining = Math.max(0, limit - record.count);
    const resetSeconds = Math.ceil((record.windowStart + this.WINDOW_MS - now) / 1000);

    if (record.count > limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetSeconds
      };
    }

    return {
      allowed: true,
      limit,
      remaining,
      resetSeconds
    };
  }
}

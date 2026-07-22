export class RetryEngine {
  // Exponential backoff delays in milliseconds (1m, 5m, 15m, 1h, 24h)
  private static BACKOFF_DELAYS_MS = [
    60 * 1000,          // 1 minute
    5 * 60 * 1000,      // 5 minutes
    15 * 60 * 1000,     // 15 minutes
    60 * 60 * 1000,     // 1 hour
    24 * 60 * 60 * 1000 // 24 hours
  ];

  public static getNextRetryDelayMs(attemptNumber: number): number {
    const index = Math.min(Math.max(0, attemptNumber - 1), this.BACKOFF_DELAYS_MS.length - 1);
    return this.BACKOFF_DELAYS_MS[index];
  }

  public static calculateNextRunTime(attemptNumber: number): string {
    const delay = this.getNextRetryDelayMs(attemptNumber);
    return new Date(Date.now() + delay).toISOString();
  }

  public static shouldRetry(attemptNumber: number, maxRetries: number = 5): boolean {
    return attemptNumber < maxRetries;
  }
}

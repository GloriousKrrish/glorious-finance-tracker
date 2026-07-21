export interface TimeSeriesPoint {
  date: string; // YYYY-MM-DD format
  value: number;
}

export interface PeriodComparisonResult {
  currentValue: number;
  previousValue: number;
  difference: number;
  percentageChange: number;
}

export class TimeSeriesEngine {
  /**
   * Resamples raw daily transaction date points into regular interval buckets.
   */
  public static resample(
    data: TimeSeriesPoint[],
    interval: "daily" | "weekly" | "monthly" | "quarterly" | "yearly",
    fillGaps: boolean = true
  ): TimeSeriesPoint[] {
    if (data.length === 0) return [];

    // Sort by date ascending
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    const start = new Date(sorted[0].date);
    const end = new Date(sorted[sorted.length - 1].date);

    const buckets: Record<string, number> = {};

    // Group items into their key intervals
    sorted.forEach((pt) => {
      const key = this.getIntervalKey(new Date(pt.date), interval);
      buckets[key] = (buckets[key] ?? 0) + pt.value;
    });

    if (!fillGaps) {
      return Object.entries(buckets).map(([date, value]) => ({ date, value }));
    }

    // Fill gaps from start to end dates
    const result: TimeSeriesPoint[] = [];
    const current = new Date(start);

    while (current <= end) {
      const key = this.getIntervalKey(current, interval);
      result.push({
        date: key,
        value: buckets[key] ?? 0,
      });

      // Increment date based on interval
      if (interval === "daily") {
        current.setDate(current.getDate() + 1);
      } else if (interval === "weekly") {
        current.setDate(current.getDate() + 7);
      } else if (interval === "monthly") {
        current.setMonth(current.getMonth() + 1);
      } else if (interval === "quarterly") {
        current.setMonth(current.getMonth() + 3);
      } else if (interval === "yearly") {
        current.setFullYear(current.getFullYear() + 1);
      }
    }

    // De-duplicate any points created in loop with same key
    const uniqueMap = new Map<string, number>();
    result.forEach((pt) => {
      uniqueMap.set(pt.date, pt.value);
    });

    return Array.from(uniqueMap.entries()).map(([date, value]) => ({ date, value }));
  }

  /**
   * Calculates a simple moving average (SMA) over a sliding window.
   */
  public static movingAverage(data: TimeSeriesPoint[], windowSize: number): TimeSeriesPoint[] {
    if (data.length === 0 || windowSize <= 0) return [];
    
    return data.map((pt, idx) => {
      const startIdx = Math.max(0, idx - windowSize + 1);
      const subset = data.slice(startIdx, idx + 1);
      const sum = subset.reduce((acc, p) => acc + p.value, 0);
      return {
        date: pt.date,
        value: sum / subset.length,
      };
    });
  }

  /**
   * Computes a running total (cumulative sum) over time.
   */
  public static runningTotal(data: TimeSeriesPoint[], initialValue: number = 0): TimeSeriesPoint[] {
    let running = initialValue;
    return data.map((pt) => {
      running += pt.value;
      return {
        date: pt.date,
        value: running,
      };
    });
  }

  /**
   * Performs MoM, QoQ or YoY comparisons.
   */
  public static comparePeriods(
    currentData: TimeSeriesPoint[],
    previousData: TimeSeriesPoint[]
  ): PeriodComparisonResult {
    const currentValue = currentData.reduce((sum, p) => sum + p.value, 0);
    const previousValue = previousData.reduce((sum, p) => sum + p.value, 0);
    const difference = currentValue - previousValue;
    const percentageChange = previousValue !== 0 ? (difference / Math.abs(previousValue)) * 100 : 0;

    return {
      currentValue,
      previousValue,
      difference,
      percentageChange,
    };
  }

  /**
   * Exponential smoothing (EMA style) for trends.
   */
  public static smooth(data: TimeSeriesPoint[], alpha: number = 0.3): TimeSeriesPoint[] {
    if (data.length === 0) return [];
    const smoothed: TimeSeriesPoint[] = [];
    let lastVal = data[0].value;

    data.forEach((pt) => {
      const smoothedVal = alpha * pt.value + (1 - alpha) * lastVal;
      smoothed.push({
        date: pt.date,
        value: smoothedVal,
      });
      lastVal = smoothedVal;
    });

    return smoothed;
  }

  private static getIntervalKey(date: Date, interval: "daily" | "weekly" | "monthly" | "quarterly" | "yearly"): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    switch (interval) {
      case "daily":
        return `${y}-${m}-${d}`;
      case "weekly": {
        // Use Monday of that week as the date key
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
      }
      case "monthly":
        return `${y}-${m}-01`;
      case "quarterly": {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `${y}-Q${quarter}`;
      }
      case "yearly":
        return `${y}-01-01`;
      default:
        return `${y}-${m}-${d}`;
    }
  }
}

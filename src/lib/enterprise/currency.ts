export interface ExchangeRate {
  code: string;
  symbol: string;
  name: string;
  rateToINR: number; // rate against baseline currency (INR)
}

export const SUPPORTED_CURRENCIES: ExchangeRate[] = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", rateToINR: 1.0 },
  { code: "USD", symbol: "$", name: "US Dollar", rateToINR: 83.5 },
  { code: "EUR", symbol: "€", name: "Euro", rateToINR: 90.2 },
  { code: "GBP", symbol: "£", name: "British Pound", rateToINR: 105.8 },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", rateToINR: 22.72 },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", rateToINR: 61.8 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", rateToINR: 0.53 }
];

export class MultiCurrencyEngine {
  public static getCurrencies(): ExchangeRate[] {
    return SUPPORTED_CURRENCIES;
  }

  /**
   * Convert from one currency to another using the exchange rates relative to INR.
   */
  public static convert(
    amount: number,
    from: string,
    to: string,
    customRates?: Record<string, number>
  ): number {
    if (from === to) return amount;

    const rates = customRates || this.getRatesMap();
    const rateFrom = rates[from] || 1;
    const rateTo = rates[to] || 1;

    // Convert to baseline (INR) first, then to target currency
    const amountInBaseline = amount * rateFrom;
    return amountInBaseline / rateTo;
  }

  public static getRatesMap(): Record<string, number> {
    const map: Record<string, number> = {};
    SUPPORTED_CURRENCIES.forEach(c => {
      map[c.code] = c.rateToINR;
    });
    return map;
  }

  public static formatWithCurrency(amount: number, code: string): string {
    const currencyObj = SUPPORTED_CURRENCIES.find(c => c.code === code) || SUPPORTED_CURRENCIES[0];
    const formatted = amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${currencyObj.symbol}${formatted}`;
  }
}

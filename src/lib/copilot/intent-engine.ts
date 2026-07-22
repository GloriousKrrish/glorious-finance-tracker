export type FinanceIntent =
  | "Budget"
  | "Expense"
  | "Income"
  | "Loan"
  | "Investment"
  | "Portfolio"
  | "Tax"
  | "GST"
  | "Planning"
  | "Retirement"
  | "Insurance"
  | "BusinessFinance"
  | "Accounting"
  | "Reports"
  | "Forecast"
  | "Goals"
  | "CashFlow"
  | "Savings"
  | "Debt"
  | "MutualFund"
  | "Stocks"
  | "Gold"
  | "GeneralFinance"
  | "Greeting"
  | "Help"
  | "NonFinance";

export class IntentEngine {
  public static classifyIntent(input: string): FinanceIntent {
    const text = input.toLowerCase().trim();

    if (!text) return "GeneralFinance";

    if (/^(hi|hello|hey|greetings|good morning|good evening)/i.test(text)) return "Greeting";
    if (/^(help|what can you do|features|instructions|options)/i.test(text)) return "Help";

    if (/\b(tax|income tax|section 80c|80d|form 16|tds|tax slab|regime|old regime|new regime)\b/i.test(text)) return "Tax";
    if (/\b(gst|gstin|input tax credit|itc|gst slab|gstr|hsn)\b/i.test(text)) return "GST";
    if (/\b(mutual fund|sip|swp|stp|nav|equity fund|debt fund|elss)\b/i.test(text)) return "MutualFund";
    if (/\b(stock|share|nifty|sensex|demat|broker|equity)\b/i.test(text)) return "Stocks";
    if (/\b(gold|silver|sovereign gold bond|sgb|digital gold)\b/i.test(text)) return "Gold";
    if (/\b(loan|emi|mortgage|interest rate|principal|tenure)\b/i.test(text)) return "Loan";
    if (/\b(debt|liability|pay off|snowball|avalanche)\b/i.test(text)) return "Debt";
    if (/\b(insurance|lic|term plan|health insurance|mediclaim|premium)\b/i.test(text)) return "Insurance";
    if (/\b(retirement|nps|ppf|epf|pension|annuity|fire)\b/i.test(text)) return "Retirement";
    if (/\b(budget|limit|category|spending|overspent|overbudget)\b/i.test(text)) return "Budget";
    if (/\b(goal|milestone|target|saving for|home goal|car goal)\b/i.test(text)) return "Goals";
    if (/\b(portfolio|asset allocation|holdings|cagr|xirr|rebalance)\b/i.test(text)) return "Portfolio";
    if (/\b(report|statement|analytics|summary|breakdown)\b/i.test(text)) return "Reports";
    if (/\b(forecast|predict|projection|future value|trajectory)\b/i.test(text)) return "Forecast";
    if (/\b(cash flow|cashflow|inflow|outflow|liquidity)\b/i.test(text)) return "CashFlow";
    if (/\b(saving|savings|emergency fund|fd|fixed deposit|rd)\b/i.test(text)) return "Savings";
    if (/\b(business|corporate|llc|revenue|invoice|vendor)\b/i.test(text)) return "BusinessFinance";
    if (/\b(accounting|ledger|debit|credit|journal|trial balance|balance sheet)\b/i.test(text)) return "Accounting";

    return "GeneralFinance";
  }
}

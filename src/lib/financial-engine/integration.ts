import type { State, Transaction, Account } from "./types";
import { formatINR } from "../format";

// --- CANONICAL TYPES FOR IMPORT PLATFORM ---

export interface ImportItem {
  id: string; // unique temporary identifier
  date: string; // normalized YYYY-MM-DD
  amount: number; // positive float
  kind: "income" | "expense" | "transfer";
  category: string;
  merchant: string;
  referenceNumber?: string;
  notes?: string;
  accountId: string;
  // Indicators
  confidenceScore: number; // 0 to 100
  isDuplicate: boolean;
  duplicateOfId?: string;
  status: "pending" | "approved" | "ignored";
  validationError?: string;
}

export interface ImportPreviewPayload {
  id: string;
  fileName: string;
  items: ImportItem[];
  duplicatesCount: number;
  totalValid: number;
  totalVolume: number;
}

export interface OcrResult {
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  taxAmount?: number;
  referenceNumber?: string;
  notes?: string;
  confidenceScore: number;
}

export interface ReconciliationReport {
  missingInLedger: ImportItem[];
  duplicateEntries: Transaction[];
  amountMismatches: Array<{ ledgerTx: Transaction; importItem: ImportItem }>;
  dateMismatches: Array<{ ledgerTx: Transaction; importItem: ImportItem }>;
  reconciledCount: number;
  discrepancyCount: number;
}

export interface BankSyncConnection {
  provider: "icici" | "hdfc" | "sbi" | "axis" | "custom";
  accountId: string;
  lastSyncedAt?: string;
  status: "connected" | "disconnected" | "error";
  syncMode: "manual" | "scheduled";
}

// --- PROVIDER ADAPTERS ---

export interface BankAdapter {
  providerName: string;
  fetchTransactions(accountId: string, sinceDate: string): Promise<any[]>;
  fetchBalance(accountId: string): Promise<number>;
}

export class IciciAdapter implements BankAdapter {
  providerName = "ICICI Bank";
  async fetchTransactions(accountId: string, sinceDate: string): Promise<any[]> {
    // Simulated raw ICICI JSON bank API output
    return [
      { TXN_DATE: "21-07-2026", TXN_DESC: "ZOMATO*FOOD", TXN_AMT: "650.00", DR_CR: "DR", REF_NO: "ICI98217319" },
      { TXN_DATE: "20-07-2026", TXN_DESC: "SALARY*CORP", TXN_AMT: "95000.00", DR_CR: "CR", REF_NO: "ICI1029318" },
      { TXN_DATE: "18-07-2026", TXN_DESC: "SWIGGY*INSTAMART", TXN_AMT: "1240.00", DR_CR: "DR", REF_NO: "ICI2938104" },
    ];
  }
  async fetchBalance(accountId: string): Promise<number> {
    return 145000.00;
  }
}

export class HdfcAdapter implements BankAdapter {
  providerName = "HDFCBANK";
  async fetchTransactions(accountId: string, sinceDate: string): Promise<any[]> {
    return [
      { ValueDate: "2026-07-21", Narration: "NETFLIX RECURRING", WithdrawalAmt: "649.00", ChqRefNumber: "HDFCSUB99" },
      { ValueDate: "19-07-2026", Narration: "AXIS ATM CASH WITHDRAWAL", WithdrawalAmt: "5000.00", ChqRefNumber: "HDFCATM88" },
    ];
  }
  async fetchBalance(accountId: string): Promise<number> {
    return 89200.50;
  }
}

export class SbiAdapter implements BankAdapter {
  providerName = "State Bank of India";
  async fetchTransactions(accountId: string, sinceDate: string): Promise<any[]> {
    return [
      { Date: "21/07/26", Particulars: "TO UPI/910283/SWIGGY", Debit: "350.00", RefNo: "SBIU91823" },
      { Date: "17/07/26", Particulars: "BY INTEREST CREDIT", Credit: "185.00", RefNo: "SBIINT823" },
    ];
  }
  async fetchBalance(accountId: string): Promise<number> {
    return 21050.00;
  }
}

export class AxisAdapter implements BankAdapter {
  providerName = "Axis Bank";
  async fetchTransactions(accountId: string, sinceDate: string): Promise<any[]> {
    return [
      { TxnDate: "2026-07-20", Remarks: "SHELL PETROL PUMP", Amount: "1500.00", Type: "DEBIT", UTR: "AXS9921" },
    ];
  }
  async fetchBalance(accountId: string): Promise<number> {
    return 54200.00;
  }
}

// --- DATA INTEGRATION ENGINES ---

export class NormalizationEngine {
  /**
   * Normalizes incoming string dates into standardized YYYY-MM-DD format.
   */
  public static normalizeDate(dateStr: string): string {
    const clean = dateStr.trim();
    
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    
    // DD-MM-YYYY
    const dmyDash = clean.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dmyDash) return `${dmyDash[3]}-${dmyDash[2]}-${dmyDash[1]}`;
    
    // DD/MM/YYYY
    const dmySlash = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmySlash) return `${dmySlash[3]}-${dmySlash[2]}-${dmySlash[1]}`;
    
    // DD/MM/YY (common in banking outputs)
    const dmySlashShort = clean.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (dmySlashShort) return `20${dmySlashShort[3]}-${dmySlashShort[2]}-${dmySlashShort[1]}`;

    // Try native date parsing fallback
    try {
      const d = new Date(clean);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    } catch {}

    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Normalizes text numbers, currency values, commas, and negative flags.
   */
  public static normalizeAmount(val: any): number {
    if (typeof val === "number") return Math.abs(val);
    const str = String(val ?? "0")
      .replace(/[₹$,\s]/g, "")
      .trim();
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : Math.abs(parsed);
  }

  /**
   * Standardizes merchant labels by stripping whitespace and noise tags.
   */
  public static normalizeMerchant(name: string): string {
    return name
      .replace(/[\*\/_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

export class DuplicateDetectionEngine {
  /**
   * Scans incoming transactions against the live ledger to flag matching items.
   */
  public static detectDuplicates(state: State, item: ImportItem): { isDuplicate: boolean; duplicateOfId?: string } {
    const ledger = state.transactions ?? [];
    
    for (const tx of ledger) {
      // 1. Check exact match by Reference ID / UTR
      if (item.referenceNumber && tx.note?.includes(item.referenceNumber)) {
        return { isDuplicate: true, duplicateOfId: tx.id };
      }

      // 2. Fuzzy match: Same Account, Same Amount, and Date within +/- 2 days
      const dateDiff = Math.abs(
        (new Date(item.date).getTime() - new Date(tx.date).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      const amountMatch = Math.abs(item.amount - tx.amount) < 0.01;
      const merchantMatch = tx.merchant && 
        (tx.merchant.toLowerCase().includes(item.merchant.toLowerCase()) || 
         item.merchant.toLowerCase().includes(tx.merchant.toLowerCase()));

      if (dateDiff <= 2 && amountMatch && merchantMatch) {
        return { isDuplicate: true, duplicateOfId: tx.id };
      }
    }

    return { isDuplicate: false };
  }
}

export class CategoryEngine {
  private static DETERMINISTIC_RULES: Array<{ keywords: string[]; category: string }> = [
    { keywords: ["zomato", "swiggy", "starbucks", "mcdonalds", "restaurant", "cafe"], category: "Food & Dining" },
    { keywords: ["netflix", "spotify", "prime video", "disney", "youtube premium"], category: "Streaming Subscription" },
    { keywords: ["shell", "petrol", "hpc", "cng", "uber", "ola", "metro"], category: "Travel & Transport" },
    { keywords: ["electricity", "bses", "water bill", "airtel", "jio", "gas"], category: "Utilities" },
    { keywords: ["mutual fund", "sip", "groww", "zerodha", "investing", "etmoney"], category: "Investments" },
    { keywords: ["interest credit", "sbi interest", "saving interest"], category: "Savings Interest" },
    { keywords: ["salary", "payroll", "dividend"], category: "Salary Income" },
  ];

  /**
   * Resolves category based on merchant name patterns.
   * If confidence is low, marks item as requiring validation.
   */
  public static predictCategory(merchant: string): { category: string; confidence: number } {
    const clean = merchant.toLowerCase();
    
    for (const rule of this.DETERMINISTIC_RULES) {
      if (rule.keywords.some((kw) => clean.includes(kw))) {
        return { category: rule.category, confidence: 95 };
      }
    }

    return { category: "Uncategorized", confidence: 30 };
  }
}

export class ImportEngine {
  /**
   * Main CSV statement parser.
   */
  public static async parseCsv(fileContent: string, accountId: string, state: State): Promise<ImportItem[]> {
    const lines = fileContent.split(/\r?\n/);
    const items: ImportItem[] = [];
    
    // Simple CSV parser supporting Date, Merchant/Description, Amount, Type headers
    let headers: string[] = [];
    let startIdx = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(",").map((p) => p.replace(/^"|"$/g, "").trim());
      if (parts.some((p) => ["date", "txn date", "narration", "description", "amount"].includes(p.toLowerCase()))) {
        headers = parts.map((h) => h.toLowerCase());
        startIdx = i + 1;
        break;
      }
    }

    // Default column fallback if no headers found
    if (headers.length === 0) {
      headers = ["date", "merchant", "amount", "kind"];
      startIdx = 0;
    }

    const dateCol = headers.findIndex((h) => h.includes("date") || h === "dt");
    const descCol = headers.findIndex((h) => h.includes("description") || h.includes("desc") || h.includes("particulars") || h === "narration" || h === "merchant");
    const amtCol = headers.findIndex((h) => h.includes("amount") || h.includes("amt") || h === "debit" || h === "withdrawal" || h === "credit");
    
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(",").map((p) => p.replace(/^"|"$/g, "").trim());
      if (parts.length < Math.max(dateCol, descCol, amtCol)) continue;

      const rawDate = parts[dateCol] || "";
      const rawDesc = parts[descCol] || "Unknown Transaction";
      const rawAmt = parts[amtCol] || "0";

      const normalizedDate = NormalizationEngine.normalizeDate(rawDate);
      const normalizedAmount = NormalizationEngine.normalizeAmount(rawAmt);
      const normalizedMerchant = NormalizationEngine.normalizeMerchant(rawDesc);
      
      // Determine transaction type
      let kind: "income" | "expense" | "transfer" = "expense";
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes("salary") || lowerLine.includes("refund") || lowerLine.includes("interest credit") || lowerLine.includes("deposit")) {
        kind = "income";
      }

      const categoryPrediction = CategoryEngine.predictCategory(normalizedMerchant);

      const item: ImportItem = {
        id: `import_${Math.random().toString(36).slice(2, 9)}`,
        date: normalizedDate,
        amount: normalizedAmount,
        kind,
        category: categoryPrediction.confidence >= 50 ? categoryPrediction.category : "Uncategorized",
        merchant: normalizedMerchant,
        accountId,
        confidenceScore: categoryPrediction.confidence,
        isDuplicate: false,
        status: "pending",
      };

      const dupCheck = DuplicateDetectionEngine.detectDuplicates(state, item);
      if (dupCheck.isDuplicate) {
        item.isDuplicate = true;
        item.duplicateOfId = dupCheck.duplicateOfId;
        item.status = "ignored";
      }

      items.push(item);
    }

    return items;
  }

  /**
   * Finalizes event mapping and saves approved items to State ledger.
   */
  public static mapToTransactions(approvedItems: ImportItem[]): Transaction[] {
    return approvedItems.map((item) => ({
      id: `tx_${Math.random().toString(36).slice(2, 9)}`,
      accountId: item.accountId,
      amount: item.amount,
      kind: item.kind,
      category: item.category,
      date: item.date,
      merchant: item.merchant,
      notes: item.referenceNumber ? `Imported. Ref: ${item.referenceNumber}` : "Imported via File Sync",
      status: "cleared",
    }));
  }
}

export class OcrEngine {
  /**
   * Simulates receipt scanning.
   */
  public static async scanReceipt(fileName: string, mimeType: string): Promise<OcrResult> {
    // Emulated latency
    await new Promise((resolve) => setTimeout(resolve, 600));

    const cleanName = fileName.toLowerCase();

    if (cleanName.includes("zomato") || cleanName.includes("food")) {
      return {
        merchant: "Zomato Restaurant Delivery",
        amount: 840.00,
        currency: "INR",
        date: new Date().toISOString().slice(0, 10),
        category: "Food & Dining",
        taxAmount: 40.00,
        referenceNumber: "ZOM991203",
        confidenceScore: 98,
      };
    }

    if (cleanName.includes("electricity") || cleanName.includes("bill")) {
      return {
        merchant: "BSES Electricity Bill",
        amount: 4520.00,
        currency: "INR",
        date: new Date().toISOString().slice(0, 10),
        category: "Utilities",
        taxAmount: 215.00,
        referenceNumber: "ELE102931",
        confidenceScore: 92,
      };
    }

    // Default parser fallback
    return {
      merchant: "Generic Merchant Receipt",
      amount: 120.00,
      currency: "INR",
      date: new Date().toISOString().slice(0, 10),
      category: "Uncategorized",
      confidenceScore: 55,
    };
  }
}

export class BankSyncEngine {
  private static adapters: Record<string, BankAdapter> = {
    icici: new IciciAdapter(),
    hdfc: new HdfcAdapter(),
    sbi: new SbiAdapter(),
    axis: new AxisAdapter(),
  };

  /**
   * Connects to a mock API adapter and pulls transactions.
   */
  public static async syncAccount(
    provider: "icici" | "hdfc" | "sbi" | "axis",
    accountId: string,
    state: State
  ): Promise<ImportItem[]> {
    const adapter = this.adapters[provider];
    if (!adapter) throw new Error(`Unknown Bank Adapter: ${provider}`);

    const rawTxns = await adapter.fetchTransactions(accountId, new Date().toISOString().slice(0, 10));
    const normalizedItems: ImportItem[] = [];

    for (const raw of rawTxns) {
      let date = "";
      let desc = "";
      let amt = 0;
      let kind: "income" | "expense" = "expense";
      let ref: string | undefined;

      // Extract properties based on bank formats
      if (provider === "icici") {
        date = NormalizationEngine.normalizeDate(raw.TXN_DATE);
        desc = NormalizationEngine.normalizeMerchant(raw.TXN_DESC);
        amt = NormalizationEngine.normalizeAmount(raw.TXN_AMT);
        kind = raw.DR_CR === "CR" ? "income" : "expense";
        ref = raw.REF_NO;
      } else if (provider === "hdfc") {
        date = NormalizationEngine.normalizeDate(raw.ValueDate);
        desc = NormalizationEngine.normalizeMerchant(raw.Narration);
        amt = NormalizationEngine.normalizeAmount(raw.WithdrawalAmt);
        kind = "expense";
        ref = raw.ChqRefNumber;
      } else if (provider === "sbi") {
        date = NormalizationEngine.normalizeDate(raw.Date);
        desc = NormalizationEngine.normalizeMerchant(raw.Particulars);
        amt = NormalizationEngine.normalizeAmount(raw.Debit || raw.Credit);
        kind = raw.Credit ? "income" : "expense";
        ref = raw.RefNo;
      } else if (provider === "axis") {
        date = NormalizationEngine.normalizeDate(raw.TxnDate);
        desc = NormalizationEngine.normalizeMerchant(raw.Remarks);
        amt = NormalizationEngine.normalizeAmount(raw.Amount);
        kind = raw.Type === "CREDIT" ? "income" : "expense";
        ref = raw.UTR;
      }

      const catPred = CategoryEngine.predictCategory(desc);

      const item: ImportItem = {
        id: `sync_${Math.random().toString(36).slice(2, 9)}`,
        date,
        amount: amt,
        kind,
        category: catPred.category,
        merchant: desc,
        accountId,
        referenceNumber: ref,
        confidenceScore: catPred.confidence,
        isDuplicate: false,
        status: "pending",
      };

      const dupCheck = DuplicateDetectionEngine.detectDuplicates(state, item);
      if (dupCheck.isDuplicate) {
        item.isDuplicate = true;
        item.duplicateOfId = dupCheck.duplicateOfId;
        item.status = "ignored";
      }

      normalizedItems.push(item);
    }

    return normalizedItems;
  }
}

export class ReconciliationEngine {
  /**
   * Compares imports with the live ledger.
   */
  public static reconcile(imported: ImportItem[], state: State): ReconciliationReport {
    const report: ReconciliationReport = {
      missingInLedger: [],
      duplicateEntries: [],
      amountMismatches: [],
      dateMismatches: [],
      reconciledCount: 0,
      discrepancyCount: 0,
    };

    const ledger = state.transactions ?? [];

    for (const item of imported) {
      let matchedTx: Transaction | undefined;

      // Match by reference number
      if (item.referenceNumber) {
        matchedTx = ledger.find((t) => t.note?.includes(item.referenceNumber!));
      }

      // Fuzzy match by amount & merchant
      if (!matchedTx) {
        matchedTx = ledger.find((t) => {
          const merchantMatch = t.merchant && t.merchant.toLowerCase().includes(item.merchant.toLowerCase());
          const amountMatch = Math.abs(t.amount - item.amount) < 0.01;
          return merchantMatch && amountMatch;
        });
      }

      if (!matchedTx) {
        report.missingInLedger.push(item);
        report.discrepancyCount++;
      } else {
        report.reconciledCount++;
        // Check mismatches
        if (Math.abs(matchedTx.amount - item.amount) > 0.01) {
          report.amountMismatches.push({ ledgerTx: matchedTx, importItem: item });
          report.discrepancyCount++;
        }
        if (matchedTx.date !== item.date) {
          report.dateMismatches.push({ ledgerTx: matchedTx, importItem: item });
          report.discrepancyCount++;
        }
      }
    }

    return report;
  }
}

export class AttachmentEngine {
  /**
   * Simulated attachment linking.
   */
  public static addAttachment(tx: Transaction, fileUrl: string, note?: string): Transaction {
    return {
      ...tx,
      note: tx.note ? `${tx.note}. Attachment: ${fileUrl}` : `Attachment: ${fileUrl}`,
    };
  }
}

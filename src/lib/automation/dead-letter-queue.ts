export interface DeadLetterItem {
  id: string;
  jobId: string;
  jobName: string;
  queueName: string;
  workspaceId: string;
  failedAt: string;
  attemptsMade: number;
  maxRetries: number;
  lastError: string;
  payload: any;
  stackTrace?: string;
}

export class DeadLetterQueue {
  private static STORAGE_KEY = "gf_dead_letter_queue";

  public static getItems(): DeadLetterItem[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      const seeds = this.getSeedItems();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seeds));
      return seeds;
    }
    return JSON.parse(raw);
  }

  public static add(item: Omit<DeadLetterItem, "id" | "failedAt">): DeadLetterItem {
    const items = this.getItems();
    const newItem: DeadLetterItem = {
      ...item,
      id: `dlq_${Math.random().toString(36).substring(2, 9)}`,
      failedAt: new Date().toISOString()
    };
    items.unshift(newItem);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
    return newItem;
  }

  public static removeItem(id: string): void {
    const items = this.getItems().filter(i => i.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
  }

  public static clearAll(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  private static getSeedItems(): DeadLetterItem[] {
    return [
      {
        id: "dlq_1",
        jobId: "job_ocr_failed_101",
        jobName: "Bank Statement OCR Parsing (HDFC_Q2.pdf)",
        queueName: "ocr_queue",
        workspaceId: "personal",
        failedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        attemptsMade: 5,
        maxRetries: 5,
        lastError: "Vision OCR Service Timeout: HTTP 504 Gateway Timeout after 5 backoff retries",
        payload: { fileName: "HDFC_Q2.pdf", size: 4200000 },
        stackTrace: "Error: Timeout at OCRService.parse (ocr.ts:42)"
      },
      {
        id: "dlq_2",
        jobId: "job_sync_failed_102",
        jobName: "ICICI Bank Open Banking Sync",
        queueName: "bank_sync",
        workspaceId: "business",
        failedAt: new Date(Date.now() - 86400000).toISOString(),
        attemptsMade: 5,
        maxRetries: 5,
        lastError: "Invalid API Credential Token: Consent token expired on bank side",
        payload: { connectorId: "icici_prod_99" },
        stackTrace: "Error: AuthTokenExpired at BankConnector.sync (bank.ts:112)"
      }
    ];
  }
}

export interface VaultFile {
  id: string;
  name: string;
  folder: "Taxes" | "Statements" | "Agreements" | "Policies" | "Receipts" | "Invoices" | "Other";
  sizeBytes: number;
  uploadedAt: string;
  expiryDate?: string;
  tags: string[];
  version: number;
  workspaceId: string;
}

export class DocumentVaultEngine {
  private static STORAGE_KEY = "gf_vault_files";

  public static getFiles(workspaceId: string): VaultFile[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    const files: VaultFile[] = raw ? JSON.parse(raw) : this.getSeedFiles();
    return files.filter(f => f.workspaceId === workspaceId);
  }

  public static uploadFile(
    name: string,
    folder: VaultFile["folder"],
    sizeBytes: number,
    workspaceId: string,
    tags: string[] = [],
    expiryDate?: string
  ): VaultFile {
    const files = this.getAllFiles();
    const newFile: VaultFile = {
      id: `doc_${Math.random().toString(36).substring(2, 9)}`,
      name,
      folder,
      sizeBytes,
      uploadedAt: new Date().toISOString(),
      expiryDate,
      tags,
      version: 1,
      workspaceId
    };
    files.unshift(newFile);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(files));
    return newFile;
  }

  public static deleteFile(id: string): void {
    const files = this.getAllFiles().filter(f => f.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(files));
  }

  private static getAllFiles(): VaultFile[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    return raw ? JSON.parse(raw) : this.getSeedFiles();
  }

  private static getSeedFiles(): VaultFile[] {
    const seeds: VaultFile[] = [
      {
        id: "doc_1",
        name: "FY25_Form16_TaxStatement.pdf",
        folder: "Taxes",
        sizeBytes: 1542000,
        uploadedAt: "2026-06-15T09:00:00Z",
        tags: ["tax", "income", "FY25"],
        version: 1,
        workspaceId: "personal"
      },
      {
        id: "doc_2",
        name: "HDFC_HomeLoan_Agreement.pdf",
        folder: "Agreements",
        sizeBytes: 4210000,
        uploadedAt: "2026-03-12T14:30:00Z",
        tags: ["loan", "home", "hdfc"],
        version: 1,
        workspaceId: "personal"
      },
      {
        id: "doc_3",
        name: "LIC_TermLifePolicy_Schedule.pdf",
        folder: "Policies",
        sizeBytes: 2100000,
        uploadedAt: "2026-04-18T10:15:00Z",
        expiryDate: "2027-04-17",
        tags: ["insurance", "term", "lic"],
        version: 2,
        workspaceId: "personal"
      },
      {
        id: "doc_4",
        name: "MacBookPro_OfficeInvoice.pdf",
        folder: "Invoices",
        sizeBytes: 312000,
        uploadedAt: "2026-05-02T11:22:00Z",
        tags: ["business", "asset", "invoice"],
        version: 1,
        workspaceId: "business"
      }
    ];
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seeds));
    return seeds;
  }
}

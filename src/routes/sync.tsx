import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useStore, type Account } from "@/lib/store";
import {
  ImportEngine,
  OcrEngine,
  BankSyncEngine,
  ReconciliationEngine,
  type ImportItem,
  type OcrResult,
  type ReconciliationReport,
} from "@/lib/financial-engine";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Upload,
  FileText,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Check,
  Trash,
  Database,
  Building2,
  FileCode,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/sync")({
  head: () => ({ meta: [{ title: "Sync & OCR · GloriousFinance" }] }),
  component: SyncPage,
});

function SyncPage() {
  const { state, dispatch } = useStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<"bank" | "file" | "ocr" | "recon">("bank");

  // Bank Sync State
  const [selectedBank, setSelectedBank] = useState<"icici" | "hdfc" | "sbi" | "axis">("icici");
  const [selectedAccount, setSelectedAccount] = useState<string>(state.accounts[0]?.id || "default-account");
  const [isSyncing, setIsSyncing] = useState(false);
  const [importedItems, setImportedItems] = useState<ImportItem[]>([]);

  // File Import State
  const [csvContent, setCsvContent] = useState<string>(
    `Date,Description,Amount,Type\n21-07-2026,Zomato Delivery,680.00,DR\n20-07-2026,HDFC Credit Card Int,450.00,CR\n19-07-2026,Netflix Premium,649.00,DR`
  );
  const [fileImportedItems, setFileImportedItems] = useState<ImportItem[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  // OCR State
  const [selectedReceipt, setSelectedReceipt] = useState<string>("zomato");
  const [isScanning, setIsScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);

  // Reconciliation State
  const [reconReport, setReconReport] = useState<ReconciliationReport | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  // --- BANK SYNC TRIGGERS ---
  const handleBankSync = async () => {
    setIsSyncing(true);
    try {
      const items = await BankSyncEngine.syncAccount(selectedBank, selectedAccount, state);
      setImportedItems(items);
      toast.success(`Imported ${items.length} raw transactions from ${selectedBank.toUpperCase()}.`);
    } catch (e: any) {
      toast.error(e.message || "Failed to sync bank data.");
    } finally {
      setIsSyncing(false);
    }
  };

  // --- CSV PARSING TRIGGERS ---
  const handleParseCsv = async () => {
    setIsParsing(true);
    try {
      const items = await ImportEngine.parseCsv(csvContent, selectedAccount, state);
      setFileImportedItems(items);
      toast.success(`Normalized ${items.length} entries successfully. Checked for duplicates.`);
    } catch (e: any) {
      toast.error("Verify CSV headers and columns.");
    } finally {
      setIsParsing(false);
    }
  };

  // --- OCR RECEIPTS TRIGGERS ---
  const handleOcrScan = async () => {
    setIsScanning(true);
    try {
      const result = await OcrEngine.scanReceipt(`${selectedReceipt}-receipt.png`, "image/png");
      setOcrResult(result);
      toast.success(`Extracted ${result.merchant} with ${result.confidenceScore}% confidence.`);
    } catch (e) {
      toast.error("Failed to extract receipt values.");
    } finally {
      setIsScanning(false);
    }
  };

  // --- RECONCILIATION TRIGGERS ---
  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      // Combine all parsed/synced items currently under preview
      const allItems = [...importedItems, ...fileImportedItems];
      if (allItems.length === 0) {
        toast.error("Sync bank or parse CSV first to run reconciliation.");
        return;
      }
      const report = ReconciliationEngine.reconcile(allItems, state);
      setReconReport(report);
      toast.success(`Verified ${report.reconciledCount} matches, identified ${report.discrepancyCount} gaps.`);
    } finally {
      setIsReconciling(false);
    }
  };

  // --- SAVING AND COMMIT TRIGGERS ---
  const handleApproveItem = (id: string, listType: "bank" | "file") => {
    const list = listType === "bank" ? importedItems : fileImportedItems;
    const updated = list.map((item) => (item.id === id ? { ...item, status: "approved" as const } : item));
    if (listType === "bank") setImportedItems(updated);
    else setFileImportedItems(updated);
  };

  const handleIgnoreItem = (id: string, listType: "bank" | "file") => {
    const list = listType === "bank" ? importedItems : fileImportedItems;
    const updated = list.map((item) => (item.id === id ? { ...item, status: "ignored" as const } : item));
    if (listType === "bank") setImportedItems(updated);
    else setFileImportedItems(updated);
  };

  const handleCommitToLedger = (listType: "bank" | "file") => {
    const list = listType === "bank" ? importedItems : fileImportedItems;
    const approved = list.filter((item) => item.status === "approved" || (item.status === "pending" && !item.isDuplicate));
    
    if (approved.length === 0) {
      toast.error("Please approve or mark pending transactions to commit.");
      return;
    }

    const newTxns = ImportEngine.mapToTransactions(approved);
    
    // Commit each to state
    newTxns.forEach((tx) => {
      dispatch({ type: "txn:add", payload: tx });
    });

    // Clear committed from view
    if (listType === "bank") setImportedItems([]);
    else setFileImportedItems([]);

    toast.success(`Successfully inserted ${newTxns.length} normalized transactions to Financial OS.`);
  };

  const handleCommitOcrToLedger = () => {
    if (!ocrResult) return;

    const newTx: any = {
      id: `tx_ocr_${Math.random().toString(36).slice(2, 9)}`,
      accountId: selectedAccount,
      amount: ocrResult.amount,
      kind: "expense",
      category: ocrResult.category,
      date: ocrResult.date,
      merchant: ocrResult.merchant,
      note: `OCR Scanned. Confidence: ${ocrResult.confidenceScore}%. Ref: ${ocrResult.referenceNumber || "none"}`,
      status: "cleared",
    };

    dispatch({ type: "txn:add", payload: newTx });
    setOcrResult(null);
    toast.success(`Successfully saved ${newTx.merchant} transaction to ledger.`);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      {/* Page Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Database className="h-4 w-4 text-primary" />
            <span>Wealth OS Integration Hub</span>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Data Integration Platform
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Centralized normalization, validation, receipt OCR, bank syncing, and reconciliation.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-2 h-auto bg-transparent p-0 mb-8">
          <TabsTrigger value="bank" className="text-xs py-2.5 border border-border/40 rounded-lg">
            <Building2 className="mr-2 h-4 w-4" />
            Bank Sync
          </TabsTrigger>
          <TabsTrigger value="file" className="text-xs py-2.5 border border-border/40 rounded-lg">
            <Upload className="mr-2 h-4 w-4" />
            CSV Parser
          </TabsTrigger>
          <TabsTrigger value="ocr" className="text-xs py-2.5 border border-border/40 rounded-lg">
            <Sparkles className="mr-2 h-4 w-4" />
            Receipt OCR
          </TabsTrigger>
          <TabsTrigger value="recon" className="text-xs py-2.5 border border-border/40 rounded-lg">
            <FileCheck className="mr-2 h-4 w-4" />
            Reconciliation
          </TabsTrigger>
        </TabsList>

        {/* --- BANK SYNC TAB --- */}
        <TabsContent value="bank">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1 border border-border/40 bg-card/40 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-lg">Bank Connectors</CardTitle>
                <CardDescription>Establish a secure sync adapter</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Select Partner Bank</label>
                  <select
                    className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value as any)}
                  >
                    <option value="icici">ICICI Bank</option>
                    <option value="hdfc">HDFC Bank</option>
                    <option value="sbi">State Bank of India (SBI)</option>
                    <option value="axis">Axis Bank</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Target Account</label>
                  <select
                    className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                  >
                    {state.accounts.map((acc: Account) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.institution || "Cash"})
                      </option>
                    ))}
                    {state.accounts.length === 0 && (
                      <option value="default-account">Default Cash Account</option>
                    )}
                  </select>
                </div>

                <Alert className="bg-primary/5 border border-primary/20">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <AlertTitle className="text-xs font-semibold uppercase text-primary">Credential Encryption</AlertTitle>
                  <AlertDescription className="text-xs text-muted-foreground">
                    Bank login passwords are never stored. Integration is sandboxed through verified API channels.
                  </AlertDescription>
                </Alert>
              </CardContent>
              <CardFooter>
                <Button onClick={handleBankSync} className="w-full" disabled={isSyncing}>
                  {isSyncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing Adapter...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Manual Sync Now
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            <Card className="md:col-span-2 border border-border/40 bg-card/40 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Import Preview Queue</CardTitle>
                  <CardDescription>Audit incoming ledger items before final commit</CardDescription>
                </div>
                {importedItems.length > 0 && (
                  <Button size="sm" onClick={() => handleCommitToLedger("bank")}>
                    Commit Approved ({importedItems.filter((i) => i.status === "approved").length})
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {importedItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <Building2 className="h-12 w-12 text-border mb-3" />
                    <p className="text-sm font-medium">No pending imports active.</p>
                    <p className="text-xs">Select a bank connector and initiate a manual sync to pull records.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {importedItems.map((item) => (
                      <div
                        key={item.id}
                        className={`flex flex-col justify-between gap-4 rounded-lg border p-4 transition-all md:flex-row md:items-center ${
                          item.isDuplicate
                            ? "border-amber-500/20 bg-amber-500/5"
                            : item.status === "approved"
                            ? "border-green-500/20 bg-green-500/5"
                            : "border-border/40 bg-background/30"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{item.merchant}</span>
                            <Badge variant={item.kind === "income" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                              {item.kind.toUpperCase()}
                            </Badge>
                            {item.isDuplicate && (
                              <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/10 text-[10px] gap-1">
                                <AlertTriangle className="h-3 w-3" /> Duplicate
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Date: {item.date}</span>
                            <span>Category: {item.category}</span>
                            {item.referenceNumber && <span>Ref: {item.referenceNumber}</span>}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 md:justify-end">
                          <span className="text-sm font-semibold">{formatINR(item.amount)}</span>
                          <div className="flex gap-1">
                            {item.status !== "approved" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0 text-green-500"
                                onClick={() => handleApproveItem(item.id, "bank")}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            {item.status !== "ignored" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => handleIgnoreItem(item.id, "bank")}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* --- CSV PARSER TAB --- */}
        <TabsContent value="file">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1 border border-border/40 bg-card/40 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-lg">CSV Statement Parser</CardTitle>
                <CardDescription>Parse and validate raw statements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">CSV Content (Raw Text)</label>
                  <textarea
                    className="w-full h-40 rounded-md border border-border/60 bg-background px-3 py-2 text-xs font-mono"
                    value={csvContent}
                    onChange={(e) => setCsvContent(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Destination Account</label>
                  <select
                    className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                  >
                    {state.accounts.map((acc: Account) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.institution || "Cash"})
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleParseCsv} className="w-full" disabled={isParsing}>
                  {isParsing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Parsing Statements...
                    </>
                  ) : (
                    <>
                      <FileCode className="mr-2 h-4 w-4" />
                      Parse & Normalize
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            <Card className="md:col-span-2 border border-border/40 bg-card/40 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">CSV Parse Preview</CardTitle>
                  <CardDescription>Normalized statement values awaiting approval</CardDescription>
                </div>
                {fileImportedItems.length > 0 && (
                  <Button size="sm" onClick={() => handleCommitToLedger("file")}>
                    Commit Approved ({fileImportedItems.filter((i) => i.status === "approved").length})
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {fileImportedItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 text-border mb-3" />
                    <p className="text-sm font-medium">No statements parsed yet.</p>
                    <p className="text-xs">Input raw CSV values in the editor and click Parse.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {fileImportedItems.map((item) => (
                      <div
                        key={item.id}
                        className={`flex flex-col justify-between gap-4 rounded-lg border p-4 transition-all md:flex-row md:items-center ${
                          item.isDuplicate
                            ? "border-amber-500/20 bg-amber-500/5"
                            : item.status === "approved"
                            ? "border-green-500/20 bg-green-500/5"
                            : "border-border/40 bg-background/30"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{item.merchant}</span>
                            <Badge variant={item.kind === "income" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                              {item.kind.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Date: {item.date}</span>
                            <span>Category: {item.category}</span>
                            <span>Confidence: {item.confidenceScore}%</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 md:justify-end">
                          <span className="text-sm font-semibold">{formatINR(item.amount)}</span>
                          <div className="flex gap-1">
                            {item.status !== "approved" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0 text-green-500"
                                onClick={() => handleApproveItem(item.id, "file")}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            {item.status !== "ignored" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => handleIgnoreItem(item.id, "file")}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* --- OCR RECEIPT TAB --- */}
        <TabsContent value="ocr">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1 border border-border/40 bg-card/40 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-lg">Receipt OCR Scanner</CardTitle>
                <CardDescription>Extract transaction data from image files</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Mock Receipt Selection</label>
                  <select
                    className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                    value={selectedReceipt}
                    onChange={(e) => setSelectedReceipt(e.target.value)}
                  >
                    <option value="zomato">Zomato Dinner Bill (₹840.00)</option>
                    <option value="electricity">BSES Utility statement (₹4,520.00)</option>
                    <option value="generic">Unlabeled Cash Slip (₹120.00)</option>
                  </select>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleOcrScan} className="w-full" disabled={isScanning}>
                  {isScanning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scanning Receipt...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Execute OCR Scan
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            <Card className="md:col-span-2 border border-border/40 bg-card/40 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-lg">OCR Scan Results</CardTitle>
                <CardDescription>Extracted fields ready for validation review</CardDescription>
              </CardHeader>
              <CardContent>
                {!ocrResult ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <Sparkles className="h-12 w-12 text-border mb-3" />
                    <p className="text-sm font-medium">No receipt parsed.</p>
                    <p className="text-xs">Trigger a scan on the left to extract merchant billing lines.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase font-semibold">Merchant</span>
                        <div className="font-semibold text-foreground text-sm">{ocrResult.merchant}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase font-semibold">Amount (INR)</span>
                        <div className="font-bold text-foreground text-sm">{formatINR(ocrResult.amount)}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase font-semibold">Billing Date</span>
                        <div className="text-sm text-foreground">{ocrResult.date}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase font-semibold">Predicted Category</span>
                        <div className="text-sm text-foreground">{ocrResult.category}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase font-semibold">Confidence Score</span>
                        <div>
                          <Badge
                            className={
                              ocrResult.confidenceScore > 80
                                ? "bg-green-500/10 text-green-500 hover:bg-green-500/10"
                                : "bg-amber-500/10 text-amber-500 hover:bg-amber-500/10"
                            }
                          >
                            {ocrResult.confidenceScore}% Confidence
                          </Badge>
                        </div>
                      </div>
                      {ocrResult.referenceNumber && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground uppercase font-semibold">Ref / UTR Number</span>
                          <div className="text-sm text-mono">{ocrResult.referenceNumber}</div>
                        </div>
                      )}
                    </div>

                    {ocrResult.confidenceScore < 60 && (
                      <Alert className="bg-amber-500/5 border border-amber-500/20">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <AlertTitle className="text-amber-500">Low OCR Confidence</AlertTitle>
                        <AlertDescription className="text-muted-foreground text-xs">
                          Confidence score is below 60%. Please verify all values carefully before committing to the ledger.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setOcrResult(null)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCommitOcrToLedger}>
                        Approve & Post to Ledger
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* --- RECONCILIATION TAB --- */}
        <TabsContent value="recon">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1 border border-border/40 bg-card/40 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-lg">Reconciliation Scan</CardTitle>
                <CardDescription>Cross-reference external statements with ledger</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Evaluates active previews (parsed CSVs and synced bank logs) against posted transactions to check for missing items, amount mismatches, and date gaps.
                </p>
              </CardContent>
              <CardFooter>
                <Button onClick={handleReconcile} className="w-full" disabled={isReconciling}>
                  {isReconciling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running Reconciliation...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Start Reconciliation
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            <Card className="md:col-span-2 border border-border/40 bg-card/40 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-lg">Reconciliation Audit Report</CardTitle>
                <CardDescription>Mismatches and status indicators</CardDescription>
              </CardHeader>
              <CardContent>
                {!reconReport ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <FileCheck className="h-12 w-12 text-border mb-3" />
                    <p className="text-sm font-medium">No report generated.</p>
                    <p className="text-xs">Click Start Reconciliation on the left to review ledger gaps.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid gap-4 grid-cols-3 text-center">
                      <div className="rounded-lg bg-green-500/5 border border-green-500/20 py-4">
                        <div className="text-2xl font-bold text-green-500">{reconReport.reconciledCount}</div>
                        <div className="text-[10px] uppercase font-semibold text-muted-foreground">Reconciled</div>
                      </div>
                      <div className="rounded-lg bg-destructive/5 border border-destructive/20 py-4">
                        <div className="text-2xl font-bold text-destructive">{reconReport.missingInLedger.length}</div>
                        <div className="text-[10px] uppercase font-semibold text-muted-foreground">Missing in Ledger</div>
                      </div>
                      <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 py-4">
                        <div className="text-2xl font-bold text-amber-500">{reconReport.amountMismatches.length + reconReport.dateMismatches.length}</div>
                        <div className="text-[10px] uppercase font-semibold text-muted-foreground">Mismatches</div>
                      </div>
                    </div>

                    {reconReport.missingInLedger.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Missing Transactions (Statement only)</span>
                        <div className="space-y-2">
                          {reconReport.missingInLedger.map((item) => (
                            <div key={item.id} className="flex justify-between items-center rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs">
                              <div>
                                <span className="font-semibold">{item.merchant}</span>
                                <span className="ml-2 text-muted-foreground">{item.date}</span>
                              </div>
                              <span className="font-semibold text-destructive">{formatINR(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {reconReport.amountMismatches.length === 0 && reconReport.missingInLedger.length === 0 && (
                      <Alert className="bg-green-500/5 border border-green-500/20">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <AlertTitle className="text-green-500">Ledger fully synchronized</AlertTitle>
                        <AlertDescription className="text-xs text-muted-foreground">
                          All external statements match transactions in your Financial OS ledger. Zero gaps detected.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

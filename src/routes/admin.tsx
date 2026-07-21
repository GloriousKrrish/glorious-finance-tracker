import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import {
  Building,
  Shield,
  Activity,
  FileText,
  Settings,
  Layers,
  Lock,
  UserCheck,
  RefreshCw,
  Search,
  Trash2,
  Plus,
  Download,
  AlertTriangle,
  CheckCircle,
  Eye,
  Key,
  Cpu,
  Clock,
  Coins,
  ChevronRight,
  Upload,
  Calendar,
  X
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { WorkspaceEngine, type Workspace } from "@/lib/enterprise/workspace";
import { IdentityAccessEngine, type IdentityProfile } from "@/lib/enterprise/auth-identity";
import { RbacEngine } from "@/lib/enterprise/rbac";
import { MultiCurrencyEngine } from "@/lib/enterprise/currency";
import { AuditLogEngine, type AuditEvent } from "@/lib/enterprise/audit";
import { SecurityEngine, type SecurityEvent } from "@/lib/enterprise/security";
import { DocumentVaultEngine, type VaultFile } from "@/lib/enterprise/vault";
import { SystemHealthEngine, type HealthMetric } from "@/lib/enterprise/health";
import { FeatureFlagEngine, type FeatureFlag, type FeatureKey } from "@/lib/enterprise/feature-flags";

export const Route = createFileRoute("/admin")({
  component: AdminConsolePage,
});

type TabKey = "dashboard" | "workspaces" | "rbac" | "vault" | "health" | "flags" | "audit";

function AdminConsolePage() {
  const { state, dispatch, activeWorkspaceId } = useStore();
  const [activeTab, setActiveTab] = React.useState<TabKey>("dashboard");

  // State managers
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const [auditLogs, setAuditLogs] = React.useState<AuditEvent[]>([]);
  const [securityEvents, setSecurityEvents] = React.useState<SecurityEvent[]>([]);
  const [vaultFiles, setVaultFiles] = React.useState<VaultFile[]>([]);
  const [healthMetrics, setHealthMetrics] = React.useState<HealthMetric>(SystemHealthEngine.getMetrics());
  const [featureFlags, setFeatureFlags] = React.useState<FeatureFlag[]>([]);
  const [sessions, setSessions] = React.useState<IdentityProfile[]>([]);

  // Search/Filters
  const [auditQuery, setAuditQuery] = React.useState("");
  const [auditTypeFilter, setAuditTypeFilter] = React.useState<string>("all");
  const [vaultQuery, setVaultQuery] = React.useState("");

  // Create Workspace Form
  const [wsName, setWsName] = React.useState("");
  const [wsType, setWsType] = React.useState<Workspace["type"]>("business");
  const [wsDesc, setWsDesc] = React.useState("");

  // Vault Upload Form
  const [docName, setDocName] = React.useState("");
  const [docFolder, setDocFolder] = React.useState<VaultFile["folder"]>("Receipts");
  const [docTags, setDocTags] = React.useState("");
  const [docExpiry, setDocExpiry] = React.useState("");

  const loadAllData = React.useCallback(() => {
    setWorkspaces(WorkspaceEngine.getWorkspaces());
    setAuditLogs(AuditLogEngine.getLogs());
    setSecurityEvents(SecurityEngine.getSecurityEvents());
    setVaultFiles(DocumentVaultEngine.getFiles(activeWorkspaceId));
    setFeatureFlags(FeatureFlagEngine.getFlags());
    setSessions(IdentityAccessEngine.getSessionHistory("current_user"));
    setHealthMetrics(SystemHealthEngine.getMetrics());
  }, [activeWorkspaceId]);

  React.useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Tab Definitions
  const tabs = [
    { key: "dashboard", label: "Enterprise Info", icon: Layers },
    { key: "workspaces", label: "Workspaces", icon: Building },
    { key: "rbac", label: "Identity & RBAC", icon: Shield },
    { key: "vault", label: "Document Vault", icon: FileText },
    { key: "flags", label: "Feature Flags", icon: Key },
    { key: "health", label: "System Health", icon: Activity },
    { key: "audit", label: "Audit Logs", icon: Clock },
  ] as const;

  // Handlers
  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsName.trim()) {
      toast.error("Workspace name is required");
      return;
    }
    const created = WorkspaceEngine.addWorkspace(wsName, wsType, wsDesc);
    toast.success(`Workspace "${created.name}" created successfully`);
    setWsName("");
    setWsDesc("");
    loadAllData();
    
    // Switch to it dynamically
    dispatch({
      type: "profile:update",
      payload: { activeWorkspaceId: created.id }
    });
  };

  const handleDeleteWorkspace = (id: string) => {
    if (id === "personal") {
      toast.error("Cannot delete default Personal workspace");
      return;
    }
    WorkspaceEngine.deleteWorkspace(id);
    toast.success("Workspace deleted");
    loadAllData();
    if (activeWorkspaceId === id) {
      dispatch({
        type: "profile:update",
        payload: { activeWorkspaceId: "personal" }
      });
    }
  };

  const handleToggleFlag = (key: FeatureKey, val: boolean) => {
    FeatureFlagEngine.updateFlag(key, val);
    toast.success(`Flag ${key} updated`);
    loadAllData();
  };

  const handleToggleOverride = (key: FeatureKey, wsId: string, val: boolean) => {
    FeatureFlagEngine.toggleWorkspaceOverride(key, wsId, val);
    toast.success(`Override updated for ${wsId}`);
    loadAllData();
  };

  const handleUploadDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) {
      toast.error("Document name is required");
      return;
    }
    const tagsArr = docTags.split(",").map(t => t.trim()).filter(Boolean);
    const size = Math.floor(Math.random() * 2500000) + 150000; // random file size
    DocumentVaultEngine.uploadFile(docName, docFolder, size, activeWorkspaceId, tagsArr, docExpiry || undefined);
    toast.success(`Document uploaded: ${docName}`);
    setDocName("");
    setDocTags("");
    setDocExpiry("");
    loadAllData();
  };

  const handleDeleteDoc = (id: string) => {
    DocumentVaultEngine.deleteFile(id);
    toast.success("Document deleted");
    loadAllData();
  };

  const triggerMfaTest = () => {
    IdentityAccessEngine.triggerMultiFactorChallenge("testuser_stabilized@example.com");
    toast.success("MFA Challenge sent via simulated SMS/Auth App");
  };

  // Filtered Audit logs
  const filteredAuditLogs = auditLogs.filter(log => {
    const queryMatch =
      log.user.toLowerCase().includes(auditQuery.toLowerCase()) ||
      (log.newValue || "").toLowerCase().includes(auditQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(auditQuery.toLowerCase());
    
    const typeMatch = auditTypeFilter === "all" || log.entity === auditTypeFilter;
    return queryMatch && typeMatch;
  });

  return (
    <div className="flex-1 space-y-8 p-6 md:p-8 pt-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">Admin Console</h1>
          <p className="text-xs text-muted-foreground">
            Manage enterprise controls, access permissions, security sessions, feature flags, and multi-workspace ledgers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadAllData} className="h-8 text-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reload Stats
          </Button>
          <Button size="sm" onClick={triggerMfaTest} className="h-8 text-xs">
            <Shield className="mr-1.5 h-3.5 w-3.5" /> Test MFA Check
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-border/60 gap-1">
        {tabs.map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all -mb-[1px] ${
                isActive
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <TabIcon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* tab contents */}
      <div className="mt-6">
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="border-border/50 bg-background/50">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">Base Currency</CardDescription>
                  <CardTitle className="text-xl font-bold">INR (₹)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[10px] text-muted-foreground">Ledger baseline currency</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-background/50">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">Workspaces Active</CardDescription>
                  <CardTitle className="text-xl font-bold">{workspaces.length}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[10px] text-muted-foreground">Segmented data partitions</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-background/50">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">Active Sessions</CardDescription>
                  <CardTitle className="text-xl font-bold">{sessions.length}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[10px] text-muted-foreground">Identities tracking token TTL</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-background/50">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">DB Status</CardDescription>
                  <CardTitle className="text-xl font-bold text-emerald-500 flex items-center gap-1.5">
                    <CheckCircle className="h-4.5 w-4.5" /> Healthy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[10px] text-muted-foreground">Avg api latency: 38ms</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-border/60 bg-background/30">
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Workspace Balance Distribution</CardTitle>
                  <CardDescription className="text-xs">Overall liquidity segmented across all workspaces</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {workspaces.map(ws => {
                    const wsState = WorkspaceEngine.getWorkspaceState(state, ws.id);
                    const bal = wsState.accounts.reduce((s, a) => s + a.balance, 0);
                    return (
                      <div key={ws.id} className="flex items-center justify-between border-b border-border/40 pb-2 text-xs">
                        <div className="flex flex-col">
                          <span className="font-semibold">{ws.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{ws.type}</span>
                        </div>
                        <span className="font-bold text-foreground">
                          {MultiCurrencyEngine.formatWithCurrency(bal, "INR")}
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-background/30">
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Recent Security Logs</CardTitle>
                  <CardDescription className="text-xs">Encrypted transaction audits & device tracking logs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {securityEvents.map(evt => (
                    <div key={evt.id} className="flex gap-2 items-start border-b border-border/40 pb-2 text-xs">
                      <div className={`mt-0.5 rounded-full p-1 ${
                        evt.severity === "critical" || evt.severity === "high" ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"
                      }`}>
                        <Shield className="h-3 w-3" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{evt.eventType}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-muted-foreground text-[10px]">{evt.description}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "workspaces" && (
          <div className="space-y-6">
            <Card className="border-border/60 bg-background/30">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Create New Workspace</CardTitle>
                <CardDescription className="text-xs">Separate tax liabilities and account tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateWorkspace} className="grid gap-4 md:grid-cols-4 items-end">
                  <div className="grid gap-1">
                    <label className="text-[10px] font-semibold uppercase text-muted-foreground">Workspace Name</label>
                    <Input
                      placeholder="e.g. Vacation Rentals LLC"
                      value={wsName}
                      onChange={e => setWsName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-[10px] font-semibold uppercase text-muted-foreground">Type</label>
                    <select
                      value={wsType}
                      onChange={e => setWsType(e.target.value as Workspace["type"])}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="personal">Personal</option>
                      <option value="family">Family</option>
                      <option value="business">Business</option>
                      <option value="rental">Rental</option>
                      <option value="parents">Parents</option>
                      <option value="side_hustle">Side Hustle</option>
                    </select>
                  </div>
                  <div className="grid gap-1">
                    <label className="text-[10px] font-semibold uppercase text-muted-foreground">Description</label>
                    <Input
                      placeholder="e.g. Side income from properties"
                      value={wsDesc}
                      onChange={e => setWsDesc(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <Button type="submit" size="sm" className="h-8 text-xs">
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add Workspace
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-background/30">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Active Workspaces List</CardTitle>
                <CardDescription className="text-xs">Manage segmented data partitions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {workspaces.map(ws => {
                  const wsState = WorkspaceEngine.getWorkspaceState(state, ws.id);
                  const accCount = wsState.accounts.length;
                  const txnCount = wsState.transactions.length;
                  return (
                    <div key={ws.id} className="flex items-center justify-between border-b border-border/40 pb-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{ws.name}</span>
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary uppercase">
                            {ws.type}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[10px] mt-0.5">{ws.description}</p>
                        <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                          <span>Accounts: <strong>{accCount}</strong></span>
                          <span>•</span>
                          <span>Transactions: <strong>{txnCount}</strong></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px]"
                          onClick={() => {
                            dispatch({ type: "profile:update", payload: { activeWorkspaceId: ws.id } });
                            toast.success(`Switched to: ${ws.name}`);
                          }}
                        >
                          Switch
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          disabled={ws.id === "personal"}
                          onClick={() => handleDeleteWorkspace(ws.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "rbac" && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="border-border/60 bg-background/30 md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Active User Identities & Roles</CardTitle>
                  <CardDescription className="text-xs">Current workspace access control roles configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border/45 pb-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">GF</div>
                      <div>
                        <span className="font-semibold text-foreground">Current Owner</span>
                        <p className="text-muted-foreground text-[10px]">{state.profile.email || "testuser_stabilized@example.com"}</p>
                      </div>
                    </div>
                    <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-500 uppercase">
                      Owner (All Access)
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-border/45 pb-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-semibold">CA</div>
                      <div>
                        <span className="font-semibold text-foreground">Corporate Auditor</span>
                        <p className="text-muted-foreground text-[10px]">auditor@gloriouscorp.in</p>
                      </div>
                    </div>
                    <select
                      className="rounded border border-input bg-background px-2 py-0.5 text-xs focus:outline-none"
                      defaultValue="accountant"
                      onChange={(e) => toast.success(`Auditor role changed to ${e.target.value}`)}
                    >
                      <option value="admin">Admin</option>
                      <option value="accountant">Accountant</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-background/30">
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Role Permissions Audit</CardTitle>
                  <CardDescription className="text-xs">Details of Role Access mappings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {RbacEngine.getRolesList().map(role => (
                    <div key={role.role} className="text-xs pb-2 border-b border-border/40">
                      <div className="flex items-center justify-between font-semibold">
                        <span>{role.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{role.permissions.length} perms</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {role.permissions.join(", ")}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/60 bg-background/30">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Session & OAuth Credential Logs</CardTitle>
                <CardDescription className="text-xs">Login timestamps, OAuth providers, and device fingerprints</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {sessions.map(sess => (
                  <div key={sess.id} className="flex items-center justify-between border-b border-border/40 pb-2 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{sess.deviceName}</span>
                        <span className="rounded bg-blue-500/10 px-1 py-0.2 text-[9px] font-medium text-blue-500 uppercase">
                          {sess.provider}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-[10px] mt-0.5">Location: {sess.location} • Last active: {new Date(sess.lastLogin).toLocaleString()}</p>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => toast.success("Session revoked")}>
                      Revoke
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "vault" && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="border-border/60 bg-background/30">
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Upload Statement or Invoice</CardTitle>
                  <CardDescription className="text-xs">Secure mock document storage</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUploadDoc} className="space-y-3 text-xs">
                    <div className="grid gap-1">
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground">Document Name</label>
                      <Input
                        placeholder="e.g. FY26_Q1_HDFCStatement.pdf"
                        value={docName}
                        onChange={e => setDocName(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground">Folder Category</label>
                      <select
                        value={docFolder}
                        onChange={e => setDocFolder(e.target.value as VaultFile["folder"])}
                        className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none"
                      >
                        <option value="Receipts">Receipts</option>
                        <option value="Invoices">Invoices</option>
                        <option value="Taxes">Taxes</option>
                        <option value="Statements">Statements</option>
                        <option value="Agreements">Agreements</option>
                        <option value="Policies">Policies</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="grid gap-1">
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground">Tags (comma-separated)</label>
                      <Input
                        placeholder="tax, salary, hdfc"
                        value={docTags}
                        onChange={e => setDocTags(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground">Expiry Date (optional)</label>
                      <Input
                        type="date"
                        value={docExpiry}
                        onChange={e => setDocExpiry(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <Button type="submit" size="sm" className="w-full h-8 text-xs">
                      <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload File
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-background/30 md:col-span-2">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold">Document Vault Archives</CardTitle>
                      <CardDescription className="text-xs">Secure storage workspace vault</CardDescription>
                    </div>
                    <div className="relative w-48">
                      <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search docs..."
                        value={vaultQuery}
                        onChange={e => setVaultQuery(e.target.value)}
                        className="h-7 pl-7 text-[10px]"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {vaultFiles
                    .filter(f => f.name.toLowerCase().includes(vaultQuery.toLowerCase()))
                    .map(file => (
                      <div key={file.id} className="flex items-center justify-between border-b border-border/40 pb-2.5 text-xs">
                        <div className="flex items-start gap-2.5">
                          <div className="rounded bg-primary/10 p-2 text-primary">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-foreground block">{file.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              Folder: <strong>{file.folder}</strong> • Size: {(file.sizeBytes / 1024).toFixed(0)} KB • Version: {file.version}
                            </span>
                            <div className="flex gap-1 mt-1">
                              {file.tags.map(t => (
                                <span key={t} className="rounded bg-muted px-1 py-0.2 text-[8px] text-muted-foreground">
                                  #{t}
                                </span>
                              ))}
                              {file.expiryDate && (
                                <span className="rounded bg-red-500/10 px-1 py-0.2 text-[8px] text-red-500 font-semibold flex items-center gap-0.5">
                                  <Calendar className="h-2 w-2" /> Expires: {file.expiryDate}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              toast.success(`Opening preview for ${file.name}`);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            onClick={() => handleDeleteDoc(file.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  {vaultFiles.length === 0 && (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      No documents in this workspace. Upload bank statements/policies above.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "flags" && (
          <div className="space-y-6">
            <Card className="border-border/60 bg-background/30">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Feature Flag Engine Manager</CardTitle>
                <CardDescription className="text-xs">
                  Toggle platform features globally or add custom overrides for the active workspace (<strong>{activeWorkspaceId}</strong>).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {featureFlags.map(flag => {
                  const isWorkspaceOverridden = flag.overridesByWorkspace && activeWorkspaceId in flag.overridesByWorkspace;
                  const currentStatus = isWorkspaceOverridden 
                    ? flag.overridesByWorkspace[activeWorkspaceId] 
                    : flag.enabledGlobal;

                  return (
                    <div key={flag.key} className="flex flex-col md:flex-row md:items-center justify-between border-b border-border/40 pb-3 gap-3">
                      <div className="max-w-md">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-foreground">{flag.name}</span>
                          <span className="text-[9px] font-mono text-muted-foreground">{flag.key}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{flag.description}</p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">Global:</span>
                          <Button
                            size="sm"
                            variant={flag.enabledGlobal ? "default" : "outline"}
                            className="h-7 text-[10px] px-2"
                            onClick={() => handleToggleFlag(flag.key, !flag.enabledGlobal)}
                          >
                            {flag.enabledGlobal ? "Enabled" : "Disabled"}
                          </Button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">Workspace Override:</span>
                          <Button
                            size="sm"
                            variant={isWorkspaceOverridden ? "default" : "outline"}
                            className="h-7 text-[10px] px-2"
                            onClick={() => handleToggleOverride(flag.key, activeWorkspaceId, !currentStatus)}
                          >
                            {isWorkspaceOverridden ? (currentStatus ? "Override ON" : "Override OFF") : "No Override"}
                          </Button>
                          {isWorkspaceOverridden && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-500"
                              onClick={() => {
                                const flagsCopy = [...featureFlags];
                                const currentFlag = flagsCopy.find(f => f.key === flag.key);
                                if (currentFlag?.overridesByWorkspace) {
                                  delete currentFlag.overridesByWorkspace[activeWorkspaceId];
                                  localStorage.setItem("gf_feature_flags", JSON.stringify(flagsCopy));
                                  loadAllData();
                                  toast.success("Override removed");
                                }
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "health" && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="border-border/60 bg-background/30 md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Latency, Workers, and Queue Performance</CardTitle>
                  <CardDescription className="text-xs">Real-time stats from data integration workers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 grid-cols-2 text-xs">
                    <div className="border border-border/40 p-3 rounded">
                      <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Active Sync queue</span>
                      <strong className="text-base text-foreground mt-1 block">{healthMetrics.syncQueueSize} tasks</strong>
                      <span className="text-[9px] text-muted-foreground">Syncing HDFC/SBI bank connector APIs</span>
                    </div>

                    <div className="border border-border/40 p-3 rounded">
                      <span className="text-[10px] text-muted-foreground uppercase block font-semibold">OCR Vision Queue</span>
                      <strong className="text-base text-foreground mt-1 block">{healthMetrics.ocrQueueSize} tasks</strong>
                      <span className="text-[9px] text-muted-foreground">Parsing PDF statements</span>
                    </div>

                    <div className="border border-border/40 p-3 rounded">
                      <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Background Sync Jobs</span>
                      <strong className="text-base text-emerald-500 mt-1 block">{healthMetrics.backgroundJobsCompleted} ok</strong>
                      <span className="text-[9px] text-muted-foreground">Completed in the last 24h</span>
                    </div>

                    <div className="border border-border/40 p-3 rounded">
                      <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Background Failures</span>
                      <strong className="text-base text-red-500 mt-1 block">{healthMetrics.backgroundJobsFailed} failed</strong>
                      <span className="text-[9px] text-muted-foreground">Due to timeout or token expiration</span>
                    </div>
                  </div>

                  <div className="border border-border/40 p-3 rounded text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase">Workspace Vault Storage Usage</span>
                      <span className="font-bold">{(healthMetrics.storageUsedBytes / (1024 * 1024)).toFixed(2)} MB / 1024 MB</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(healthMetrics.storageUsedBytes / healthMetrics.storageMaxBytes) * 100}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-background/30">
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Active Sync Workers</CardTitle>
                  <CardDescription className="text-xs">Background tasks currently running in the thread pool</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {SystemHealthEngine.getActiveJobs().map(job => (
                    <div key={job.id} className="text-xs border-b border-border/40 pb-2">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">{job.name}</span>
                        <span className={`px-1 rounded text-[8px] uppercase ${
                          job.status === "running" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                        }`}>{job.status}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Duration: {job.durationSec}s • Job ID: {job.id}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "audit" && (
          <div className="space-y-6">
            <Card className="border-border/60 bg-background/30">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold">Immutable Audit Logs Trail</CardTitle>
                    <CardDescription className="text-xs">Immutable ledger mutations, imports, and access events</CardDescription>
                  </div>
                  
                  <div className="flex gap-2">
                    <select
                      value={auditTypeFilter}
                      onChange={e => setAuditTypeFilter(e.target.value)}
                      className="rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none h-8"
                    >
                      <option value="all">All Logs</option>
                      <option value="login">Logins</option>
                      <option value="transaction">Transactions</option>
                      <option value="account">Accounts</option>
                      <option value="document">Documents</option>
                      <option value="bank_sync">Bank Syncs</option>
                    </select>

                    <div className="relative w-48">
                      <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                      <Input
                        placeholder="Search audit logs..."
                        value={auditQuery}
                        onChange={e => setAuditQuery(e.target.value)}
                        className="h-8 pl-7 text-[10px]"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[450px] overflow-y-auto border-t border-border/40">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/40 text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                        <th className="py-2.5 px-4">Timestamp</th>
                        <th className="py-2.5 px-4">User</th>
                        <th className="py-2.5 px-4">Workspace</th>
                        <th className="py-2.5 px-4">Target</th>
                        <th className="py-2.5 px-4">Action</th>
                        <th className="py-2.5 px-4">Details</th>
                        <th className="py-2.5 px-4">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAuditLogs.map(log => (
                        <tr key={log.id} className="border-b border-border/30 hover:bg-muted/15 transition-colors">
                          <td className="py-2 px-4 text-muted-foreground text-[10px] font-mono whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2 px-4 font-medium text-foreground">{log.user}</td>
                          <td className="py-2 px-4 uppercase text-muted-foreground font-semibold text-[9px]">{log.workspaceId}</td>
                          <td className="py-2 px-4 text-[10px] font-mono text-primary">{log.entity}</td>
                          <td className="py-2 px-4 font-semibold uppercase text-[9px] text-foreground">{log.action}</td>
                          <td className="py-2 px-4 text-muted-foreground max-w-xs truncate text-[10px]">{log.newValue || "-"}</td>
                          <td className="py-2 px-4 text-muted-foreground text-[10px] font-mono">{log.ipAddress || "system"}</td>
                        </tr>
                      ))}
                      {filteredAuditLogs.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-6 text-muted-foreground text-xs">
                            No matching audit log records.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

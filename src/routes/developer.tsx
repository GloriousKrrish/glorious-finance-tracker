import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import {
  Code2,
  Key,
  Globe,
  Webhook,
  Layers,
  Activity,
  Plus,
  Copy,
  Check,
  Play,
  Terminal,
  FileCode,
  Shield,
  Download,
  Trash2,
  RefreshCw,
  Sliders,
  CheckCircle,
  ExternalLink,
  BookOpen,
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

import {
  AuthLayer,
  ApiGateway,
  ApiAnalytics,
  ApiDocumentationEngine,
  SdkGenerator,
  WebhookPlatform,
  ConnectorSDK,
  ExtensionRegistry,
  type ApiKey,
  type WebhookEndpoint,
  type WebhookDeliveryLog,
  type ApiEndpointDoc,
  type ExtensionItem,
  type SdkLanguage
} from "@/lib/developer";

export const Route = createFileRoute("/developer")({
  component: DeveloperConsolePage,
});

type TabKey = "overview" | "keys" | "explorer" | "webhooks" | "extensions" | "sdk";

function DeveloperConsolePage() {
  const { state, activeWorkspaceId } = useStore();
  const [activeTab, setActiveTab] = React.useState<TabKey>("overview");

  // State
  const [apiKeys, setApiKeys] = React.useState<ApiKey[]>([]);
  const [endpoints, setEndpoints] = React.useState<WebhookEndpoint[]>([]);
  const [deliveryLogs, setDeliveryLogs] = React.useState<WebhookDeliveryLog[]>([]);
  const [extensions, setExtensions] = React.useState<ExtensionItem[]>([]);
  const [summary, setSummary] = React.useState(ApiAnalytics.getSummary(activeWorkspaceId));

  // Key Generator Modal State
  const [isKeyModalOpen, setIsKeyModalOpen] = React.useState(false);
  const [keyName, setKeyName] = React.useState("");
  const [keyRole, setKeyRole] = React.useState<ApiKey["role"]>("admin");
  const [generatedRawKey, setGeneratedRawKey] = React.useState<string | null>(null);

  // Webhook Modal State
  const [isWhModalOpen, setIsWhModalOpen] = React.useState(false);
  const [whUrl, setWhUrl] = React.useState("");
  const [whEvents, setWhEvents] = React.useState("TransactionCreated, BudgetExceeded");

  // API Explorer State
  const docs = ApiDocumentationEngine.getEndpointsDocumentation();
  const [selectedEndpoint, setSelectedEndpoint] = React.useState<ApiEndpointDoc>(docs[0]);
  const [explorerResponse, setExplorerResponse] = React.useState<any>(null);

  // SDK Generator State
  const [selectedSdkLang, setSelectedSdkLang] = React.useState<SdkLanguage>("typescript");
  const [copiedSdk, setCopiedSdk] = React.useState(false);

  const loadData = React.useCallback(() => {
    setApiKeys(AuthLayer.getApiKeys(activeWorkspaceId));
    setEndpoints(WebhookPlatform.getEndpoints(activeWorkspaceId));
    setDeliveryLogs(WebhookPlatform.getDeliveryLogs());
    setExtensions(ExtensionRegistry.getExtensions());
    setSummary(ApiAnalytics.getSummary(activeWorkspaceId));
  }, [activeWorkspaceId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) {
      toast.error("Key description name is required");
      return;
    }
    const { rawKey } = AuthLayer.generateApiKey(keyName, keyRole, activeWorkspaceId);
    setGeneratedRawKey(rawKey);
    toast.success("API Key generated successfully!");
    loadData();
  };

  const handleCreateWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whUrl.trim()) {
      toast.error("Webhook URL is required");
      return;
    }
    const eventsArr = whEvents.split(",").map(s => s.trim()).filter(Boolean);
    WebhookPlatform.createEndpoint(whUrl, eventsArr, activeWorkspaceId);
    toast.success("Webhook endpoint registered");
    setIsWhModalOpen(false);
    setWhUrl("");
    loadData();
  };

  const handleTestApiCall = (docItem: ApiEndpointDoc) => {
    const res = ApiGateway.handleRequest(docItem.method, docItem.path, state, undefined, activeWorkspaceId);
    setExplorerResponse(res);
    toast.success(`Executed ${docItem.method} ${docItem.path} (${res.metadata?.latencyMs}ms)`);
    loadData();
  };

  const handleCopyCode = (codeText: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedSdk(true);
    toast.success("Code snippet copied to clipboard");
    setTimeout(() => setCopiedSdk(false), 2000);
  };

  const tabs = [
    { key: "overview", label: "Analytics & Telemetry", icon: Activity },
    { key: "keys", label: "API Keys & Access Tokens", icon: Key },
    { key: "explorer", label: "API Explorer & Specs", icon: BookOpen },
    { key: "webhooks", label: "Webhook Subscriptions", icon: Webhook },
    { key: "extensions", label: "SDK Extensions Catalog", icon: Layers },
    { key: "sdk", label: "Client SDK Generator", icon: FileCode },
  ] as const;

  return (
    <div className="flex-1 space-y-8 p-6 md:p-8 pt-6">
      {/* Top Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">Developer Portal</h1>
          <p className="text-xs text-muted-foreground">
            REST API v1/v2 gateway, Personal Access Tokens, Plugin SDK, Webhook delivery pipeline, and OpenAPI documentation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsWhModalOpen(true)} className="h-8 text-xs">
            <Webhook className="mr-1.5 h-3.5 w-3.5" /> Add Webhook
          </Button>
          <Button size="sm" onClick={() => setIsKeyModalOpen(true)} className="h-8 text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Generate API Key
          </Button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/50 bg-background/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">Total API Requests</CardDescription>
            <CardTitle className="text-xl font-bold text-foreground">{summary.totalRequests}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">Gateway telemetry requests</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-background/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">Average Latency</CardDescription>
            <CardTitle className="text-xl font-bold text-emerald-500">{summary.avgLatencyMs} ms</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">Sub-50ms execution SLA</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-background/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">Error Rate</CardDescription>
            <CardTitle className="text-xl font-bold text-foreground">{summary.errorRatePercent}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">HTTP 4xx / 5xx responses</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-background/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">Active API Keys</CardDescription>
            <CardTitle className="text-xl font-bold text-foreground">{apiKeys.filter(k => k.enabled).length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">RBAC authorized credentials</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
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

      {/* Tab Contents */}
      <div className="mt-6">
        {/* OVERVIEW & TELEMETRY */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <Card className="border-border/60 bg-background/30">
              <CardHeader>
                <CardTitle className="text-sm font-bold">API Endpoint Usage Breakdown</CardTitle>
                <CardDescription className="text-xs">Top consumed endpoints in active workspace</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-xs">
                  {Object.entries(summary.requestsByEndpoint).length === 0 ? (
                    <div className="py-6 text-center text-muted-foreground">No request logs recorded yet.</div>
                  ) : (
                    Object.entries(summary.requestsByEndpoint).map(([path, count]) => (
                      <div key={path} className="flex items-center justify-between border-b border-border/40 pb-2">
                        <span className="font-mono font-semibold text-primary">{path}</span>
                        <span className="font-mono text-muted-foreground">{count} requests</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* API KEYS */}
        {activeTab === "keys" && (
          <div className="space-y-6">
            <Card className="border-border/60 bg-background/30">
              <CardHeader>
                <CardTitle className="text-sm font-bold">API Secret Keys & Access Tokens</CardTitle>
                <CardDescription className="text-xs">Manage bearer credentials used to authenticate against Financial OS REST APIs.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border/40">
                  {apiKeys.map(k => (
                    <div key={k.id} className="flex flex-col gap-2 py-3.5 md:flex-row md:items-center md:justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2 font-bold text-foreground">
                          <Key className="h-3.5 w-3.5 text-primary" />
                          {k.name}
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground uppercase">{k.role}</span>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground block mt-0.5">{k.keyPrefix}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={k.enabled ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            AuthLayer.toggleApiKey(k.id, !k.enabled);
                            loadData();
                          }}
                          className="h-7 text-[10px]"
                        >
                          {k.enabled ? "Active" : "Revoked"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            AuthLayer.revokeApiKey(k.id);
                            loadData();
                          }}
                          className="h-7 text-[10px] text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* API EXPLORER & SPECS */}
        {activeTab === "explorer" && (
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-border/60 bg-background/40 md:col-span-1">
              <CardHeader>
                <CardTitle className="text-sm font-bold">OpenAPI v1/v2 Endpoints</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {docs.map(item => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedEndpoint(item);
                      setExplorerResponse(null);
                    }}
                    className={`rounded-md p-2.5 cursor-pointer text-xs transition-colors ${
                      selectedEndpoint.id === item.id ? "bg-primary/15 border border-primary/40 font-bold" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-primary/20 px-1 py-0.5 font-mono text-[9px] font-bold text-primary">{item.method}</span>
                      <span className="font-mono text-[11px] truncate">{item.path}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground block mt-1">{item.title}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-background/30 md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <span className="rounded bg-primary px-1.5 py-0.5 font-mono text-xs text-primary-foreground">{selectedEndpoint.method}</span>
                    <span className="font-mono">{selectedEndpoint.path}</span>
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">{selectedEndpoint.description}</CardDescription>
                </div>
                <Button size="sm" onClick={() => handleTestApiCall(selectedEndpoint)} className="h-8 text-xs">
                  <Play className="h-3 w-3 mr-1.5" /> Execute Test Call
                </Button>
              </CardHeader>

              <CardContent className="space-y-4 text-xs">
                <div>
                  <span className="font-semibold block text-muted-foreground mb-1">Required RBAC Permission:</span>
                  <span className="rounded bg-muted px-2 py-1 font-mono text-[10px] text-foreground">{selectedEndpoint.permissionRequired}</span>
                </div>

                <div>
                  <span className="font-semibold block text-muted-foreground mb-1">Request Headers:</span>
                  <pre className="rounded bg-muted/40 p-2.5 font-mono text-[10px] text-foreground border border-border/40">
                    {JSON.stringify(selectedEndpoint.requestHeaders, null, 2)}
                  </pre>
                </div>

                {explorerResponse ? (
                  <div>
                    <span className="font-semibold block text-emerald-500 mb-1">Live Response Output (HTTP 200):</span>
                    <pre className="max-h-[300px] overflow-y-auto rounded bg-zinc-950 p-3 font-mono text-[10px] text-emerald-400 border border-emerald-500/30">
                      {JSON.stringify(explorerResponse, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div>
                    <span className="font-semibold block text-muted-foreground mb-1">Sample Response Schema:</span>
                    <pre className="max-h-[250px] overflow-y-auto rounded bg-muted/30 p-3 font-mono text-[10px] text-muted-foreground border border-border/40">
                      {JSON.stringify(selectedEndpoint.responseExample, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* WEBHOOKS PLATFORM */}
        {activeTab === "webhooks" && (
          <div className="space-y-6">
            <Card className="border-border/60 bg-background/30">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Registered Webhook Endpoints</CardTitle>
                <CardDescription className="text-xs">Receive HTTP POST payloads when events occur in the Financial OS.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border/40 text-xs">
                  {endpoints.map(ep => (
                    <div key={ep.id} className="py-3 flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-foreground block">{ep.url}</span>
                        <span className="text-[10px] text-muted-foreground">Secret: {ep.secret} • Subscribed: {ep.events.join(", ")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            WebhookPlatform.dispatchWebhook(ep.events[0] || "TransactionCreated", { amount: 5000 }, activeWorkspaceId);
                            toast.success(`Dispatched sample webhook to ${ep.url}`);
                            loadData();
                          }}
                          className="h-7 text-[10px]"
                        >
                          Test Payload
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => WebhookPlatform.deleteEndpoint(ep.id)} className="h-7 text-[10px] text-red-500">
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-background/30">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Recent Delivery Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border/40 font-mono text-xs">
                  {deliveryLogs.map(log => (
                    <div key={log.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-emerald-500 mr-2">[{log.statusCode}]</span>
                        <span className="text-foreground">{log.event}</span>
                        <span className="text-muted-foreground text-[10px] block">{log.url}</span>
                      </div>
                      <div className="text-right text-[10px] text-muted-foreground">
                        <div>{log.durationMs}ms</div>
                        <div>{log.deliveredAt.slice(11, 19)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* EXTENSIONS CATALOG */}
        {activeTab === "extensions" && (
          <div className="grid gap-4 md:grid-cols-2">
            {extensions.map(ext => (
              <Card key={ext.id} className="border-border/60 bg-background/40">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold">{ext.name}</CardTitle>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary uppercase">
                      {ext.type}
                    </span>
                  </div>
                  <CardDescription className="text-xs">{ext.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Author: {ext.author}</span>
                    <span>Rating: ★ {ext.rating}</span>
                  </div>
                  <Button
                    variant={ext.installed ? "outline" : "default"}
                    size="sm"
                    onClick={() => {
                      ExtensionRegistry.toggleInstall(ext.id, !ext.installed);
                      toast.success(`${ext.name} ${ext.installed ? "uninstalled" : "installed"}`);
                      loadData();
                    }}
                    className="w-full text-xs h-8"
                  >
                    {ext.installed ? "Uninstall Extension" : "Install SDK Extension"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* SDK GENERATOR */}
        {activeTab === "sdk" && (
          <div className="space-y-6">
            <Card className="border-border/60 bg-background/30">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">Client SDK Code Snippet Generator</CardTitle>
                  <CardDescription className="text-xs">Generate ready-to-paste client code to integrate Financial OS APIs.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={selectedSdkLang === "typescript" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSdkLang("typescript")}
                    className="h-7 text-xs"
                  >
                    TypeScript
                  </Button>
                  <Button
                    variant={selectedSdkLang === "python" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSdkLang("python")}
                    className="h-7 text-xs"
                  >
                    Python
                  </Button>
                  <Button
                    variant={selectedSdkLang === "curl" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSdkLang("curl")}
                    className="h-7 text-xs"
                  >
                    cURL
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <pre className="rounded-lg bg-zinc-950 p-4 font-mono text-xs text-emerald-400 overflow-x-auto border border-border/60">
                    {SdkGenerator.generateCodeSnippet(selectedSdkLang, selectedEndpoint.path, selectedEndpoint.method)}
                  </pre>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyCode(SdkGenerator.generateCodeSnippet(selectedSdkLang, selectedEndpoint.path, selectedEndpoint.method))}
                    className="absolute right-3 top-3 h-7 text-[10px]"
                  >
                    {copiedSdk ? <Check className="h-3 w-3 text-emerald-500 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copiedSdk ? "Copied!" : "Copy Code"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Generate Key Modal */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-display text-base font-bold text-foreground">Generate New API Secret Key</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsKeyModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {generatedRawKey ? (
              <div className="space-y-4 text-xs">
                <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-500 font-medium">
                  Important: Save this key immediately! It will not be displayed again.
                </div>
                <div className="relative">
                  <Input readOnly value={generatedRawKey} className="font-mono text-xs pr-10" />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1 h-7 w-7"
                    onClick={() => handleCopyCode(generatedRawKey)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button className="w-full text-xs h-8" onClick={() => { setIsKeyModalOpen(false); setGeneratedRawKey(null); }}>
                  Done & Close
                </Button>
              </div>
            ) : (
              <form onSubmit={handleGenerateKey} className="space-y-4 text-xs">
                <div className="grid gap-2">
                  <label className="font-semibold">Key Description Name</label>
                  <Input
                    placeholder="e.g. Production Billing Sync Service"
                    value={keyName}
                    onChange={e => setKeyName(e.target.value)}
                    className="h-8.5 text-xs"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="font-semibold">Assigned RBAC Role</label>
                  <select
                    value={keyRole}
                    onChange={e => setKeyRole(e.target.value as any)}
                    className="h-8.5 rounded border border-input bg-background px-3 text-xs"
                  >
                    <option value="owner">Owner (Full Permissions)</option>
                    <option value="admin">Administrator</option>
                    <option value="accountant">Accountant</option>
                    <option value="viewer">Read-Only Viewer</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsKeyModalOpen(false)} className="h-8 text-xs">
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="h-8 text-xs">
                    Generate Secret Key
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add Webhook Modal */}
      {isWhModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-display text-base font-bold text-foreground">Register Outgoing Webhook Endpoint</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsWhModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateWebhook} className="space-y-4 text-xs">
              <div className="grid gap-2">
                <label className="font-semibold">Endpoint HTTPS URL</label>
                <Input
                  placeholder="https://api.yourdomain.com/webhooks"
                  value={whUrl}
                  onChange={e => setWhUrl(e.target.value)}
                  className="h-8.5 text-xs font-mono"
                />
              </div>

              <div className="grid gap-2">
                <label className="font-semibold">Subscribed Event Types (Comma-separated)</label>
                <Input
                  placeholder="TransactionCreated, GoalCompleted, BudgetExceeded"
                  value={whEvents}
                  onChange={e => setWhEvents(e.target.value)}
                  className="h-8.5 text-xs font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsWhModalOpen(false)} className="h-8 text-xs">
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="h-8 text-xs">
                  Register Webhook
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

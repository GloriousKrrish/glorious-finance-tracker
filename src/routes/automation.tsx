import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import {
  Zap,
  Play,
  Pause,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Layers,
  FileText,
  Trash2,
  Sliders,
  Bell,
  ArrowRight,
  Shield,
  Search,
  RotateCcw,
  Sparkles,
  Bot,
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

import {
  EventBus,
  WorkflowEngine,
  SchedulerEngine,
  JobQueueEngine,
  DeadLetterQueue,
  AutomationRegistry,
  AITaskQueue,
  type Workflow,
  type BackgroundJob,
  type ScheduledTask,
  type DeadLetterItem,
  type SystemEvent,
  type SystemEventType
} from "@/lib/automation";

export const Route = createFileRoute("/automation")({
  component: AutomationPlatformPage,
});

type TabKey = "dashboard" | "workflows" | "registry" | "scheduler" | "dlq" | "events";

function AutomationPlatformPage() {
  const { activeWorkspaceId } = useStore();
  const [activeTab, setActiveTab] = React.useState<TabKey>("dashboard");

  // Engines Data State
  const [workflows, setWorkflows] = React.useState<Workflow[]>([]);
  const [jobs, setJobs] = React.useState<BackgroundJob[]>([]);
  const [tasks, setTasks] = React.useState<ScheduledTask[]>([]);
  const [dlqItems, setDlqItems] = React.useState<DeadLetterItem[]>([]);
  const [events, setEvents] = React.useState<SystemEvent[]>([]);

  // Workflow Builder Modal State
  const [isBuilderOpen, setIsBuilderOpen] = React.useState(false);
  const [wfName, setWfName] = React.useState("");
  const [wfDesc, setWfDesc] = React.useState("");
  const [wfTrigger, setWfTrigger] = React.useState<SystemEventType>("TransactionCreated");
  const [wfConditionField, setWfConditionField] = React.useState("amount");
  const [wfConditionOp, setWfConditionOp] = React.useState("greater_than");
  const [wfConditionVal, setWfConditionVal] = React.useState("5000");
  const [wfActionType, setWfActionType] = React.useState<"notification" | "background_job">("notification");
  const [wfActionMsg, setWfActionMsg] = React.useState("High value transaction created!");
  const [wfRequiresApproval, setWfRequiresApproval] = React.useState(false);

  // New Scheduler Task Form State
  const [taskName, setTaskName] = React.useState("");
  const [taskJobType, setTaskJobType] = React.useState("bank_sync");
  const [taskFreq, setTaskFreq] = React.useState<any>("daily");

  const loadData = React.useCallback(() => {
    setWorkflows(WorkflowEngine.getWorkflows(activeWorkspaceId));
    setJobs(JobQueueEngine.getJobs(activeWorkspaceId));
    setTasks(SchedulerEngine.getTasks(activeWorkspaceId));
    setDlqItems(DeadLetterQueue.getItems().filter(i => i.workspaceId === activeWorkspaceId));
    setEvents(EventBus.getEventHistory(activeWorkspaceId));
  }, [activeWorkspaceId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  const handleToggleWorkflow = (id: string, enabled: boolean) => {
    WorkflowEngine.toggleWorkflow(id, enabled);
    toast.success(`Workflow ${enabled ? "enabled" : "disabled"}`);
    loadData();
  };

  const handleRunWorkflowManually = (wf: Workflow) => {
    WorkflowEngine.executeWorkflowActions(wf);
    toast.success(`Executed workflow: ${wf.name}`);
    loadData();
  };

  const handleSaveNewWorkflow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wfName.trim()) {
      toast.error("Workflow name is required");
      return;
    }

    const newWf: Workflow = {
      id: `wf_${Math.random().toString(36).substring(2, 9)}`,
      name: wfName,
      description: wfDesc || "Custom user-built automation workflow",
      triggerEvent: wfTrigger,
      ruleGroup: {
        logic: "AND",
        conditions: [
          {
            id: "c_1",
            field: wfConditionField,
            operator: wfConditionOp as any,
            value: wfConditionVal
          }
        ]
      },
      actions: [
        {
          id: "act_1",
          type: wfActionType,
          title: wfName,
          config: {
            messageTemplate: wfActionMsg,
            jobType: "cleanup_job",
            priority: "normal"
          }
        }
      ],
      requiresApproval: wfRequiresApproval,
      enabled: true,
      workspaceId: activeWorkspaceId,
      executionCount: 0
    };

    WorkflowEngine.saveWorkflow(newWf);
    toast.success(`Created workflow: ${newWf.name}`);
    setIsBuilderOpen(false);
    setWfName("");
    setWfDesc("");
    loadData();
  };

  const handleTriggerSimulatedEvent = () => {
    const evt = EventBus.publish(
      "TransactionCreated",
      { amount: 35000, merchant: "Apple Store", category: "Electronics" },
      activeWorkspaceId
    );
    WorkflowEngine.processEvent(evt);
    toast.success("Dispatched sample TransactionCreated event (₹35,000)");
    loadData();
  };

  const handleTriggerAITask = () => {
    AITaskQueue.enqueueAITask("generate_summary", activeWorkspaceId);
    toast.success("Enqueued AI Summary generation task into background queue");
    loadData();
  };

  const handleRetryDlq = (item: DeadLetterItem) => {
    JobQueueEngine.retryJobNow(item.jobId);
    DeadLetterQueue.removeItem(item.id);
    toast.success(`Requeued job ${item.jobName} for processing`);
    loadData();
  };

  const handleDiscardDlq = (id: string) => {
    DeadLetterQueue.removeItem(id);
    toast.info("DLQ item discarded");
    loadData();
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) {
      toast.error("Task name is required");
      return;
    }
    SchedulerEngine.addTask(taskName, taskJobType, taskFreq, activeWorkspaceId);
    toast.success(`Scheduled task "${taskName}" created`);
    setTaskName("");
    loadData();
  };

  const tabs = [
    { key: "dashboard", label: "Dashboard & Jobs", icon: Layers },
    { key: "workflows", label: "Workflows & Builder", icon: Zap },
    { key: "registry", label: "Registry Templates", icon: Sliders },
    { key: "scheduler", label: "Cron Scheduler", icon: Calendar },
    { key: "dlq", label: `Dead Letter Queue (${dlqItems.length})`, icon: AlertTriangle },
    { key: "events", label: "Event Stream", icon: Clock },
  ] as const;

  return (
    <div className="flex-1 space-y-8 p-6 md:p-8 pt-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">Automation Platform</h1>
          <p className="text-xs text-muted-foreground">
            Event-driven workflow engine, background worker queues, cron scheduler, and AI task orchestrator.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleTriggerSimulatedEvent} className="h-8 text-xs">
            <Zap className="mr-1.5 h-3.5 w-3.5 text-amber-500" /> Dispatch Test Event
          </Button>
          <Button variant="outline" size="sm" onClick={handleTriggerAITask} className="h-8 text-xs">
            <Bot className="mr-1.5 h-3.5 w-3.5 text-primary" /> Enqueue AI Task
          </Button>
          <Button size="sm" onClick={() => setIsBuilderOpen(true)} className="h-8 text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Build Workflow
          </Button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/50 bg-background/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">Active Workflows</CardDescription>
            <CardTitle className="text-xl font-bold text-foreground">{workflows.filter(w => w.enabled).length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">{workflows.length} total registered</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-background/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">Background Jobs Queue</CardDescription>
            <CardTitle className="text-xl font-bold text-foreground">{jobs.filter(j => j.status === "pending" || j.status === "running").length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">{jobs.length} total in ledger history</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-background/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">Dead Letter Queue</CardDescription>
            <CardTitle className={`text-xl font-bold ${dlqItems.length > 0 ? "text-amber-500" : "text-emerald-500"}`}>
              {dlqItems.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">Exceeded max retries</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-background/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold">Event Bus Stream</CardDescription>
            <CardTitle className="text-xl font-bold text-foreground">{events.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">Immutable events logged</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Bar */}
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
        {/* DASHBOARD & JOB MONITOR */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <Card className="border-border/60 bg-background/30">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">Background Job Queue Monitor</CardTitle>
                  <CardDescription className="text-xs">Live status of worker jobs (Bank Sync, OCR, AI, Reports, Cleanup)</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => JobQueueEngine.clearCompletedJobs()} className="h-7 text-xs">
                  Clear Completed
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground">
                        <th className="py-2 font-medium">Job Name</th>
                        <th className="py-2 font-medium">Type</th>
                        <th className="py-2 font-medium">Priority</th>
                        <th className="py-2 font-medium">Status</th>
                        <th className="py-2 font-medium">Progress</th>
                        <th className="py-2 font-medium">Attempts</th>
                        <th className="py-2 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {jobs.map(job => (
                        <tr key={job.id} className="hover:bg-muted/20">
                          <td className="py-3 font-semibold text-foreground">{job.name}</td>
                          <td className="py-3 font-mono text-[10px] text-muted-foreground">{job.type}</td>
                          <td className="py-3">
                            <span className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                              job.priority === "critical" ? "bg-red-500/10 text-red-500" :
                              job.priority === "high" ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"
                            }`}>
                              {job.priority}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                              job.status === "completed" ? "text-emerald-500" :
                              job.status === "running" ? "text-blue-500" :
                              job.status === "failed" ? "text-red-500" : "text-muted-foreground"
                            }`}>
                              {job.status === "completed" && <CheckCircle className="h-3 w-3" />}
                              {job.status === "running" && <RefreshCw className="h-3 w-3 animate-spin" />}
                              {job.status}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${job.progressPercent}%` }} />
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground">{job.progressPercent}%</span>
                            </div>
                          </td>
                          <td className="py-3 font-mono text-muted-foreground">{job.attemptsMade} / {job.maxRetries}</td>
                          <td className="py-3 text-right">
                            {job.status === "running" || job.status === "pending" ? (
                              <Button variant="ghost" size="sm" onClick={() => JobQueueEngine.cancelJob(job.id)} className="h-6 text-[10px] text-red-500">
                                Cancel
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => JobQueueEngine.retryJobNow(job.id)} className="h-6 text-[10px]">
                                Re-run
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* WORKFLOWS & VISUAL BUILDER */}
        {activeTab === "workflows" && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {workflows.map(wf => (
                <Card key={wf.id} className="border-border/60 bg-background/40">
                  <CardHeader className="pb-3 flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Zap className={`h-4 w-4 ${wf.enabled ? "text-amber-500" : "text-muted-foreground"}`} />
                        {wf.name}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">{wf.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant={wf.enabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleToggleWorkflow(wf.id, !wf.enabled)}
                        className="h-7 text-[10px]"
                      >
                        {wf.enabled ? "Enabled" : "Disabled"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleRunWorkflowManually(wf)} className="h-7 text-[10px]">
                        <Play className="h-3 w-3 mr-1" /> Run
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 border-t border-border/40 pt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Trigger Event:</span>
                      <span className="font-mono text-primary font-semibold">{wf.triggerEvent}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Approval Required:</span>
                      <span className="font-semibold text-foreground">{wf.requiresApproval ? "Yes (Manual)" : "Automatic"}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Execution Count:</span>
                      <span className="font-mono text-foreground">{wf.executionCount || 0} times</span>
                    </div>

                    {wf.actions.length > 0 && (
                      <div className="rounded border border-border/40 bg-muted/20 p-2 text-[11px]">
                        <span className="font-semibold block text-muted-foreground mb-1">Configured Actions:</span>
                        {wf.actions.map(act => (
                          <div key={act.id} className="flex items-center gap-1 text-foreground font-medium">
                            <ArrowRight className="h-3 w-3 text-primary" />
                            <span>{act.title}</span>
                            <span className="text-[9px] text-muted-foreground">({act.type})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* REGISTRY TEMPLATES */}
        {activeTab === "registry" && (
          <div className="grid gap-4 md:grid-cols-2">
            {AutomationRegistry.getTemplates().map(tpl => (
              <Card key={tpl.id} className="border-border/60 bg-background/40">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold">{tpl.name}</CardTitle>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary uppercase">
                      {tpl.category}
                    </span>
                  </div>
                  <CardDescription className="text-xs">{tpl.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Recommended Cadence:</span>
                    <span className="font-semibold text-foreground">{tpl.recommendedFrequency}</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      WorkflowEngine.saveWorkflow({
                        ...tpl.templateWorkflow,
                        id: `wf_${Math.random().toString(36).substring(2, 9)}`,
                        workspaceId: activeWorkspaceId,
                        executionCount: 0
                      });
                      toast.success(`Installed template workflow: ${tpl.name}`);
                      loadData();
                    }}
                    className="w-full text-xs h-8 mt-2"
                  >
                    Install Automation Workflow
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* SCHEDULER */}
        {activeTab === "scheduler" && (
          <div className="space-y-6">
            <Card className="border-border/60 bg-background/40">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Schedule New Recurring Job</CardTitle>
                <CardDescription className="text-xs">Timezone-aware scheduler for automated background execution</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateTask} className="grid gap-4 md:grid-cols-4">
                  <Input
                    placeholder="Task Name (e.g. Daily Reconciliation)"
                    value={taskName}
                    onChange={e => setTaskName(e.target.value)}
                    className="h-8.5 text-xs"
                  />
                  <select
                    value={taskJobType}
                    onChange={e => setTaskJobType(e.target.value)}
                    className="h-8.5 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="bank_sync">Bank Sync</option>
                    <option value="report_generation">Report Generation</option>
                    <option value="ai_job">AI Commentary</option>
                    <option value="ocr_job">OCR Processing</option>
                    <option value="cleanup_job">Database Cleanup</option>
                  </select>
                  <select
                    value={taskFreq}
                    onChange={e => setTaskFreq(e.target.value)}
                    className="h-8.5 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                  <Button type="submit" size="sm" className="h-8.5 text-xs">
                    Schedule Task
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-background/30">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Active Scheduled Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border/40">
                  {tasks.map(t => (
                    <div key={t.id} className="flex items-center justify-between py-3 text-xs">
                      <div>
                        <span className="font-semibold text-foreground block">{t.name}</span>
                        <span className="text-[10px] text-muted-foreground">Frequency: {t.frequency} ({t.timezone})</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-[10px] text-muted-foreground">
                          <div>Next Run: {t.nextRun.slice(0, 16).replace("T", " ")}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            SchedulerEngine.deleteTask(t.id);
                            loadData();
                          }}
                          className="h-6 text-red-500"
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

        {/* DEAD LETTER QUEUE */}
        {activeTab === "dlq" && (
          <div className="space-y-6">
            <Card className="border-border/60 bg-background/30">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-amber-500 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Dead Letter Queue (DLQ)
                  </CardTitle>
                  <CardDescription className="text-xs">Jobs that failed and exceeded maximum retry limits</CardDescription>
                </div>
                {dlqItems.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => DeadLetterQueue.clearAll()} className="h-7 text-xs text-red-500">
                    Clear All DLQ Items
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {dlqItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No failed jobs in the Dead Letter Queue. All queues operate normally.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dlqItems.map(item => (
                      <div key={item.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">{item.jobName}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">Failed at {item.failedAt.slice(0, 16).replace("T", " ")}</span>
                        </div>
                        <p className="text-red-400 font-mono text-[11px] bg-red-950/30 p-2 rounded border border-red-500/20">
                          {item.lastError}
                        </p>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-[10px] text-muted-foreground">Queue: {item.queueName} • Attempts: {item.attemptsMade}/{item.maxRetries}</span>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleRetryDlq(item)} className="h-7 text-xs">
                              <RotateCcw className="h-3 w-3 mr-1" /> Re-run Job
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDiscardDlq(item.id)} className="h-7 text-xs text-red-500">
                              Discard
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* EVENT STREAM */}
        {activeTab === "events" && (
          <Card className="border-border/60 bg-background/30">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Event Bus Stream</CardTitle>
              <CardDescription className="text-xs">Immutable system events published across the Financial OS</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-y-auto divide-y divide-border/40 font-mono text-xs">
                {events.map(evt => (
                  <div key={evt.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-bold">{evt.type}</span>
                      <span className="text-muted-foreground text-[10px]">{JSON.stringify(evt.payload)}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{evt.timestamp.slice(11, 19)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Visual Workflow Builder Modal */}
      {isBuilderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-display text-base font-bold text-foreground">Visual Workflow Builder</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsBuilderOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveNewWorkflow} className="space-y-4 text-xs">
              <div className="grid gap-2">
                <label className="font-semibold">Workflow Name</label>
                <Input
                  placeholder="e.g. Large Transaction Alert"
                  value={wfName}
                  onChange={e => setWfName(e.target.value)}
                  className="h-8.5 text-xs"
                />
              </div>

              {/* STEP 1: TRIGGER */}
              <div className="rounded border border-primary/30 bg-primary/5 p-3 space-y-2">
                <span className="font-bold text-primary block">Step 1: Trigger Event</span>
                <select
                  value={wfTrigger}
                  onChange={e => setWfTrigger(e.target.value as any)}
                  className="h-8.5 w-full rounded border border-input bg-background px-3 text-xs"
                >
                  <option value="TransactionCreated">TransactionCreated</option>
                  <option value="GoalCompleted">GoalCompleted</option>
                  <option value="BillOverdue">BillOverdue</option>
                  <option value="BudgetExceeded">BudgetExceeded</option>
                  <option value="DocumentUploaded">DocumentUploaded</option>
                  <option value="SecurityAlert">SecurityAlert</option>
                </select>
              </div>

              {/* STEP 2: CONDITION */}
              <div className="rounded border border-border/60 bg-muted/20 p-3 space-y-2">
                <span className="font-bold text-foreground block">Step 2: Condition Rule</span>
                <div className="grid grid-cols-3 gap-2">
                  <Input value={wfConditionField} onChange={e => setWfConditionField(e.target.value)} className="h-8 text-xs" placeholder="Field" />
                  <select value={wfConditionOp} onChange={e => setWfConditionOp(e.target.value)} className="h-8 rounded border bg-background text-xs px-2">
                    <option value="greater_than">Greater Than</option>
                    <option value="less_than">Less Than</option>
                    <option value="equals">Equals</option>
                    <option value="contains">Contains</option>
                  </select>
                  <Input value={wfConditionVal} onChange={e => setWfConditionVal(e.target.value)} className="h-8 text-xs" placeholder="Value" />
                </div>
              </div>

              {/* STEP 3: ACTION */}
              <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                <span className="font-bold text-emerald-500 block">Step 3: Action</span>
                <select value={wfActionType} onChange={e => setWfActionType(e.target.value as any)} className="h-8.5 w-full rounded border border-input bg-background px-3 text-xs">
                  <option value="notification">Create In-App Notification</option>
                  <option value="background_job">Enqueue Background Worker Job</option>
                </select>
                <Input value={wfActionMsg} onChange={e => setWfActionMsg(e.target.value)} className="h-8 text-xs mt-2" placeholder="Message template" />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="wf-approval"
                  checked={wfRequiresApproval}
                  onChange={e => setWfRequiresApproval(e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="wf-approval" className="font-medium text-muted-foreground">Require manual user approval before execution</label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border/60">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsBuilderOpen(false)} className="h-8 text-xs">
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="h-8 text-xs">
                  Save Workflow
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

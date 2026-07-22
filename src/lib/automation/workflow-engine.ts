import { EventBus, type SystemEventType, type SystemEvent } from "./event-bus";
import { RuleEngine, type RuleGroup } from "./rule-engine";
import { NotificationRouter, type NotificationChannel } from "./notification-router";
import { JobQueueEngine } from "./job-queue";
import { AuditLogEngine } from "../enterprise/audit";

export type WorkflowActionType =
  | "notification"
  | "background_job"
  | "ai_task"
  | "webhook"
  | "audit_event";

export interface WorkflowAction {
  id: string;
  type: WorkflowActionType;
  title: string;
  config: {
    channel?: NotificationChannel;
    jobType?: string;
    aiTaskType?: string;
    webhookUrl?: string;
    messageTemplate?: string;
    priority?: "low" | "normal" | "high" | "critical";
  };
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  triggerEvent: SystemEventType;
  ruleGroup: RuleGroup;
  actions: WorkflowAction[];
  requiresApproval: boolean;
  enabled: boolean;
  workspaceId: string;
  executionCount: number;
  lastExecutedAt?: string;
}

export class WorkflowEngine {
  private static STORAGE_KEY = "gf_workflows";

  public static getWorkflows(workspaceId?: string): Workflow[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    const list: Workflow[] = raw ? JSON.parse(raw) : this.getSeedWorkflows();
    if (workspaceId) {
      return list.filter(w => w.workspaceId === workspaceId);
    }
    return list;
  }

  public static saveWorkflow(workflow: Workflow): void {
    const list = this.getWorkflows();
    const idx = list.findIndex(w => w.id === workflow.id);
    if (idx >= 0) {
      list[idx] = workflow;
    } else {
      list.unshift(workflow);
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
  }

  public static deleteWorkflow(id: string): void {
    const list = this.getWorkflows().filter(w => w.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
  }

  public static toggleWorkflow(id: string, enabled: boolean): void {
    const list = this.getWorkflows();
    const wf = list.find(w => w.id === id);
    if (wf) {
      wf.enabled = enabled;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
    }
  }

  /**
   * Process an incoming system event against registered active workflows.
   */
  public static processEvent(event: SystemEvent): void {
    const workflows = this.getWorkflows(event.workspaceId);
    const matchingWorkflows = workflows.filter(w => w.enabled && w.triggerEvent === event.type);

    matchingWorkflows.forEach(wf => {
      // Evaluate Rule Conditions
      const passesConditions = RuleEngine.evaluateGroup(wf.ruleGroup, event.payload);
      if (!passesConditions) return;

      if (wf.requiresApproval) {
        // Queue for User Approval
        console.log(`[WorkflowEngine] Workflow "${wf.name}" triggered, pending user approval.`);
        NotificationRouter.route(
          `Approval Required: ${wf.name}`,
          `Event "${event.type}" requires your manual authorization before executing workflow actions.`,
          "system",
          "high",
          "/automation?tab=workflows",
          ["in_app"]
        );
        return;
      }

      // Execute Workflow Actions directly
      this.executeWorkflowActions(wf, event);
    });
  }

  public static executeWorkflowActions(wf: Workflow, event?: SystemEvent): void {
    wf.actions.forEach(action => {
      switch (action.type) {
        case "notification":
          NotificationRouter.route(
            action.title || wf.name,
            action.config.messageTemplate || `Automated workflow action triggered for ${wf.name}`,
            "system",
            action.config.priority || "normal",
            "/automation",
            [action.config.channel || "in_app"]
          );
          break;

        case "background_job":
          JobQueueEngine.enqueue(
            action.title || `Job: ${wf.name}`,
            (action.config.jobType as any) || "cleanup_job",
            action.config.priority || "normal",
            wf.workspaceId
          );
          break;

        case "audit_event":
          AuditLogEngine.log({
            user: "workflow_engine",
            workspaceId: wf.workspaceId,
            entity: "settings",
            action: "trigger",
            newValue: `Workflow executed: ${wf.name}`,
            result: "success"
          });
          break;
      }
    });

    // Update execution stats
    wf.executionCount = (wf.executionCount || 0) + 1;
    wf.lastExecutedAt = new Date().toISOString();
    this.saveWorkflow(wf);
  }

  private static getSeedWorkflows(): Workflow[] {
    const seeds: Workflow[] = [
      {
        id: "wf_1",
        name: "High Expense Transaction Security Alert",
        description: "Sends an immediate alert when a transaction exceeds ₹25,000.",
        triggerEvent: "TransactionCreated",
        ruleGroup: {
          logic: "AND",
          conditions: [
            { id: "c1", field: "amount", operator: "greater_than", value: 25000 }
          ]
        },
        actions: [
          {
            id: "a1",
            type: "notification",
            title: "High Value Expense Detected",
            config: {
              channel: "in_app",
              priority: "high",
              messageTemplate: "A transaction over ₹25,000 was created. Click to verify details."
            }
          }
        ],
        requiresApproval: false,
        enabled: true,
        workspaceId: "personal",
        executionCount: 14,
        lastExecutedAt: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: "wf_2",
        name: "Goal Milestone Auto Celebration",
        description: "Notifies user and logs an audit record when a wealth goal is achieved.",
        triggerEvent: "GoalCompleted",
        ruleGroup: {
          logic: "AND",
          conditions: []
        },
        actions: [
          {
            id: "a2",
            type: "notification",
            title: "Goal Achieved! 🌟",
            config: {
              channel: "in_app",
              priority: "normal",
              messageTemplate: "Congratulations! You have reached 100% of your financial goal."
            }
          },
          {
            id: "a3",
            type: "audit_event",
            title: "Log Goal Complete",
            config: {}
          }
        ],
        requiresApproval: false,
        enabled: true,
        workspaceId: "personal",
        executionCount: 3,
        lastExecutedAt: new Date(Date.now() - 86400000 * 5).toISOString()
      }
    ];
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seeds));
    return seeds;
  }
}

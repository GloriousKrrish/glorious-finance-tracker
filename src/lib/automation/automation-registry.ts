import type { Workflow } from "./workflow-engine";

export interface AutomationTemplate {
  id: string;
  name: string;
  category: "reports" | "security" | "sync" | "tax" | "goals" | "investments";
  description: string;
  recommendedFrequency: string;
  templateWorkflow: Omit<Workflow, "id" | "workspaceId" | "executionCount">;
}

export class AutomationRegistry {
  public static getTemplates(): AutomationTemplate[] {
    return [
      {
        id: "tpl_monthly_budget_report",
        name: "Monthly Budget Performance Report",
        category: "reports",
        description: "Automatically compiles a monthly budget utilization breakdown and sends an in-app summary.",
        recommendedFrequency: "Monthly on 1st",
        templateWorkflow: {
          name: "Monthly Budget Performance Report",
          description: "Compiles budget utilization breakdown.",
          triggerEvent: "BudgetExceeded",
          ruleGroup: { logic: "AND", conditions: [] },
          actions: [
            {
              id: "act_1",
              type: "notification",
              title: "Monthly Budget Report Ready",
              config: { channel: "in_app", priority: "normal" }
            }
          ],
          requiresApproval: false,
          enabled: true
        }
      },
      {
        id: "tpl_morning_bank_sync",
        name: "Morning Open Banking Ledger Sync",
        category: "sync",
        description: "Runs open banking API reconciliation every morning at 8:00 AM.",
        recommendedFrequency: "Daily at 8:00 AM",
        templateWorkflow: {
          name: "Morning Bank Sync",
          description: "Syncs bank transactions every morning.",
          triggerEvent: "BankSyncCompleted",
          ruleGroup: { logic: "AND", conditions: [] },
          actions: [
            {
              id: "act_2",
              type: "background_job",
              title: "Execute Bank Sync",
              config: { jobType: "bank_sync", priority: "high" }
            }
          ],
          requiresApproval: false,
          enabled: true
        }
      },
      {
        id: "tpl_tax_deadline_reminder",
        name: "Quarterly Tax Filing & SLA Reminder",
        category: "tax",
        description: "Checks upcoming tax deadlines and prompts document upload to vault.",
        recommendedFrequency: "Quarterly",
        templateWorkflow: {
          name: "Tax Filing Reminder",
          description: "Alerts for upcoming Section 80C document uploads.",
          triggerEvent: "TaxReportGenerated",
          ruleGroup: { logic: "AND", conditions: [] },
          actions: [
            {
              id: "act_3",
              type: "notification",
              title: "Tax Quarter Deadline",
              config: { channel: "in_app", priority: "high" }
            }
          ],
          requiresApproval: false,
          enabled: true
        }
      },
      {
        id: "tpl_ocr_autoclass",
        name: "OCR PDF Auto-Categorization",
        category: "sync",
        description: "Automatically triggers OCR vision parsing upon uploading statement PDFs to Document Vault.",
        recommendedFrequency: "Event Driven",
        templateWorkflow: {
          name: "OCR Auto-Categorization",
          description: "Parses tax PDFs on upload.",
          triggerEvent: "DocumentUploaded",
          ruleGroup: { logic: "AND", conditions: [] },
          actions: [
            {
              id: "act_4",
              type: "background_job",
              title: "Trigger OCR Extraction Job",
              config: { jobType: "ocr_job", priority: "normal" }
            }
          ],
          requiresApproval: false,
          enabled: true
        }
      }
    ];
  }
}

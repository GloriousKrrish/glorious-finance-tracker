import type { FinancialEvent } from "./types";
import { toast } from "sonner";

export class AutomationEngine {
  private static registeredWorkflows: Map<string, (event: FinancialEvent) => void> = new Map();

  public static initialize(): void {
    // Listen to all events in the system
    const { EventEngine } = require("./events");
    EventEngine.subscribe("*", (event: FinancialEvent) => {
      this.runTriggers(event);
    });

    // Register Default Automated Workflows
    this.registerDefaultWorkflows();
  }

  private static registerDefaultWorkflows(): void {
    // 1. Loan Creation Workflow
    this.registerWorkflow("loan.created", (event) => {
      const loan = event.payload;
      toast.info(`EMI Alert: Set up monthly reminders for ${loan.name} (EMI: ₹${loan.emi.toLocaleString()}) on the 5th.`);
    });

    // 2. Goal Contribution Success Workflow
    this.registerWorkflow("goal.contribution", (event) => {
      const { goalId, amount } = event.payload;
      toast.success(`Automation: Successfully moved ₹${amount.toLocaleString()} to goal savings.`);
    });

    // 3. Bill Payment Success Workflow
    this.registerWorkflow("bill.paid", (event) => {
      const { billId } = event.payload;
      toast.success(`Automation: Transaction auto-generated for paid bill.`);
    });
  }

  public static registerWorkflow(eventType: string, handler: (event: FinancialEvent) => void): void {
    this.registeredWorkflows.set(eventType, handler);
  }

  private static runTriggers(event: FinancialEvent): void {
    const handler = this.registeredWorkflows.get(event.type);
    if (handler) {
      try {
        handler(event);
      } catch (err) {
        console.error(`Automation Workflow Error for ${event.type}:`, err);
      }
    }
  }
}

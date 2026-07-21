import type { FinancialEvent } from "./types";
import { toast } from "sonner";
import { EventEngine } from "./events";

export class AutomationEngine {
  private static registeredWorkflows: Map<string, (event: FinancialEvent) => void> = new Map();

  public static initialize(): void {
    // Listen to all events in the system
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

    // 4. Investment Buy Workflow
    this.registerWorkflow("investment.buy", (event) => {
      const { units, price } = event.payload;
      toast.success(`Portfolio Engine: Logged purchase of ${units} units at ₹${price.toLocaleString()}.`);
    });

    // 5. Investment Sell Workflow
    this.registerWorkflow("investment.sell", (event) => {
      const { units, price, realizedGainLoss } = event.payload;
      const rgl = realizedGainLoss ?? 0;
      const gainLossStr = rgl >= 0 ? `Gain: +₹${rgl.toLocaleString()}` : `Loss: -₹${Math.abs(rgl).toLocaleString()}`;
      toast.success(`Portfolio Ledger: Logged sale of ${units} units at ₹${price.toLocaleString()}. (${gainLossStr})`);
    });

    // 6. Investment Dividend Workflow
    this.registerWorkflow("investment.dividend", (event) => {
      const { amount } = event.payload;
      toast.success(`Dividend Recorded: Payout of ₹${amount.toLocaleString()} received and added to deposit account.`);
    });

    // 7. Investment Bonus Workflow
    this.registerWorkflow("investment.bonus", (event) => {
      const { units } = event.payload;
      toast.info(`Holdings Adjusted: Applied ${units} bonus shares to portfolio.`);
    });

    // 8. Investment Split Workflow
    this.registerWorkflow("investment.split", (event) => {
      const { ratio } = event.payload;
      toast.info(`Stock Split: Holdings adjusted using ratio 1:${ratio}.`);
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

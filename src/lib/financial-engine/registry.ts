import type { FinancialEventType } from "./types";

export class DependencyRegistry {
  private static registry: Record<FinancialEventType, string[]> = {
    "account.created": ["accounts", "dashboard", "reports", "ai"],
    "account.updated": ["accounts", "dashboard", "reports", "ai"],
    "account.deleted": ["accounts", "transactions", "dashboard", "reports", "ai"],

    "transaction.created": ["transactions", "accounts", "budgets", "loans", "bills", "goals", "dashboard", "reports", "ai"],
    "transaction.updated": ["transactions", "accounts", "budgets", "loans", "bills", "goals", "dashboard", "reports", "ai"],
    "transaction.deleted": ["transactions", "accounts", "budgets", "loans", "bills", "goals", "dashboard", "reports", "ai"],
    "transaction.reversed": ["transactions", "accounts", "dashboard", "reports", "ai"],
    "transaction.imported": ["transactions", "accounts", "dashboard", "reports", "ai"],
    "transaction.synced": ["transactions", "accounts", "dashboard", "reports", "ai"],
    "transaction.recurring.generated": ["transactions", "accounts", "dashboard", "reports", "ai"],

    "budget.created": ["budgets", "dashboard", "reports", "ai"],
    "budget.updated": ["budgets", "dashboard", "reports", "ai"],
    "budget.deleted": ["budgets", "dashboard", "reports", "ai"],

    "investment.created": ["investments", "accounts", "dashboard", "reports", "ai"],
    "investment.updated": ["investments", "accounts", "dashboard", "reports", "ai"],
    "investment.deleted": ["investments", "accounts", "dashboard", "reports", "ai"],
    "investment.buy": ["investments", "transactions", "accounts", "dashboard", "reports", "ai"],
    "investment.sell": ["investments", "transactions", "accounts", "dashboard", "reports", "ai"],
    "investment.dividend": ["investments", "transactions", "accounts", "dashboard", "reports", "ai"],
    "investment.bonus": ["investments", "transactions", "accounts", "dashboard", "reports", "ai"],
    "investment.split": ["investments", "transactions", "accounts", "dashboard", "reports", "ai"],

    "loan.created": ["loans", "bills", "dashboard", "reports", "ai"],
    "loan.updated": ["loans", "bills", "dashboard", "reports", "ai"],
    "loan.deleted": ["loans", "bills", "dashboard", "reports", "ai"],
    "loan.payment": ["loans", "transactions", "accounts", "dashboard", "reports", "ai"],

    "bill.created": ["bills", "dashboard", "reports", "ai"],
    "bill.updated": ["bills", "dashboard", "reports", "ai"],
    "bill.deleted": ["bills", "dashboard", "reports", "ai"],
    "bill.paid": ["bills", "transactions", "accounts", "dashboard", "reports", "ai"],

    "goal.created": ["goals", "dashboard", "reports", "ai"],
    "goal.updated": ["goals", "dashboard", "reports", "ai"],
    "goal.deleted": ["goals", "dashboard", "reports", "ai"],
    "goal.contribution": ["goals", "transactions", "accounts", "dashboard", "reports", "ai"],
  };

  public static getDependencies(event: FinancialEventType): string[] {
    return this.registry[event] || [];
  }

  public static isAffectedBy(targetModule: string, event: FinancialEventType): boolean {
    const deps = this.getDependencies(event);
    return deps.includes(targetModule);
  }
}

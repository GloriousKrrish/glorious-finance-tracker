import type { State, Account, Transaction, Budget, Investment, Loan, Bill, Goal, ID } from "../store";

export type { State, Account, Transaction, Budget, Investment, Loan, Bill, Goal, ID };

// --- EVENT SYSTEM TYPES ---
export type FinancialEventType =
  // Accounts
  | "account.created"
  | "account.updated"
  | "account.deleted"
  // Transactions
  | "transaction.created"
  | "transaction.updated"
  | "transaction.deleted"
  | "transaction.reversed"
  | "transaction.imported"
  | "transaction.synced"
  | "transaction.recurring.generated"
  // Budgets
  | "budget.created"
  | "budget.updated"
  | "budget.deleted"
  // Investments
  | "investment.created"
  | "investment.updated"
  | "investment.deleted"
  | "investment.buy"
  | "investment.sell"
  | "investment.dividend"
  | "investment.bonus"
  | "investment.split"
  // Loans
  | "loan.created"
  | "loan.updated"
  | "loan.deleted"
  | "loan.payment"
  // Bills
  | "bill.created"
  | "bill.updated"
  | "bill.deleted"
  | "bill.paid"
  // Goals
  | "goal.created"
  | "goal.updated"
  | "goal.deleted"
  | "goal.contribution";

export interface FinancialEvent<T = any> {
  type: FinancialEventType;
  payload: T;
  timestamp: string;
}

// --- VALIDATION ENGINE TYPES ---
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// --- DEPENDENCY REGISTRY TYPES ---
export interface DependencyNode {
  name: string;
  affects: string[];
  affectedBy: string[];
}

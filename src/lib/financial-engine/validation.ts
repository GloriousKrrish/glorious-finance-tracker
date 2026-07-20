import type { State, FinancialEvent, ValidationResult } from "./types";
import { CalculationEngine } from "./calculations";

export class ValidationEngine {
  public static validate(state: State, event: FinancialEvent): ValidationResult {
    switch (event.type) {
      case "account.created":
      case "account.updated": {
        const acc = event.payload;
        if (!acc.name.trim()) {
          return { isValid: false, error: "Account name cannot be empty." };
        }
        // Check for duplicates (same name and institution)
        const isDuplicate = state.accounts.some(
          (a) => a.id !== acc.id && a.name.toLowerCase() === acc.name.toLowerCase() && a.institution?.toLowerCase() === acc.institution?.toLowerCase()
        );
        if (isDuplicate) {
          return { isValid: false, error: "An account with this name and institution already exists." };
        }
        break;
      }

      case "transaction.created":
      case "transaction.updated": {
        const txn = event.payload;

        // Duplicate ID check (for creation)
        if (event.type === "transaction.created") {
          const isDuplicateId = state.transactions.some((t) => t.id === txn.id);
          if (isDuplicateId) {
            return { isValid: false, error: "Duplicate transaction ID detected." };
          }
        }

        // Amount Validation
        if (txn.amount <= 0) {
          return { isValid: false, error: "Transaction amount must be positive." };
        }

        // Date Validation
        if (!txn.date || isNaN(Date.parse(txn.date))) {
          return { isValid: false, error: "Invalid or corrupt transaction date." };
        }

        // Account Validation
        const acc = state.accounts.find((a) => a.id === txn.accountId);
        if (!acc) {
          return { isValid: false, error: "Linked account does not exist." };
        }

        // Transfer Validation
        if (txn.kind === "transfer") {
          if (!txn.toAccountId) {
            return { isValid: false, error: "Destination account is required for transfers." };
          }
          if (txn.accountId === txn.toAccountId) {
            return { isValid: false, error: "Source and destination accounts cannot be the same." };
          }
          const toAcc = state.accounts.find((a) => a.id === txn.toAccountId);
          if (!toAcc) {
            return { isValid: false, error: "Destination account does not exist." };
          }
        }

        // Currency Validation
        if (txn.currency && txn.currency.length !== 3) {
          return { isValid: false, error: "Invalid currency ISO code." };
        }

        // Linked Entity Validation
        if (txn.linkedEntityId && txn.linkedEntityType) {
          let entityExists = false;
          switch (txn.linkedEntityType) {
            case "loan": {
              const loan = state.loans.find((l) => l.id === txn.linkedEntityId);
              if (loan) {
                entityExists = true;

                // Overpayment check:
                const otherTxns = state.transactions.filter(
                  (t) => t.linkedEntityId === loan.id && t.id !== txn.id
                );
                const metrics = CalculationEngine.calculateLoan(loan, otherTxns);
                if (txn.amount > metrics.outstandingBalance) {
                  return {
                    isValid: false,
                    error: `Repayment (₹${txn.amount}) exceeds the remaining loan outstanding balance (₹${metrics.outstandingBalance}).`,
                  };
                }
              }
              break;
            }
            case "goal":
              entityExists = state.goals.some((g) => g.id === txn.linkedEntityId);
              break;
            case "bill":
              entityExists = state.bills.some((b) => b.id === txn.linkedEntityId);
              break;
            case "investment":
              entityExists = state.investments.some((i) => i.id === txn.linkedEntityId);
              break;
          }
          if (!entityExists) {
            return { isValid: false, error: `Linked ${txn.linkedEntityType} entity does not exist.` };
          }
        }

        // If it's an expense and would cause account overdraft on cash/wallets (where negative balance makes no sense)
        if (txn.kind === "expense" && (acc.type === "cash" || acc.type === "wallet") && acc.balance < txn.amount) {
          return { isValid: false, error: `Insufficient funds in ${acc.name} (${acc.type}).` };
        }
        break;
      }

      case "loan.created":
      case "loan.updated": {
        const loan = event.payload;
        if (!loan.name.trim()) {
          return { isValid: false, error: "Loan name cannot be empty." };
        }
        if (event.type === "loan.created") {
          const isDuplicateId = state.loans.some((l) => l.id === loan.id);
          if (isDuplicateId) {
            return { isValid: false, error: "Duplicate loan ID detected." };
          }
        }
        if (loan.principal <= 0) {
          return { isValid: false, error: "Loan principal must be greater than zero." };
        }
        if (loan.rate < 0 || loan.rate > 100) {
          return { isValid: false, error: "Loan interest rate must be between 0% and 100%." };
        }
        if (loan.tenureMonths <= 0) {
          return { isValid: false, error: "Loan tenure must be at least 1 month." };
        }
        if (loan.accountId) {
          const accExists = state.accounts.some((a) => a.id === loan.accountId);
          if (!accExists) {
            return { isValid: false, error: "Linked payment account does not exist." };
          }
        }
        break;
      }

      case "loan.payment": {
        const { loanId, amount, accountId } = event.payload;
        if (amount <= 0) {
          return { isValid: false, error: "Payment amount must be positive." };
        }
        const loan = state.loans.find((l) => l.id === loanId);
        if (!loan) {
          return { isValid: false, error: "Target loan does not exist." };
        }
        const metrics = CalculationEngine.calculateLoan(loan, state.transactions);
        if (amount > metrics.outstandingBalance) {
          return { isValid: false, error: `Payment (₹${amount}) cannot exceed outstanding loan balance (₹${metrics.outstandingBalance}).` };
        }
        const acc = state.accounts.find((a) => a.id === accountId);
        if (!acc) {
          return { isValid: false, error: "Linked payment account does not exist." };
        }
        if (acc.balance < amount) {
          return { isValid: false, error: `Insufficient funds in ${acc.name} for payment.` };
        }
        break;
      }

      case "goal.created":
      case "goal.updated": {
        const goal = event.payload;
        if (!goal.name || goal.name.trim() === "") {
          return { isValid: false, error: "Goal name is required." };
        }
        if (goal.target <= 0) {
          return { isValid: false, error: "Target amount must be positive." };
        }
        if (!goal.deadline || isNaN(Date.parse(goal.deadline))) {
          return { isValid: false, error: "A valid deadline date is required." };
        }
        // Duplicate name check
        const dupGoal = state.goals.find(
          (g) => g.id !== goal.id && g.name.toLowerCase() === goal.name.toLowerCase()
        );
        if (dupGoal) {
          return { isValid: false, error: `A goal named "${goal.name}" already exists.` };
        }
        // Linked account validation
        if (goal.linkedAccountId) {
          const linkedAcc = state.accounts.find((a) => a.id === goal.linkedAccountId);
          if (!linkedAcc) {
            return { isValid: false, error: "Linked account does not exist." };
          }
        }
        break;
      }

      case "goal.contribution": {
        const { goalId, amount, accountId } = event.payload;
        if (amount <= 0) {
          return { isValid: false, error: "Contribution amount must be positive." };
        }
        const goal = state.goals.find((g) => g.id === goalId);
        if (!goal) {
          return { isValid: false, error: "Target goal does not exist." };
        }
        if (goal.status === "completed") {
          return { isValid: false, error: "This goal has already been completed." };
        }
        if (goal.status === "paused") {
          return { isValid: false, error: "Cannot contribute to a paused goal." };
        }
        const acc = state.accounts.find((a) => a.id === accountId);
        if (!acc) {
          return { isValid: false, error: "Funding account does not exist." };
        }
        if (acc.balance < amount) {
          return { isValid: false, error: `Insufficient funds in ${acc.name} for contribution.` };
        }
        const gap = goal.target - goal.saved;
        if (amount > gap) {
          return { isValid: false, error: `Contribution (₹${amount}) exceeds the remaining target gap (₹${gap}).` };
        }
        break;
      }

      case "bill.paid": {
        const { billId, accountId } = event.payload;
        const bill = state.bills.find((b) => b.id === billId);
        if (!bill) {
          return { isValid: false, error: "Target bill does not exist." };
        }
        if (bill.paid) {
          return { isValid: false, error: "Bill is already paid." };
        }
        const acc = state.accounts.find((a) => a.id === accountId);
        if (!acc) {
          return { isValid: false, error: "Payment account does not exist." };
        }
        if (acc.balance < bill.amount) {
          return { isValid: false, error: `Insufficient funds in ${acc.name} to pay bill.` };
        }
        break;
      }

      case "budget.created":
      case "budget.updated": {
        const budget = event.payload;

        // Limit Validation
        if (budget.limit <= 0) {
          return { isValid: false, error: "Budget limit must be positive." };
        }

        // Category Validation
        if (!budget.category || budget.category.trim() === "") {
          return { isValid: false, error: "Budget category is required." };
        }

        // Period Validation
        const validPeriods = ["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly", "custom"];
        if (!validPeriods.includes(budget.period)) {
          return { isValid: false, error: `Invalid budget period. Supported periods: ${validPeriods.join(", ")}.` };
        }

        // Custom Date Range Validation
        if (budget.period === "custom") {
          if (!budget.startDate || isNaN(Date.parse(budget.startDate))) {
            return { isValid: false, error: "Custom period budgets require a valid start date." };
          }
          if (!budget.endDate || isNaN(Date.parse(budget.endDate))) {
            return { isValid: false, error: "Custom period budgets require a valid end date." };
          }
          if (new Date(budget.startDate) > new Date(budget.endDate)) {
            return { isValid: false, error: "Start date cannot be after end date." };
          }
        }

        // Alert Threshold Validation
        if (budget.alertThreshold !== undefined && (budget.alertThreshold < 0 || budget.alertThreshold > 100)) {
          return { isValid: false, error: "Alert threshold percentage must be between 0 and 100." };
        }

        // Duplicate Check (category + period)
        const duplicate = state.budgets.find(
          (b) => b.id !== budget.id && b.category === budget.category && b.period === budget.period
        );
        if (duplicate) {
          return { isValid: false, error: `A ${budget.period} budget for '${budget.category}' already exists.` };
        }

        break;
      }
    }

    return { isValid: true };
  }
}

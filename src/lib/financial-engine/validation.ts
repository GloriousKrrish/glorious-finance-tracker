import type { State, FinancialEvent, ValidationResult } from "./types";

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
        if (txn.amount <= 0) {
          return { isValid: false, error: "Transaction amount must be positive." };
        }
        const acc = state.accounts.find((a) => a.id === txn.accountId);
        if (!acc) {
          return { isValid: false, error: "Linked account does not exist." };
        }
        // If it's an expense and would cause account overdraft on cash/wallets (where negative balance makes no sense)
        if (txn.kind === "expense" && (acc.type === "cash" || acc.type === "wallet") && acc.balance < txn.amount) {
          return { isValid: false, error: `Insufficient funds in ${acc.name} (${acc.type}).` };
        }
        break;
      }

      case "loan.created": {
        const loan = event.payload;
        if (loan.principal <= 0) {
          return { isValid: false, error: "Loan principal must be greater than zero." };
        }
        if (loan.rate < 0 || loan.rate > 100) {
          return { isValid: false, error: "Loan interest rate must be between 0% and 100%." };
        }
        if (loan.tenureMonths <= 0) {
          return { isValid: false, error: "Loan tenure must be at least 1 month." };
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
        if (amount > loan.outstanding) {
          return { isValid: false, error: `Payment (₹${amount}) cannot exceed outstanding loan balance (₹${loan.outstanding}).` };
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

      case "goal.contribution": {
        const { goalId, amount, accountId } = event.payload;
        if (amount <= 0) {
          return { isValid: false, error: "Contribution amount must be positive." };
        }
        const goal = state.goals.find((g) => g.id === goalId);
        if (!goal) {
          return { isValid: false, error: "Target goal does not exist." };
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
    }

    return { isValid: true };
  }
}

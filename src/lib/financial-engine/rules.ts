import type { State, FinancialEvent } from "./types";
import { uid } from "../store";

export class RulesEngine {
  public static apply(state: State, event: FinancialEvent): State {
    const nextState = JSON.parse(JSON.stringify(state)) as State;

    switch (event.type) {
      case "account.created": {
        const acc = event.payload;
        nextState.accounts.unshift(acc);
        break;
      }
      case "account.updated": {
        const acc = event.payload;
        const idx = nextState.accounts.findIndex((a) => a.id === acc.id);
        if (idx !== -1) nextState.accounts[idx] = acc;
        break;
      }
      case "account.deleted": {
        const id = event.payload;
        nextState.accounts = nextState.accounts.filter((a) => a.id !== id);
        // Cascade delete: remove/orphan transactions on this account
        nextState.transactions = nextState.transactions.filter((t) => t.accountId !== id);
        break;
      }

      case "transaction.created": {
        const txn = event.payload;
        nextState.transactions.unshift(txn);
        this.applyTxnEffect(nextState, txn, 1);
        break;
      }
      case "transaction.updated": {
        const txn = event.payload;
        const oldTxn = nextState.transactions.find((t) => t.id === txn.id);
        if (oldTxn) {
          // Revert old transaction effect
          this.applyTxnEffect(nextState, oldTxn, -1);
          // Apply new transaction effect
          const idx = nextState.transactions.findIndex((t) => t.id === txn.id);
          nextState.transactions[idx] = txn;
          this.applyTxnEffect(nextState, txn, 1);
        }
        break;
      }
      case "transaction.deleted": {
        const id = event.payload;
        const txn = nextState.transactions.find((t) => t.id === id);
        if (txn) {
          this.applyTxnEffect(nextState, txn, -1);
          nextState.transactions = nextState.transactions.filter((t) => t.id !== id);
        }
        break;
      }

      case "budget.created": {
        nextState.budgets.unshift(event.payload);
        break;
      }
      case "budget.updated": {
        const b = event.payload;
        const idx = nextState.budgets.findIndex((x) => x.id === b.id);
        if (idx !== -1) nextState.budgets[idx] = b;
        break;
      }
      case "budget.deleted": {
        nextState.budgets = nextState.budgets.filter((x) => x.id !== event.payload);
        break;
      }

      case "investment.created": {
        const inv = event.payload;
        // Set defaults for missing fields
        inv.units = inv.units ?? 0;
        inv.averageBuyPrice = inv.averageBuyPrice ?? 0;
        inv.currentPrice = inv.currentPrice ?? inv.averageBuyPrice ?? 0;
        inv.status = inv.status ?? "active";
        nextState.investments.unshift(inv);
        this.syncInvestmentAccount(nextState);
        break;
      }
      case "investment.updated": {
        const inv = event.payload;
        const idx = nextState.investments.findIndex((i) => i.id === inv.id);
        if (idx !== -1) {
          // Keep units and prices aligned
          nextState.investments[idx] = {
            ...nextState.investments[idx],
            ...inv
          };
        }
        this.syncInvestmentAccount(nextState);
        break;
      }
      case "investment.deleted": {
        nextState.investments = nextState.investments.filter((i) => i.id !== event.payload);
        this.syncInvestmentAccount(nextState);
        break;
      }

      case "investment.buy": {
        const { investmentId, units, price, accountId, date, fees, taxes } = event.payload;
        const inv = nextState.investments.find((i) => i.id === investmentId);
        if (inv) {
          const buyTxn = {
            id: uid(),
            date: date || new Date().toISOString().slice(0, 10),
            amount: units * price + (fees ?? 0) + (taxes ?? 0),
            kind: "investment_purchase" as const,
            category: "Investments",
            accountId,
            merchant: inv.name,
            linkedEntityId: inv.id,
            linkedEntityType: "investment" as const,
            note: `Bought ${units} units at ₹${price}`,
            metadata: { units, price, fees, taxes }
          };
          nextState.transactions.unshift(buyTxn);
          this.applyTxnEffect(nextState, buyTxn, 1);

          // Update holdings
          const priorUnits = inv.units ?? 0;
          const priorAvg = inv.averageBuyPrice ?? 0;
          inv.units = priorUnits + units;
          inv.purchaseQuantity = (inv.purchaseQuantity ?? 0) + units;
          inv.averageBuyPrice = (priorUnits * priorAvg + units * price + (fees ?? 0) + (taxes ?? 0)) / inv.units;
          if (fees) inv.fees = (inv.fees ?? 0) + fees;
          if (taxes) inv.taxes = (inv.taxes ?? 0) + taxes;
          inv.status = "active";
          this.syncInvestmentAccount(nextState);
        }
        break;
      }

      case "investment.sell": {
        const { investmentId, units, price, accountId, date, fees, taxes } = event.payload;
        const inv = nextState.investments.find((i) => i.id === investmentId);
        if (inv) {
          const realizedGainLoss = (price - (inv.averageBuyPrice ?? 0)) * units - (fees ?? 0) - (taxes ?? 0);
          const sellTxn = {
            id: uid(),
            date: date || new Date().toISOString().slice(0, 10),
            amount: units * price - (fees ?? 0) - (taxes ?? 0),
            kind: "investment_sale" as const,
            category: "Investments",
            accountId,
            merchant: inv.name,
            linkedEntityId: inv.id,
            linkedEntityType: "investment" as const,
            note: `Sold ${units} units at ₹${price}`,
            metadata: { units, price, fees, taxes, realizedGainLoss }
          };
          nextState.transactions.unshift(sellTxn);
          this.applyTxnEffect(nextState, sellTxn, 1);

          // Update holdings
          inv.units = Math.max(0, (inv.units ?? 0) - units);
          if (fees) inv.fees = (inv.fees ?? 0) + fees;
          if (taxes) inv.taxes = (inv.taxes ?? 0) + taxes;
          if (inv.units === 0) {
            inv.status = "sold";
          }
          this.syncInvestmentAccount(nextState);
        }
        break;
      }

      case "investment.dividend": {
        const { investmentId, amount, accountId, date } = event.payload;
        const inv = nextState.investments.find((i) => i.id === investmentId);
        if (inv) {
          const divTxn = {
            id: uid(),
            date: date || new Date().toISOString().slice(0, 10),
            amount,
            kind: "dividend" as const,
            category: "Investments",
            accountId,
            merchant: inv.name,
            linkedEntityId: inv.id,
            linkedEntityType: "investment" as const,
            note: `Dividend payout for ${inv.name}`
          };
          nextState.transactions.unshift(divTxn);
          this.applyTxnEffect(nextState, divTxn, 1);
          this.syncInvestmentAccount(nextState);
        }
        break;
      }

      case "investment.bonus": {
        const { investmentId, units, date } = event.payload;
        const inv = nextState.investments.find((i) => i.id === investmentId);
        if (inv) {
          const priorUnits = inv.units ?? 0;
          const priorAvg = inv.averageBuyPrice ?? 0;
          inv.units = priorUnits + units;
          inv.purchaseQuantity = (inv.purchaseQuantity ?? 0) + units;
          inv.averageBuyPrice = inv.units > 0 ? (priorUnits * priorAvg) / inv.units : 0;
          
          const bonusTxn = {
            id: uid(),
            date: date || new Date().toISOString().slice(0, 10),
            amount: 0,
            kind: "adjustment" as const,
            category: "Investments",
            accountId: inv.linkedAccountId || "",
            merchant: inv.name,
            linkedEntityId: inv.id,
            linkedEntityType: "investment" as const,
            note: `Received ${units} bonus shares`,
            metadata: { units, price: 0 }
          };
          nextState.transactions.unshift(bonusTxn);
          this.syncInvestmentAccount(nextState);
        }
        break;
      }

      case "investment.split": {
        const { investmentId, ratio, date } = event.payload;
        const inv = nextState.investments.find((i) => i.id === investmentId);
        if (inv) {
          const priorUnits = inv.units ?? 0;
          inv.units = priorUnits * ratio;
          if (inv.purchaseQuantity) {
            inv.purchaseQuantity = inv.purchaseQuantity * ratio;
          }
          inv.averageBuyPrice = (inv.averageBuyPrice ?? 0) / ratio;
          inv.currentPrice = (inv.currentPrice ?? 0) / ratio;

          const splitTxn = {
            id: uid(),
            date: date || new Date().toISOString().slice(0, 10),
            amount: 0,
            kind: "adjustment" as const,
            category: "Investments",
            accountId: inv.linkedAccountId || "",
            merchant: inv.name,
            linkedEntityId: inv.id,
            linkedEntityType: "investment" as const,
            note: `Stock split 1:${ratio}`,
            metadata: { ratio }
          };
          nextState.transactions.unshift(splitTxn);
          this.syncInvestmentAccount(nextState);
        }
        break;
      }

      case "loan.created": {
        nextState.loans.unshift(event.payload);
        break;
      }
      case "loan.updated": {
        const loan = event.payload;
        const idx = nextState.loans.findIndex((l) => l.id === loan.id);
        if (idx !== -1) nextState.loans[idx] = loan;
        break;
      }
      case "loan.deleted": {
        const id = event.payload;
        nextState.loans = nextState.loans.filter((l) => l.id !== id);
        nextState.transactions = nextState.transactions.map((t) => {
          if (t.linkedEntityId === id && t.linkedEntityType === "loan") {
            const { linkedEntityId, linkedEntityType, ...rest } = t;
            return rest as any;
          }
          return t;
        });
        break;
      }

      case "goal.created": {
        nextState.goals.unshift(event.payload);
        break;
      }
      case "goal.updated": {
        const goal = event.payload;
        const idx = nextState.goals.findIndex((g) => g.id === goal.id);
        if (idx !== -1) nextState.goals[idx] = goal;
        break;
      }
      case "goal.deleted": {
        const id = event.payload;
        nextState.goals = nextState.goals.filter((g) => g.id !== id);
        // Orphan linked transactions
        nextState.transactions = nextState.transactions.map((t) => {
          if (t.linkedEntityId === id && t.linkedEntityType === "goal") {
            const { linkedEntityId, linkedEntityType, ...rest } = t;
            return rest as any;
          }
          return t;
        });
        break;
      }

      case "bill.created": {
        const bill = { ...event.payload };
        if (!bill.status) {
          const isOverdue = new Date(bill.dueDate) < new Date();
          bill.status = isOverdue ? "overdue" : "unpaid";
        }
        bill.paid = bill.status === "paid";
        
        if (bill.autoPayEnabled && bill.linkedAccountId && bill.status !== "paid") {
          bill.status = "paid";
          bill.paid = true;
          const txn = {
            id: uid(),
            date: bill.dueDate,
            amount: bill.amount,
            kind: "expense" as const,
            category: bill.category,
            accountId: bill.linkedAccountId,
            merchant: bill.name,
            linkedEntityId: bill.id,
            linkedEntityType: "bill" as const,
            note: `AutoPay: ${bill.name}`
          };
          nextState.transactions.unshift(txn);
          this.applyTxnEffect(nextState, txn, 1);
          
          if (bill.linkedLoanId) {
            const loan = nextState.loans.find(l => l.id === bill.linkedLoanId);
            if (loan) {
              const monthlyRate = (loan.rate / 12) / 100;
              const interestPaid = loan.outstanding * monthlyRate;
              const principalPaid = Math.max(0, bill.amount - interestPaid);
              loan.outstanding = Math.max(0, loan.outstanding - principalPaid);
            }
          }
        }
        nextState.bills.unshift(bill);
        break;
      }
      case "bill.updated": {
        const bill = { ...event.payload };
        const idx = nextState.bills.findIndex((x) => x.id === bill.id);
        if (idx !== -1) {
          const oldBill = nextState.bills[idx];
          if (bill.autoPayEnabled && bill.linkedAccountId && bill.status !== "paid" && !oldBill.paid) {
            bill.status = "paid";
            bill.paid = true;
            const txn = {
              id: uid(),
              date: bill.dueDate,
              amount: bill.amount,
              kind: "expense" as const,
              category: bill.category,
              accountId: bill.linkedAccountId,
              merchant: bill.name,
              linkedEntityId: bill.id,
              linkedEntityType: "bill" as const,
              note: `AutoPay: ${bill.name}`
            };
            nextState.transactions.unshift(txn);
            this.applyTxnEffect(nextState, txn, 1);

            if (bill.linkedLoanId) {
              const loan = nextState.loans.find(l => l.id === bill.linkedLoanId);
              if (loan) {
                const monthlyRate = (loan.rate / 12) / 100;
                const interestPaid = loan.outstanding * monthlyRate;
                const principalPaid = Math.max(0, bill.amount - interestPaid);
                loan.outstanding = Math.max(0, loan.outstanding - principalPaid);
              }
            }
          }
          nextState.bills[idx] = bill;
        }
        break;
      }
      case "bill.deleted": {
        const id = event.payload;
        nextState.transactions = nextState.transactions.filter(t => t.linkedEntityId !== id);
        nextState.bills = nextState.bills.filter((x) => x.id !== id);
        break;
      }

      case "bill.paid": {
        const { billId, accountId, date } = event.payload;
        const bill = nextState.bills.find((b) => b.id === billId);
        if (bill) {
          bill.paid = true;
          bill.status = "paid";
          const txn = {
            id: uid(),
            date: date || new Date().toISOString().slice(0, 10),
            amount: bill.amount,
            kind: "expense" as const,
            category: bill.category,
            accountId,
            merchant: bill.name,
            linkedEntityId: bill.id,
            linkedEntityType: "bill" as const,
            note: `Payment for bill: ${bill.name}`
          };
          nextState.transactions.unshift(txn);
          this.applyTxnEffect(nextState, txn, 1);

          if (bill.linkedLoanId) {
            const loan = nextState.loans.find(l => l.id === bill.linkedLoanId);
            if (loan) {
              const monthlyRate = (loan.rate / 12) / 100;
              const interestPaid = loan.outstanding * monthlyRate;
              const principalPaid = Math.max(0, bill.amount - interestPaid);
              loan.outstanding = Math.max(0, loan.outstanding - principalPaid);
            }
          }

          if (bill.paymentFrequency && bill.paymentFrequency !== "one-time") {
            const nextDueDate = this.calculateNextDueDate(bill.dueDate, bill.paymentFrequency);
            const nextBill = {
              ...bill,
              id: uid(),
              dueDate: nextDueDate,
              status: "unpaid" as const,
              paid: false,
            };
            nextState.bills.unshift(nextBill);
          }
        }
        break;
      }

      case "goal.contribution": {
        const { goalId, amount, accountId, date } = event.payload;
        const goal = nextState.goals.find((g) => g.id === goalId);
        if (goal) {
          goal.saved += amount;
          // Auto-complete goal
          if (goal.saved >= goal.target) {
            goal.status = "completed";
          }
          // Generate linked transaction
          const txn = {
            id: uid(),
            date: date || new Date().toISOString().slice(0, 10),
            amount,
            kind: "goal_contribution" as const,
            category: "Savings",
            accountId,
            merchant: `Goal: ${goal.name}`,
            note: `Contribution to goal: ${goal.name}`,
            linkedEntityId: goal.id,
            linkedEntityType: "goal" as const,
          };
          nextState.transactions.unshift(txn);
          this.applyTxnEffect(nextState, txn, 1);
        }
        break;
      }

      case "loan.payment": {
        const { loanId, amount, accountId, date } = event.payload;
        const loan = nextState.loans.find((l) => l.id === loanId);
        if (loan) {
          // Amortize EMI payment: outstanding reduced by principal component
          const monthlyRate = (loan.rate / 12) / 100;
          const interestPaid = loan.outstanding * monthlyRate;
          const principalPaid = Math.max(0, amount - interestPaid);
          loan.outstanding = Math.max(0, loan.outstanding - principalPaid);

          // Generate automated transaction
          const txn = {
            id: uid(),
            date: date || new Date().toISOString().slice(0, 10),
            amount,
            kind: "expense" as const,
            category: "EMI",
            accountId,
            merchant: `${loan.name} EMI`,
            note: `Repayment for ${loan.name}`
          };
          nextState.transactions.unshift(txn);
          this.applyTxnEffect(nextState, txn, 1);
        }
        break;
      }
    }

    return nextState;
  }

  // Factor is +1 for applying transaction, -1 for reverting
  private static applyTxnEffect(state: State, txn: any, factor: number): void {
    const increaseTypes = ["income", "investment_sale", "refund", "interest", "dividend"];
    const decreaseTypes = ["expense", "transfer", "loan_payment", "investment_purchase", "goal_contribution", "bill_payment", "adjustment"];

    const acc = state.accounts.find((a) => a.id === txn.accountId);
    if (acc) {
      const isDecrease = decreaseTypes.includes(txn.kind);
      let delta = txn.amount * factor;
      if (isDecrease) {
        delta = -delta;
      }
      acc.balance += delta;
    }

    // Sync Transfer Destination Account
    if (txn.kind === "transfer" && txn.toAccountId) {
      const destAcc = state.accounts.find((a) => a.id === txn.toAccountId);
      if (destAcc) {
        // Destination is credited (+) when transaction is created/applied (factor = 1)
        destAcc.balance += txn.amount * factor;
      }
    }



    // Sync Bill if matching name/category and amount
    if (txn.linkedEntityType === "bill" && txn.linkedEntityId) {
      const bill = state.bills.find(b => b.id === txn.linkedEntityId);
      if (bill) {
        if (factor === 1) {
          bill.status = "paid";
          bill.paid = true;
        } else {
          bill.status = "unpaid";
          bill.paid = false;
          if (bill.linkedLoanId) {
            const loan = state.loans.find(l => l.id === bill.linkedLoanId);
            if (loan) {
              const monthlyRate = (loan.rate / 12) / 100;
              const interestPaid = loan.outstanding * monthlyRate;
              const principalPaid = Math.max(0, bill.amount - interestPaid);
              loan.outstanding += principalPaid;
            }
          }
        }
      }
    } else {
      if (factor === 1) {
        const bill = state.bills.find(
          (b) => (b.status === "unpaid" || !b.paid) && b.category === txn.category && b.name.toLowerCase() === txn.merchant?.toLowerCase()
        );
        if (bill) {
          bill.status = "paid";
          bill.paid = true;
        }
      } else {
        const bill = state.bills.find(
          (b) => (b.status === "paid" || b.paid) && b.category === txn.category && b.name.toLowerCase() === txn.merchant?.toLowerCase()
        );
        if (bill) {
          bill.status = "unpaid";
          bill.paid = false;
        }
      }
    }
  }

  // Automatically sync total investment holdings to the first Investment account balance
  private static syncInvestmentAccount(state: State): void {
    const totalCurrentVal = state.investments.reduce((sum, inv) => {
      const units = inv.units ?? 0;
      const currentPrice = inv.currentPrice ?? 0;
      const currentVal = units > 0 ? units * currentPrice : (inv.current ?? 0);
      return sum + currentVal;
    }, 0);
    const invAccount = state.accounts.find((a) => a.type === "investment");
    if (invAccount) {
      invAccount.balance = totalCurrentVal;
    }
  }

  private static calculateNextDueDate(dateStr: string, frequency: string): string {
    const d = new Date(dateStr);
    switch (frequency) {
      case "daily":
        d.setDate(d.getDate() + 1);
        break;
      case "weekly":
        d.setDate(d.getDate() + 7);
        break;
      case "biweekly":
        d.setDate(d.getDate() + 14);
        break;
      case "monthly":
        d.setMonth(d.getMonth() + 1);
        break;
      case "quarterly":
        d.setMonth(d.getMonth() + 3);
        break;
      case "half-yearly":
        d.setMonth(d.getMonth() + 6);
        break;
      case "yearly":
        d.setFullYear(d.getFullYear() + 1);
        break;
      default:
        d.setMonth(d.getMonth() + 1);
    }
    return d.toISOString().slice(0, 10);
  }
}

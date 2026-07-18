import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react";

export type ID = string;

export interface Account {
  id: ID;
  name: string;
  type: "bank" | "cash" | "credit_card" | "wallet" | "investment";
  balance: number;
  institution?: string;
}

export type TxnKind = "income" | "expense" | "transfer";
export interface Transaction {
  id: ID;
  date: string; // ISO
  amount: number; // positive; sign inferred by kind
  kind: TxnKind;
  category: string;
  accountId: ID;
  merchant?: string;
  note?: string;
}

export interface Budget {
  id: ID;
  category: string;
  limit: number;
  period: "monthly" | "weekly" | "yearly";
}

export interface Investment {
  id: ID;
  name: string;
  type: "stock" | "mutual_fund" | "gold" | "fd" | "ppf" | "nps" | "bond" | "crypto" | "other";
  invested: number;
  current: number;
  units?: number;
}

export interface Loan {
  id: ID;
  name: string;
  type: "home" | "car" | "personal" | "education" | "gold" | "business";
  principal: number;
  outstanding: number;
  rate: number; // annual %
  emi: number;
  tenureMonths: number;
  startDate: string;
}

export interface Bill {
  id: ID;
  name: string;
  amount: number;
  dueDate: string;
  category: string;
  recurring: "none" | "monthly" | "yearly" | "weekly";
  paid: boolean;
}

export interface Goal {
  id: ID;
  name: string;
  target: number;
  saved: number;
  deadline: string;
  category: string;
}

export interface Profile {
  name: string;
  email: string;
  userType: "personal" | "employee" | "student" | "business" | "freelancer" | "family" | "hni";
  currency: "INR";
}

export interface State {
  profile: Profile;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  investments: Investment[];
  loans: Loan[];
  bills: Bill[];
  goals: Goal[];
}

const STORAGE_KEY = "gloriousfinance:v1";

const initialState: State = {
  profile: { name: "Your Name", email: "you@example.com", userType: "personal", currency: "INR" },
  accounts: [
    { id: "a1", name: "HDFC Savings", type: "bank", balance: 245000, institution: "HDFC Bank" },
    { id: "a2", name: "Cash Wallet", type: "cash", balance: 8500 },
    { id: "a3", name: "HDFC Credit Card", type: "credit_card", balance: -18500, institution: "HDFC" },
  ],
  transactions: [
    { id: "t1", date: iso(-1), amount: 85000, kind: "income", category: "Salary", accountId: "a1", merchant: "Employer Inc" },
    { id: "t2", date: iso(-2), amount: 1450, kind: "expense", category: "Food", accountId: "a3", merchant: "Zomato" },
    { id: "t3", date: iso(-3), amount: 3200, kind: "expense", category: "Fuel", accountId: "a1", merchant: "Indian Oil" },
    { id: "t4", date: iso(-5), amount: 12000, kind: "expense", category: "Rent", accountId: "a1", merchant: "Landlord" },
    { id: "t5", date: iso(-7), amount: 899, kind: "expense", category: "Subscriptions", accountId: "a3", merchant: "Netflix" },
    { id: "t6", date: iso(-9), amount: 5400, kind: "expense", category: "Shopping", accountId: "a3", merchant: "Amazon" },
    { id: "t7", date: iso(-11), amount: 2100, kind: "expense", category: "Healthcare", accountId: "a1", merchant: "Apollo Pharmacy" },
    { id: "t8", date: iso(-14), amount: 15000, kind: "expense", category: "Investments", accountId: "a1", merchant: "Groww SIP" },
  ],
  budgets: [
    { id: "b1", category: "Food", limit: 12000, period: "monthly" },
    { id: "b2", category: "Fuel", limit: 6000, period: "monthly" },
    { id: "b3", category: "Shopping", limit: 10000, period: "monthly" },
    { id: "b4", category: "Entertainment", limit: 3000, period: "monthly" },
  ],
  investments: [
    { id: "i1", name: "Nifty 50 Index Fund", type: "mutual_fund", invested: 180000, current: 214500, units: 1250 },
    { id: "i2", name: "HDFC Bank", type: "stock", invested: 95000, current: 112800, units: 60 },
    { id: "i3", name: "Sovereign Gold Bond", type: "gold", invested: 60000, current: 74200 },
    { id: "i4", name: "PPF Account", type: "ppf", invested: 150000, current: 178000 },
  ],
  loans: [
    { id: "l1", name: "Home Loan", type: "home", principal: 4500000, outstanding: 3820000, rate: 8.5, emi: 39500, tenureMonths: 240, startDate: iso(-720) },
    { id: "l2", name: "Car Loan", type: "car", principal: 800000, outstanding: 320000, rate: 9.2, emi: 16800, tenureMonths: 60, startDate: iso(-540) },
  ],
  bills: [
    { id: "bl1", name: "Electricity", amount: 2400, dueDate: iso(5), category: "Utilities", recurring: "monthly", paid: false },
    { id: "bl2", name: "Internet", amount: 999, dueDate: iso(8), category: "Utilities", recurring: "monthly", paid: false },
    { id: "bl3", name: "Netflix", amount: 899, dueDate: iso(12), category: "Subscriptions", recurring: "monthly", paid: false },
    { id: "bl4", name: "Home Insurance", amount: 8500, dueDate: iso(45), category: "Insurance", recurring: "yearly", paid: false },
  ],
  goals: [
    { id: "g1", name: "Emergency Fund", target: 500000, saved: 320000, deadline: iso(365), category: "Safety" },
    { id: "g2", name: "Europe Vacation", target: 350000, saved: 85000, deadline: iso(240), category: "Travel" },
    { id: "g3", name: "New MacBook", target: 220000, saved: 140000, deadline: iso(90), category: "Purchase" },
  ],
};

function iso(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export const uid = () => Math.random().toString(36).slice(2, 10);

type Action =
  | { type: "hydrate"; payload: State }
  | { type: "reset" }
  | { type: "profile:update"; payload: Partial<Profile> }
  | { type: "account:add"; payload: Account }
  | { type: "account:update"; payload: Account }
  | { type: "account:remove"; payload: ID }
  | { type: "txn:add"; payload: Transaction }
  | { type: "txn:update"; payload: Transaction }
  | { type: "txn:remove"; payload: ID }
  | { type: "budget:add"; payload: Budget }
  | { type: "budget:update"; payload: Budget }
  | { type: "budget:remove"; payload: ID }
  | { type: "inv:add"; payload: Investment }
  | { type: "inv:update"; payload: Investment }
  | { type: "inv:remove"; payload: ID }
  | { type: "loan:add"; payload: Loan }
  | { type: "loan:update"; payload: Loan }
  | { type: "loan:remove"; payload: ID }
  | { type: "bill:add"; payload: Bill }
  | { type: "bill:update"; payload: Bill }
  | { type: "bill:remove"; payload: ID }
  | { type: "goal:add"; payload: Goal }
  | { type: "goal:update"; payload: Goal }
  | { type: "goal:remove"; payload: ID };

function upsert<T extends { id: ID }>(arr: T[], item: T) {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i === -1) return [item, ...arr];
  const c = arr.slice();
  c[i] = item;
  return c;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate": return action.payload;
    case "reset": return initialState;
    case "profile:update": return { ...state, profile: { ...state.profile, ...action.payload } };
    case "account:add": return { ...state, accounts: [action.payload, ...state.accounts] };
    case "account:update": return { ...state, accounts: upsert(state.accounts, action.payload) };
    case "account:remove": return { ...state, accounts: state.accounts.filter(a => a.id !== action.payload) };
    case "txn:add": return { ...state, transactions: [action.payload, ...state.transactions] };
    case "txn:update": return { ...state, transactions: upsert(state.transactions, action.payload) };
    case "txn:remove": return { ...state, transactions: state.transactions.filter(t => t.id !== action.payload) };
    case "budget:add": return { ...state, budgets: [action.payload, ...state.budgets] };
    case "budget:update": return { ...state, budgets: upsert(state.budgets, action.payload) };
    case "budget:remove": return { ...state, budgets: state.budgets.filter(b => b.id !== action.payload) };
    case "inv:add": return { ...state, investments: [action.payload, ...state.investments] };
    case "inv:update": return { ...state, investments: upsert(state.investments, action.payload) };
    case "inv:remove": return { ...state, investments: state.investments.filter(i => i.id !== action.payload) };
    case "loan:add": return { ...state, loans: [action.payload, ...state.loans] };
    case "loan:update": return { ...state, loans: upsert(state.loans, action.payload) };
    case "loan:remove": return { ...state, loans: state.loans.filter(l => l.id !== action.payload) };
    case "bill:add": return { ...state, bills: [action.payload, ...state.bills] };
    case "bill:update": return { ...state, bills: upsert(state.bills, action.payload) };
    case "bill:remove": return { ...state, bills: state.bills.filter(b => b.id !== action.payload) };
    case "goal:add": return { ...state, goals: [action.payload, ...state.goals] };
    case "goal:update": return { ...state, goals: upsert(state.goals, action.payload) };
    case "goal:remove": return { ...state, goals: state.goals.filter(g => g.id !== action.payload) };
  }
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", payload: JSON.parse(raw) });
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}

export const CATEGORIES = [
  "Food", "Fuel", "Shopping", "Healthcare", "Travel", "Education",
  "Entertainment", "Investments", "Salary", "EMI", "Insurance", "Rent",
  "Utilities", "Subscriptions", "Tax", "Business", "Others",
];

import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type ID = string;

export interface Account { id: ID; name: string; type: "bank" | "cash" | "credit_card" | "wallet" | "investment"; balance: number; institution?: string; }
export type TxnKind = "income" | "expense" | "transfer";
export interface Transaction { id: ID; date: string; amount: number; kind: TxnKind; category: string; accountId: ID; merchant?: string; note?: string; }
export interface Budget { id: ID; category: string; limit: number; period: "monthly" | "weekly" | "yearly"; }
export interface Investment { id: ID; name: string; type: "stock" | "mutual_fund" | "gold" | "fd" | "ppf" | "nps" | "bond" | "crypto" | "other"; invested: number; current: number; units?: number; }
export interface Loan { id: ID; name: string; type: "home" | "car" | "personal" | "education" | "gold" | "business"; principal: number; outstanding: number; rate: number; emi: number; tenureMonths: number; startDate: string; }
export interface Bill { id: ID; name: string; amount: number; dueDate: string; category: string; recurring: "none" | "monthly" | "yearly" | "weekly"; paid: boolean; }
export interface Goal { id: ID; name: string; target: number; saved: number; deadline: string; category: string; }
export interface Profile { name: string; email: string; userType: "personal" | "employee" | "student" | "business" | "freelancer" | "family" | "hni"; currency: "INR"; }

export interface State {
  profile: Profile;
  accounts: Account[]; transactions: Transaction[]; budgets: Budget[];
  investments: Investment[]; loans: Loan[]; bills: Bill[]; goals: Goal[];
}

const emptyState: State = {
  profile: { name: "User", email: "", userType: "personal", currency: "INR" },
  accounts: [], transactions: [], budgets: [], investments: [], loans: [], bills: [], goals: [],
};

export const uid = () => Math.random().toString(36).slice(2, 10);

type Action =
  | { type: "hydrate"; payload: State } | { type: "reset" } | { type: "loadDemo" }
  | { type: "profile:update"; payload: Partial<Profile> }
  | { type: "account:add"; payload: Account } | { type: "account:update"; payload: Account } | { type: "account:remove"; payload: ID }
  | { type: "txn:add"; payload: Transaction } | { type: "txn:update"; payload: Transaction } | { type: "txn:remove"; payload: ID }
  | { type: "budget:add"; payload: Budget } | { type: "budget:update"; payload: Budget } | { type: "budget:remove"; payload: ID }
  | { type: "inv:add"; payload: Investment } | { type: "inv:update"; payload: Investment } | { type: "inv:remove"; payload: ID }
  | { type: "loan:add"; payload: Loan } | { type: "loan:update"; payload: Loan } | { type: "loan:remove"; payload: ID }
  | { type: "bill:add"; payload: Bill } | { type: "bill:update"; payload: Bill } | { type: "bill:remove"; payload: ID }
  | { type: "goal:add"; payload: Goal } | { type: "goal:update"; payload: Goal } | { type: "goal:remove"; payload: ID };

function upsert<T extends { id: ID }>(arr: T[], item: T) {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i === -1) return [item, ...arr];
  const c = arr.slice(); c[i] = item; return c;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate": return action.payload;
    case "reset": return emptyState;
    case "loadDemo": return emptyState;
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

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action>; loading: boolean } | null>(null);

function isEmpty(s: State) {
  return !s.accounts?.length && !s.transactions?.length && !s.budgets?.length && !s.investments?.length && !s.loans?.length && !s.bills?.length && !s.goals?.length;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [state, dispatch] = useReducer(reducer, emptyState);
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from Supabase on user change
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    supabase.from("user_finance_state").select("state").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const raw = (data?.state ?? {}) as Partial<State>;
        const loaded: State = { ...emptyState, ...raw, profile: { ...emptyState.profile, ...(raw.profile ?? {}), email: user.email ?? "" } };
        // If first time and completely empty, initialize with clean empty state
        if (isEmpty(loaded)) {
          const seeded = { ...emptyState, profile: { ...emptyState.profile, email: user.email ?? "", name: user.user_metadata?.full_name ?? emptyState.profile.name } };
          dispatch({ type: "hydrate", payload: seeded });
        } else {
          dispatch({ type: "hydrate", payload: loaded });
        }
        initialLoad.current = true;
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id, authLoading]);

  // Save on state change (debounced)
  useEffect(() => {
    if (!user || !initialLoad.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      supabase.from("user_finance_state").upsert({ user_id: user.id, state: state as never, updated_at: new Date().toISOString() }).then(() => {});
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [state, user?.id]);

  return <Ctx.Provider value={{ state, dispatch, loading }}>{children}</Ctx.Provider>;
}

// Re-export for setState-style loading indicator
import { useState } from "react";

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

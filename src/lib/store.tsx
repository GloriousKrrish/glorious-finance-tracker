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
export interface Profile {
  name: string;
  email: string;
  userType: "personal" | "employee" | "student" | "business" | "freelancer" | "family" | "hni";
  currency: "INR";
  onboardingCompleted?: boolean;
  onboardingStep?: number;
}

export interface State {
  profile: Profile;
  accounts: Account[]; transactions: Transaction[]; budgets: Budget[];
  investments: Investment[]; loans: Loan[]; bills: Bill[]; goals: Goal[];
}

const emptyState: State = {
  profile: { name: "User", email: "", userType: "personal", currency: "INR", onboardingCompleted: false, onboardingStep: 1 },
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
    case "account:remove": return { 
      ...state, 
      accounts: state.accounts.filter(a => a.id !== action.payload),
      transactions: state.transactions.filter(t => t.accountId !== action.payload)
    };
    case "txn:add": {
      const txn = action.payload;
      const accounts = state.accounts.map(acc => {
        if (acc.id === txn.accountId) {
          let diff = txn.amount;
          if (txn.kind === "expense" || txn.kind === "transfer") {
            diff = -diff;
          }
          return { ...acc, balance: acc.balance + diff };
        }
        return acc;
      });
      return { ...state, accounts, transactions: [txn, ...state.transactions] };
    }
    case "txn:update": {
      const newTxn = action.payload;
      const oldTxn = state.transactions.find(t => t.id === newTxn.id);
      if (!oldTxn) return state;

      const accounts = state.accounts.map(acc => {
        let bal = acc.balance;
        if (acc.id === oldTxn.accountId) {
          // Revert old transaction effect
          let diff = oldTxn.amount;
          if (oldTxn.kind === "income") {
            diff = -diff;
          }
          bal += diff;
        }
        if (acc.id === newTxn.accountId) {
          // Apply new transaction effect
          let diff = newTxn.amount;
          if (newTxn.kind === "expense" || newTxn.kind === "transfer") {
            diff = -diff;
          }
          bal += diff;
        }
        return { ...acc, balance: bal };
      });
      return { ...state, accounts, transactions: upsert(state.transactions, newTxn) };
    }
    case "txn:remove": {
      const txnId = action.payload;
      const txn = state.transactions.find(t => t.id === txnId);
      if (!txn) return state;
      const accounts = state.accounts.map(acc => {
        if (acc.id === txn.accountId) {
          let diff = txn.amount;
          if (txn.kind === "income") {
            diff = -diff;
          }
          return { ...acc, balance: acc.balance + diff };
        }
        return acc;
      });
      return { ...state, accounts, transactions: state.transactions.filter(t => t.id !== txnId) };
    }
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

const Ctx = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
  loading: boolean;
  syncStatus: "saved" | "saving" | "offline" | "failed";
} | null>(null);

function isEmpty(s: State) {
  return !s.accounts?.length && !s.transactions?.length && !s.budgets?.length && !s.investments?.length && !s.loans?.length && !s.bills?.length && !s.goals?.length;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [state, dispatch] = useReducer(reducer, emptyState);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"saved" | "saving" | "offline" | "failed">("saved");
  
  const initialLoad = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);

  // Load from Supabase on user change
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    
    Promise.all([
      supabase.from("user_finance_state").select("state").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("onboarding_completed, onboarding_step").eq("id", user.id).maybeSingle()
    ]).then(([stateResult, profileResult]) => {
      if (cancelled) return;
      
      const raw = (stateResult.data?.state ?? {}) as Partial<State>;
      const pData = profileResult.data;
      
      const loadedProfile = {
        ...emptyState.profile,
        ...(raw.profile ?? {}),
        email: user.email ?? "",
        onboardingCompleted: pData?.onboarding_completed ?? false,
        onboardingStep: pData?.onboarding_step ?? 1
      };
      
      const loaded: State = {
        ...emptyState,
        ...raw,
        profile: loadedProfile
      };
      
      if (isEmpty(loaded)) {
        const seeded = {
          ...emptyState,
          profile: {
            ...loadedProfile,
            name: user.user_metadata?.full_name ?? emptyState.profile.name
          }
        };
        dispatch({ type: "hydrate", payload: seeded });
      } else {
        dispatch({ type: "hydrate", payload: loaded });
      }
      initialLoad.current = true;
      setLoading(false);
    });
    
    return () => { cancelled = true; };
  }, [user?.id, authLoading]);

  const triggerSave = () => {
    if (!user || !initialLoad.current) return;
    if (!navigator.onLine) {
      setSyncStatus("offline");
      return;
    }

    setSyncStatus("saving");

    Promise.all([
      supabase.from("user_finance_state").upsert({
        user_id: user.id,
        state: state as never,
        updated_at: new Date().toISOString()
      }),
      supabase.from("profiles").update({
        onboarding_completed: state.profile.onboardingCompleted ?? false,
        onboarding_step: state.profile.onboardingStep ?? 1,
        user_type: state.profile.userType,
        currency: state.profile.currency,
        full_name: state.profile.name
      }).eq("id", user.id)
    ]).then(([res1, res2]) => {
      if (res1.error || res2.error) {
        console.error("Save error:", res1.error, res2.error);
        setSyncStatus("failed");
        scheduleRetry();
      } else {
        setSyncStatus("saved");
        retryCount.current = 0;
      }
    }).catch(err => {
      console.error("Save catch error:", err);
      setSyncStatus("failed");
      scheduleRetry();
    });
  };

  const scheduleRetry = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      retryCount.current += 1;
      triggerSave();
    }, Math.min(10000, 2000 * retryCount.current)); // exponential backoff
  };

  // Online/Offline listeners
  useEffect(() => {
    const handleOnline = () => {
      if (syncStatus === "offline" || syncStatus === "failed") {
        triggerSave();
      }
    };
    const handleOffline = () => {
      setSyncStatus("offline");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncStatus]);

  // Save on state change (debounced)
  useEffect(() => {
    if (!user || !initialLoad.current) return;
    setSyncStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      triggerSave();
    }, 1000); // 1s debounce
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [state, user?.id]);

  return <Ctx.Provider value={{ state, dispatch, loading, syncStatus }}>{children}</Ctx.Provider>;
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

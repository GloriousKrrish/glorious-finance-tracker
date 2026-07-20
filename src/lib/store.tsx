import { createContext, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  SynchronizationEngine,
  EventEngine,
  ValidationEngine,
  AutomationEngine,
  type FinancialEventType
} from "@/lib/financial-engine";

export type ID = string;

export interface Account { id: ID; name: string; type: "bank" | "cash" | "credit_card" | "wallet" | "investment"; balance: number; institution?: string; }
export type TxnKind =
  | "income"
  | "expense"
  | "transfer"
  | "loan_payment"
  | "investment_purchase"
  | "investment_sale"
  | "goal_contribution"
  | "bill_payment"
  | "refund"
  | "interest"
  | "dividend"
  | "adjustment";

export interface Transaction {
  id: ID;
  date: string;
  amount: number;
  kind: TxnKind;
  category: string;
  accountId: ID;
  toAccountId?: ID;
  merchant?: string;
  note?: string;
  
  // Ledger Fields
  currency?: string;
  reference?: string;
  tags?: string[];
  createdTime?: string;
  updatedTime?: string;
  status?: "pending" | "cleared" | "failed" | "reversed";
  linkedEntityId?: ID;
  linkedEntityType?: "loan" | "goal" | "bill" | "investment";
  metadata?: Record<string, any>;
}
export interface Budget { id: ID; category: string; limit: number; period: "monthly" | "weekly" | "yearly"; }
export interface Investment { id: ID; name: string; type: "stock" | "mutual_fund" | "gold" | "fd" | "ppf" | "nps" | "bond" | "crypto" | "other"; invested: number; current: number; units?: number; }
export interface Loan { id: ID; name: string; type: "home" | "car" | "personal" | "education" | "gold" | "business"; principal: number; outstanding: number; rate: number; emi: number; tenureMonths: number; startDate: string; accountId?: ID; }
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
  | { type: "goal:add"; payload: Goal } | { type: "goal:update"; payload: Goal } | { type: "goal:remove"; payload: ID }
  | { type: "goal:contribute"; payload: { goalId: ID; amount: number; accountId: ID; date?: string } }
  | { type: "bill:pay"; payload: { billId: ID; accountId: ID; date?: string } }
  | { type: "loan:pay"; payload: { loanId: ID; amount: number; accountId: ID; date?: string } };

function upsert<T extends { id: ID }>(arr: T[], item: T) {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i === -1) return [item, ...arr];
  const c = arr.slice(); c[i] = item; return c;
}

function reducer(state: State, action: Action): State {
  let eventType: FinancialEventType | null = null;
  let payload: any = null;

  switch (action.type) {
    case "account:add": eventType = "account.created"; payload = action.payload; break;
    case "account:update": eventType = "account.updated"; payload = action.payload; break;
    case "account:remove": eventType = "account.deleted"; payload = action.payload; break;
    case "txn:add": eventType = "transaction.created"; payload = action.payload; break;
    case "txn:update": eventType = "transaction.updated"; payload = action.payload; break;
    case "txn:remove": eventType = "transaction.deleted"; payload = action.payload; break;
    case "budget:add": eventType = "budget.created"; payload = action.payload; break;
    case "budget:update": eventType = "budget.updated"; payload = action.payload; break;
    case "budget:remove": eventType = "budget.deleted"; payload = action.payload; break;
    case "inv:add": eventType = "investment.created"; payload = action.payload; break;
    case "inv:update": eventType = "investment.updated"; payload = action.payload; break;
    case "inv:remove": eventType = "investment.deleted"; payload = action.payload; break;
    case "loan:add": eventType = "loan.created"; payload = action.payload; break;
    case "loan:update": eventType = "loan.updated"; payload = action.payload; break;
    case "loan:remove": eventType = "loan.deleted"; payload = action.payload; break;
    case "bill:add": eventType = "bill.created"; payload = action.payload; break;
    case "bill:update": eventType = "bill.updated"; payload = action.payload; break;
    case "bill:remove": eventType = "bill.deleted"; payload = action.payload; break;
    case "goal:add": eventType = "goal.created"; payload = action.payload; break;
    case "goal:update": eventType = "goal.updated"; payload = action.payload; break;
    case "goal:remove": eventType = "goal.deleted"; payload = action.payload; break;
    case "goal:contribute": eventType = "goal.contribution"; payload = action.payload; break;
    case "bill:pay": eventType = "bill.paid"; payload = action.payload; break;
    case "loan:pay": eventType = "loan.payment"; payload = action.payload; break;
  }

  if (eventType) {
    const event = EventEngine.createEvent(eventType, payload);
    const { nextState } = SynchronizationEngine.processEvent(state, event);
    return nextState;
  }

  switch (action.type) {
    case "hydrate": return action.payload;
    case "reset": return emptyState;
    case "loadDemo": return emptyState;
    case "profile:update": return { ...state, profile: { ...state.profile, ...action.payload } };
    default: return state;
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

  // Initialize Automation Engine
  useEffect(() => {
    AutomationEngine.initialize();
  }, []);

  // Safe dispatch with pre-flight Validation Engine checks
  const safeDispatch = (action: Action) => {
    let eventType: FinancialEventType | null = null;
    let payload: any = null;

    switch (action.type) {
      case "account:add": eventType = "account.created"; payload = action.payload; break;
      case "account:update": eventType = "account.updated"; payload = action.payload; break;
      case "account:remove": eventType = "account.deleted"; payload = action.payload; break;
      case "txn:add": eventType = "transaction.created"; payload = action.payload; break;
      case "txn:update": eventType = "transaction.updated"; payload = action.payload; break;
      case "txn:remove": eventType = "transaction.deleted"; payload = action.payload; break;
      case "budget:add": eventType = "budget.created"; payload = action.payload; break;
      case "budget:update": eventType = "budget.updated"; payload = action.payload; break;
      case "budget:remove": eventType = "budget.deleted"; payload = action.payload; break;
      case "inv:add": eventType = "investment.created"; payload = action.payload; break;
      case "inv:update": eventType = "investment.updated"; payload = action.payload; break;
      case "inv:remove": eventType = "investment.deleted"; payload = action.payload; break;
      case "loan:add": eventType = "loan.created"; payload = action.payload; break;
      case "loan:update": eventType = "loan.updated"; payload = action.payload; break;
      case "loan:remove": eventType = "loan.deleted"; payload = action.payload; break;
      case "bill:add": eventType = "bill.created"; payload = action.payload; break;
      case "bill:update": eventType = "bill.updated"; payload = action.payload; break;
      case "bill:remove": eventType = "bill.deleted"; payload = action.payload; break;
      case "goal:add": eventType = "goal.created"; payload = action.payload; break;
      case "goal:update": eventType = "goal.updated"; payload = action.payload; break;
      case "goal:remove": eventType = "goal.deleted"; payload = action.payload; break;
      case "goal:contribute": eventType = "goal.contribution"; payload = action.payload; break;
      case "bill:pay": eventType = "bill.paid"; payload = action.payload; break;
      case "loan:pay": eventType = "loan.payment"; payload = action.payload; break;
    }

    if (eventType) {
      const event = EventEngine.createEvent(eventType, payload);
      const valResult = ValidationEngine.validate(state, event);
      if (!valResult.isValid) {
        toast.error(valResult.error || "Validation error");
        return;
      }
    }

    dispatch(action);
  };

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
    }, Math.min(10000, 2000 * retryCount.current));
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
    }, 1000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [state, user?.id]);

  return <Ctx.Provider value={{ state, dispatch: safeDispatch, loading, syncStatus }}>{children}</Ctx.Provider>;
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

import type { State } from "../store";

export interface Workspace {
  id: string;
  name: string;
  type: "personal" | "family" | "business" | "rental" | "parents" | "side_hustle" | "custom";
  description: string;
  createdAt: string;
}

export const SEED_WORKSPACES: Workspace[] = [
  { id: "personal", name: "Personal Finance", type: "personal", description: "Default personal wealth dashboard", createdAt: "2026-01-01T00:00:00Z" },
  { id: "family", name: "Family Joint Wealth", type: "family", description: "Shared budget and goals for family members", createdAt: "2026-02-15T00:00:00Z" },
  { id: "business", name: "Glorious Corp LLC", type: "business", description: "Business invoices, expenses, and accounts", createdAt: "2026-03-10T00:00:00Z" },
  { id: "rental", name: "Oakwood Rental Property", type: "rental", description: "Cash flow tracking for real estate rental income", createdAt: "2026-04-01T00:00:00Z" },
  { id: "parents", name: "Parents Financial Care", type: "parents", description: "Retirement pension and medical bills management", createdAt: "2026-05-18T00:00:00Z" },
  { id: "side_hustle", name: "Consulting Side Hustle", type: "side_hustle", description: "Freelancing income and tax deductions", createdAt: "2026-06-01T00:00:00Z" },
];

export class WorkspaceEngine {
  public static getWorkspaces(): Workspace[] {
    const local = localStorage.getItem("gf_workspaces");
    if (!local) {
      localStorage.setItem("gf_workspaces", JSON.stringify(SEED_WORKSPACES));
      return SEED_WORKSPACES;
    }
    return JSON.parse(local);
  }

  public static addWorkspace(name: string, type: Workspace["type"], description: string): Workspace {
    const workspaces = this.getWorkspaces();
    const newWs: Workspace = {
      id: `ws_${Math.random().toString(36).substring(2, 9)}`,
      name,
      type,
      description,
      createdAt: new Date().toISOString(),
    };
    workspaces.push(newWs);
    localStorage.setItem("gf_workspaces", JSON.stringify(workspaces));
    return newWs;
  }

  public static deleteWorkspace(id: string): void {
    const workspaces = this.getWorkspaces().filter(w => w.id !== id);
    localStorage.setItem("gf_workspaces", JSON.stringify(workspaces));
  }

  /**
   * Filters the complete Financial State to display only the data belonging to the selected workspace.
   * If an item lacks a workspaceId, it is defaulted to the "personal" workspace to preserve backwards compatibility.
   */
  public static getWorkspaceState(state: State, workspaceId: string): State {
    const wId = workspaceId || "personal";
    
    return {
      ...state,
      accounts: state.accounts.filter(item => (item.workspaceId || "personal") === wId),
      transactions: state.transactions.filter(item => (item.workspaceId || "personal") === wId),
      budgets: state.budgets.filter(item => (item.workspaceId || "personal") === wId),
      investments: state.investments.filter(item => (item.workspaceId || "personal") === wId),
      loans: state.loans.filter(item => (item.workspaceId || "personal") === wId),
      bills: state.bills.filter(item => (item.workspaceId || "personal") === wId),
      goals: state.goals.filter(item => (item.workspaceId || "personal") === wId),
    };
  }

  /**
   * Inject workspaceId into target items before addition.
   */
  public static tagWithWorkspace<T>(item: T, workspaceId: string): T & { workspaceId: string } {
    return {
      ...item,
      workspaceId: workspaceId || "personal",
    };
  }
}

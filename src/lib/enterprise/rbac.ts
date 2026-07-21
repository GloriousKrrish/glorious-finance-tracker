export type UserRole = "owner" | "admin" | "family_member" | "accountant" | "financial_advisor" | "viewer" | "custom";

export type Permission =
  | "view_accounts"
  | "create_transactions"
  | "approve_imports"
  | "delete_records"
  | "manage_investments"
  | "generate_reports"
  | "export_data"
  | "manage_ai"
  | "manage_users"
  | "manage_workspaces";

export interface RoleConfig {
  role: UserRole;
  name: string;
  permissions: Permission[];
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  owner: {
    role: "owner",
    name: "Owner",
    permissions: [
      "view_accounts",
      "create_transactions",
      "approve_imports",
      "delete_records",
      "manage_investments",
      "generate_reports",
      "export_data",
      "manage_ai",
      "manage_users",
      "manage_workspaces"
    ]
  },
  admin: {
    role: "admin",
    name: "Administrator",
    permissions: [
      "view_accounts",
      "create_transactions",
      "approve_imports",
      "manage_investments",
      "generate_reports",
      "export_data",
      "manage_ai",
      "manage_users",
      "manage_workspaces"
    ]
  },
  family_member: {
    role: "family_member",
    name: "Family Member",
    permissions: [
      "view_accounts",
      "create_transactions",
      "approve_imports",
      "generate_reports",
      "manage_ai"
    ]
  },
  accountant: {
    role: "accountant",
    name: "Accountant",
    permissions: [
      "view_accounts",
      "create_transactions",
      "approve_imports",
      "generate_reports",
      "export_data"
    ]
  },
  financial_advisor: {
    role: "financial_advisor",
    name: "Financial Advisor",
    permissions: [
      "view_accounts",
      "manage_investments",
      "generate_reports",
      "export_data",
      "manage_ai"
    ]
  },
  viewer: {
    role: "viewer",
    name: "Viewer",
    permissions: [
      "view_accounts",
      "generate_reports"
    ]
  },
  custom: {
    role: "custom",
    name: "Custom Auditor",
    permissions: [
      "view_accounts",
      "export_data"
    ]
  }
};

export class RbacEngine {
  public static hasPermission(role: UserRole, permission: Permission): boolean {
    const config = ROLE_CONFIGS[role];
    if (!config) return false;
    return config.permissions.includes(permission);
  }

  public static getPermissionsForRole(role: UserRole): Permission[] {
    return ROLE_CONFIGS[role]?.permissions || [];
  }

  public static getRolesList(): RoleConfig[] {
    return Object.values(ROLE_CONFIGS);
  }
}

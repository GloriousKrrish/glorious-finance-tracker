export type RuleOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "greater_than"
  | "less_than"
  | "regex"
  | "in_list";

export interface RuleCondition {
  id: string;
  field: string; // e.g., 'amount', 'category', 'workspaceId', 'merchant', 'kind'
  operator: RuleOperator;
  value: any;
}

export interface RuleGroup {
  logic: "AND" | "OR";
  conditions: RuleCondition[];
}

export class RuleEngine {
  /**
   * Evaluates a condition group against a target data object (e.g. event payload or ledger record)
   */
  public static evaluateGroup(group: RuleGroup, targetData: Record<string, any>): boolean {
    if (!group || !group.conditions || group.conditions.length === 0) {
      return true; // Empty conditions pass by default
    }

    if (group.logic === "AND") {
      return group.conditions.every(cond => this.evaluateCondition(cond, targetData));
    } else {
      return group.conditions.some(cond => this.evaluateCondition(cond, targetData));
    }
  }

  public static evaluateCondition(condition: RuleCondition, targetData: Record<string, any>): boolean {
    const actualVal = this.getNestedValue(targetData, condition.field);
    const targetVal = condition.value;

    if (actualVal === undefined || actualVal === null) {
      return condition.operator === "not_equals";
    }

    switch (condition.operator) {
      case "equals":
        return String(actualVal).toLowerCase() === String(targetVal).toLowerCase();

      case "not_equals":
        return String(actualVal).toLowerCase() !== String(targetVal).toLowerCase();

      case "contains":
        return String(actualVal).toLowerCase().includes(String(targetVal).toLowerCase());

      case "greater_than": {
        const numActual = Number(actualVal);
        const numTarget = Number(targetVal);
        return !isNaN(numActual) && !isNaN(numTarget) && numActual > numTarget;
      }

      case "less_than": {
        const numActual = Number(actualVal);
        const numTarget = Number(targetVal);
        return !isNaN(numActual) && !isNaN(numTarget) && numActual < numTarget;
      }

      case "regex": {
        try {
          const re = new RegExp(String(targetVal), "i");
          return re.test(String(actualVal));
        } catch {
          return false;
        }
      }

      case "in_list": {
        const list = Array.isArray(targetVal) ? targetVal : String(targetVal).split(",").map(s => s.trim());
        return list.some(item => String(item).toLowerCase() === String(actualVal).toLowerCase());
      }

      default:
        return false;
    }
  }

  private static getNestedValue(obj: Record<string, any>, path: string): any {
    if (!obj || !path) return undefined;
    const keys = path.split(".");
    let current = obj;
    for (const k of keys) {
      if (current && typeof current === "object" && k in current) {
        current = current[k];
      } else {
        return undefined;
      }
    }
    return current;
  }
}

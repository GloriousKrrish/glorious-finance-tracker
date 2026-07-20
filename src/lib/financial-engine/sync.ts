import type { State, FinancialEvent } from "./types";
import { ValidationEngine } from "./validation";
import { RulesEngine } from "./rules";
import { EventEngine } from "./events";

export class SynchronizationEngine {
  public static processEvent(state: State, event: FinancialEvent): {
    nextState: State;
    error?: string;
  } {
    // 1. Run Pre-flight Validation
    const valResult = ValidationEngine.validate(state, event);
    if (!valResult.isValid) {
      return { nextState: state, error: valResult.error };
    }

    // 2. Apply Rule State Transitions
    const nextState = RulesEngine.apply(state, event);

    // 3. Dispatch the event to subscribers
    EventEngine.dispatch(event);

    return { nextState };
  }
}

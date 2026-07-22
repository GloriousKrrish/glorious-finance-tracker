import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type State } from "@/lib/financial-engine";
import { callCopilotGemini } from "@/lib/copilot/copilot-server";
import { IntentEngine } from "@/lib/copilot/intent-engine";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const chatWithAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messages: ChatMessage[] }) => {
    if (!Array.isArray(input?.messages) || input.messages.length === 0) {
      throw new Error("messages array required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    // Fetch user's finance state from Supabase
    const { data: row } = await context.supabase
      .from("user_finance_state")
      .select("state")
      .eq("user_id", context.userId)
      .maybeSingle();
      
    const rawState = (row?.state ?? {}) as Record<string, unknown>;

    const fullState: State = {
      profile: (rawState.profile as any) ?? {
        name: "User",
        email: "",
        userType: "personal",
        currency: "INR",
        onboardingCompleted: true,
        onboardingStep: 4,
      },
      accounts: (rawState.accounts as any) ?? [],
      transactions: (rawState.transactions as any) ?? [],
      budgets: (rawState.budgets as any) ?? [],
      investments: (rawState.investments as any) ?? [],
      loans: (rawState.loans as any) ?? [],
      bills: (rawState.bills as any) ?? [],
      goals: (rawState.goals as any) ?? [],
    };

    const lastMessage = data.messages[data.messages.length - 1];
    const history = data.messages.slice(0, -1);
    const intent = IntentEngine.classifyIntent(lastMessage.content);

    // Call the single canonical Copilot server service
    const result = await callCopilotGemini({
      data: {
        userMessage: lastMessage.content,
        history,
        state: fullState,
        intent,
        coachType: "wealth_coach",
      },
    });

    if (result.error && !result.content) {
      throw new Error(`AI Financial Assistant service error: ${result.error}`);
    }

    return { content: result.content };
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ContextEngine, type State } from "@/lib/financial-engine";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const chatWithAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messages: ChatMessage[] }) => {
    if (!Array.isArray(input?.messages)) throw new Error("messages required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env.Glorious_Finance || process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI Financial Assistant is not configured. Please check your environment keys.");

    // Fetch user's finance state for context
    const { data: row } = await context.supabase
      .from("user_finance_state")
      .select("state")
      .eq("user_id", context.userId)
      .maybeSingle();
      
    const rawState = (row?.state ?? {}) as Record<string, unknown>;

    // Formulate a robust, fully-typed State object
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

    // Build the canonical context payload via the Context Engine
    const aiContext = ContextEngine.buildAiContext(fullState);

    const systemPrompt = `You are the GloriousFinance AI Assistant — a warm, precise personal-finance advisor for an Indian user. All amounts are in Indian Rupees (₹) unless stated otherwise.
    
    CRITICAL RULE: You MUST NEVER calculate Net Worth, Cash Flow, Savings Rate, Debt Ratios, or Forecasts yourself. These values are deterministically pre-calculated by the Financial Operating System and are supplied in the context below. You are a presentation and advisory layer: your job is to explain these metrics, identify trends, answer questions, and offer friendly, concise, non-regulated coaching. Never invent or estimate numbers.
    
    Style: editorial, calm, concise. Use short paragraphs and bullet points. Format numbers in Indian style (e.g. ₹1,25,000). Provide gentle, non-prescriptive suggestions.

    FINANCIAL CONTEXT (JSON):
    ${aiContext}`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            ...data.messages,
          ],
        }),
      });

      if (res.status === 429) {
        throw new Error("Rate limit reached. Please try again in a moment.");
      }
      if (res.status === 402) {
        throw new Error("AI credits exhausted. Please verify credits or API keys.");
      }
      if (!res.ok) {
        throw new Error(`AI request failed: ${res.status}`);
      }

      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = json.choices?.[0]?.message?.content ?? "";
      return { content };
    } catch (error) {
      console.error("AI Assistant request error:", error);
      throw new Error(
        error instanceof Error ? error.message : "The AI Assistant encountered a transient request error."
      );
    }
  });

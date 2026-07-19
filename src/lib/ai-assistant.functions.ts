import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface ChatMessage { role: "user" | "assistant"; content: string; }

export const chatWithAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messages: ChatMessage[] }) => {
    if (!Array.isArray(input?.messages)) throw new Error("messages required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI not configured");

    // Fetch user's finance state for context
    const { data: row } = await context.supabase
      .from("user_finance_state")
      .select("state")
      .eq("user_id", context.userId)
      .maybeSingle();
    const state = (row?.state ?? {}) as Record<string, unknown>;

    // Build a compact summary (avoid dumping everything)
    const summary = summarize(state);

    const systemPrompt = `You are the GloriousFinance AI Assistant — a warm, precise personal-finance concierge for an Indian user. All amounts are in Indian Rupees (₹) unless stated otherwise. Answer strictly from the user's data below when the question is about their finances. If information is missing, say so briefly and suggest what to add.

Style: editorial, calm, concise. Use short paragraphs and bullet points. Format numbers in Indian style (e.g. ₹1,25,000). Provide gentle, non-prescriptive suggestions — never give regulated investment or tax advice; frame suggestions as informational.

USER FINANCE SNAPSHOT (JSON):
${summary}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...data.messages],
      }),
    });

    if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in Lovable workspace settings.");
    if (!res.ok) throw new Error(`AI request failed: ${res.status}`);

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "";
    return { content };
  });

function summarize(s: Record<string, unknown>) {
  const pick = (k: string) => (Array.isArray(s[k]) ? (s[k] as unknown[]) : []);
  const compact = {
    profile: s.profile,
    accounts: pick("accounts").map((a: any) => ({ name: a.name, type: a.type, balance: a.balance })),
    recent_transactions: pick("transactions").slice(0, 40).map((t: any) => ({ date: t.date, kind: t.kind, category: t.category, amount: t.amount, merchant: t.merchant })),
    budgets: pick("budgets"),
    investments: pick("investments").map((i: any) => ({ name: i.name, type: i.type, invested: i.invested, current: i.current })),
    loans: pick("loans").map((l: any) => ({ name: l.name, outstanding: l.outstanding, emi: l.emi, rate: l.rate })),
    bills: pick("bills").map((b: any) => ({ name: b.name, amount: b.amount, dueDate: b.dueDate, paid: b.paid })),
    goals: pick("goals").map((g: any) => ({ name: g.name, target: g.target, saved: g.saved, deadline: g.deadline })),
  };
  return JSON.stringify(compact);
}

import { createServerFn } from "@tanstack/react-start";
import { ContextEngine, type State } from "../financial-engine";
import { FinancialCoaches, type CoachType } from "./financial-coaches";
import { ResponseValidator } from "./response-validator";
import type { ExtractedFacts, PlanningGoal } from "./copilot-brain";

export interface CopilotChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CopilotServerRequestPayload {
  userMessage: string;
  history?: CopilotChatHistoryMessage[];
  state: State;
  intent: string;
  coachType?: CoachType;
  kbArticleTitle?: string;
  kbArticleDetails?: string;
  // ── NEW: Goal-Driven Context ──
  goalContext?: string;
  goalType?: PlanningGoal;
  goalName?: string;
  extractedFacts?: ExtractedFacts;
}

export interface CopilotServerResponsePayload {
  content: string;
  tokensUsed: number;
  isValid: boolean;
  error?: string;
}

/**
 * Server-side Financial Copilot Service.
 * Executed STRICTLY on the server via TanStack Start createServerFn.
 * Now goal-aware: receives planning goal, extracted facts, and Financial OS context.
 */
export const callCopilotGemini = createServerFn({ method: "POST" })
  .validator((input: CopilotServerRequestPayload) => {
    if (!input?.userMessage) throw new Error("userMessage is required");
    if (!input?.state) throw new Error("Financial OS state is required");
    return input;
  })
  .handler(async ({ data }): Promise<CopilotServerResponsePayload> => {
    const apiKey =
      process.env.Glorious_Finance ||
      process.env.LOVABLE_API_KEY ||
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        content: "",
        tokensUsed: 0,
        isValid: false,
        error: "no_api_key"
      };
    }

    const intent = data.intent || "GeneralFinance";
    const coachType = data.coachType || "wealth_coach";
    const coach = FinancialCoaches.getCoach(coachType);

    // ── 1. Build Context ──
    // Prefer goal-specific context if available, otherwise fall back to intent-sliced
    const context = data.goalContext || ContextEngine.buildIntentSlicedContext(data.state, intent);

    // ── 2. Build Goal-Aware System Prompt ──
    const goalName = data.goalName || "Financial Advisory";
    const goalType = data.goalType || "general_finance";

    // Format extracted facts for the prompt
    let factsBlock = "";
    if (data.extractedFacts && Object.keys(data.extractedFacts).length > 0) {
      const entries = Object.entries(data.extractedFacts)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `  ${k}: ${v}`);
      if (entries.length > 0) {
        factsBlock = `\nUSER-PROVIDED FACTS (verified, do NOT re-ask these):\n${entries.join("\n")}`;
      }
    }

    let systemPrompt = `${coach.systemInstruction}

CRITICAL BEHAVIORAL DIRECTIVES:

1. You are the GloriousFinance Financial Copilot — a combined Chartered Accountant + Certified Financial Planner + Investment Advisor.
2. All monetary values are in Indian Rupees (₹).
3. NEVER calculate Net Worth, Cash Flow, Savings Rate, Debt Ratios, Tax Slabs, or Forecasts yourself. These are deterministically computed by the Financial OS and supplied below.
4. Your role is to REASON, ADVISE, COACH, and PLAN — not to dump data.
5. Speak naturally, like a trusted financial advisor sitting across the table. Not like documentation.
6. NEVER start with "Financial Overview" or "Financial Snapshot" unless explicitly asked.
7. When giving advice, structure it as an ACTION PLAN with priorities, estimated benefits, timelines, and next steps.
8. If this is a planning session (tax planning, investment strategy, retirement, etc.), generate a structured plan — NOT paragraphs.
9. Do NOT use generic filler phrases like "consult a qualified financial advisor" — YOU are the advisor.

USER'S PLANNING GOAL: ${goalName} (type: ${goalType})
COACH PERSONA: ${coach.name} — ${coach.roleTitle}

FINANCIAL OS CONTEXT:
${context}
${factsBlock}

RESPONSE FORMAT:
- Use markdown with headers, bullet points, and bold for key numbers
- For planning goals, use a structured action plan format with Priority 1, Priority 2, etc.
- Include estimated benefits (₹ amounts) wherever possible
- End with clear Next Steps
- Keep responses focused and actionable — no fluff`;

    if (data.kbArticleTitle && data.kbArticleDetails) {
      systemPrompt += `\n\nKNOWLEDGE BASE REFERENCE:\nTopic: ${data.kbArticleTitle}\nDetails: ${data.kbArticleDetails}`;
    }

    const isDirectGemini = apiKey.startsWith("AQ.") || apiKey.startsWith("AIzaSy");

    // ── 3. Multi-Turn Conversation History ──
    const history = data.history ?? [];
    const sanitizedHistory = history
      .slice(-8) // Keep last 8 messages for stronger conversational context
      .filter((m) => m.content && m.content.trim() !== "");

    try {
      let rawContent = "";
      let tokensUsed = 0;

      if (isDirectGemini) {
        // Direct Google Generative AI API
        const contentsPayload = [
          ...sanitizedHistory.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          {
            role: "user",
            parts: [{ text: data.userMessage }],
          },
        ];

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: contentsPayload,
              systemInstruction: {
                parts: [{ text: systemPrompt }],
              },
            }),
          }
        );

        if (response.ok) {
          const json = (await response.json()) as any;
          rawContent = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          tokensUsed = json.usageMetadata?.totalTokenCount ?? 400;
        } else {
          const errText = await response.text();
          console.error("[CopilotServer] Direct Gemini API Error:", response.status, errText);
          return {
            content: "",
            tokensUsed: 0,
            isValid: false,
            error: `gemini_status_${response.status}`
          };
        }
      } else {
        // Lovable AI Gateway Fallback
        const messagesPayload = [
          { role: "system", content: systemPrompt },
          ...sanitizedHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          { role: "user", content: data.userMessage },
        ];

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: messagesPayload,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error("[CopilotServer] AI Gateway Error:", res.status, errText);
          return {
            content: "",
            tokensUsed: 0,
            isValid: false,
            error: `gateway_status_${res.status}`
          };
        }

        const json = (await res.json()) as any;
        rawContent = json.choices?.[0]?.message?.content ?? "";
        tokensUsed = json.usage?.total_tokens ?? 400;
      }

      if (!rawContent) {
        return {
          content: "",
          tokensUsed: 0,
          isValid: false,
          error: "empty_response"
        };
      }

      // ── 4. Response Validation ──
      const validation = ResponseValidator.validateResponse(rawContent);

      return {
        content: validation.sanitizedResponse,
        tokensUsed,
        isValid: validation.isValid,
      };
    } catch (err: any) {
      console.error("[CopilotServer] Execution Exception:", err);
      return {
        content: "",
        tokensUsed: 0,
        isValid: false,
        error: err.message || "server_execution_exception"
      };
    }
  });

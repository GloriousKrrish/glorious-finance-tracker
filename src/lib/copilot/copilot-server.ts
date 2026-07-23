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
    if (!input?.userMessage || typeof input.userMessage !== "string") {
      throw new Error("userMessage string is required");
    }
    if (input.userMessage.length > 4000) {
      input.userMessage = input.userMessage.slice(0, 4000);
    }
    if (!input?.state) throw new Error("Financial OS state is required");
    return input;
  })
  .handler(async ({ data }): Promise<CopilotServerResponsePayload> => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.Glorious_Finance;

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
    const context = data.goalContext || ContextEngine.buildIntentSlicedContext(data.state, intent);

    // ── 2. Build Goal-Aware System Prompt ──
    const goalName = data.goalName || "Financial Advisory";
    const goalType = data.goalType || "general_finance";

    let factsBlock = "";
    if (data.extractedFacts && Object.keys(data.extractedFacts).length > 0) {
      const entries = Object.entries(data.extractedFacts)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `  ${k}: ${v}`);
      if (entries.length > 0) {
        factsBlock = `\nUSER-PROVIDED FACTS (verified, do NOT re-ask these):\n${entries.join("\n")}`;
      }
    }

    let systemPrompt = `You are GloriousFinance AI — a world-class AI Financial Advisor combining the capabilities of:
• ChatGPT (natural, highly intelligent, conversational reasoning)
• Certified Financial Planner (CFP)
• Chartered Accountant (CA)
• Investment Advisor & Wealth Manager
• Retirement Planner & Personal Financial Coach

CORE BEHAVIORAL DIRECTIVES:
1. YOU ARE THE PRIMARY BRAIN. Communicate with natural intelligence, warmth, clarity, and authority.
2. REASON BEFORE ANSWERING: First ask "What does the user actually want?" instead of matching rigid intent patterns.
3. FINANCIAL DATA USE: Use personal ledger context ONLY if the question is about the user's personal finances or when building a personal plan.
4. GENERAL FINANCE QUESTIONS: Answer directly using world financial knowledge.
5. ZERO ARCHITECTURE EXPOSURE: NEVER mention internal system architecture or provider details.
6. MONETARY AMOUNTS: Default to Indian Rupees (₹) unless asked about other currencies.

USER'S CONVERSATIONAL TOPIC: ${goalName} (type: ${goalType})
ADVISOR PERSONA FOCUS: ${coach.name} — ${coach.roleTitle}

CONTEXT:
${context}
${factsBlock}`;

    if (data.kbArticleTitle && data.kbArticleDetails) {
      systemPrompt += `\n\nFINANCE KNOWLEDGE REFERENCE:\nTopic: ${data.kbArticleTitle}\nDetails: ${data.kbArticleDetails}`;
    }

    const history = data.history ?? [];
    const sanitizedHistory = history
      .slice(-8)
      .filter((m) => m.content && m.content.trim() !== "");

    try {
      let rawContent = "";
      let tokensUsed = 0;

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
        console.error("[CopilotServer] Generative API Error:", response.status);
        return {
          content: "",
          tokensUsed: 0,
          isValid: false,
          error: "service_unavailable"
        };
      }

      if (!rawContent) {
        return {
          content: "",
          tokensUsed: 0,
          isValid: false,
          error: "empty_response"
        };
      }

      const validation = ResponseValidator.validateResponse(rawContent);

      return {
        content: validation.sanitizedResponse,
        tokensUsed,
        isValid: validation.isValid,
      };
    } catch (err: any) {
      console.error("[CopilotServer] Execution Exception:", err?.message || err);
      return {
        content: "",
        tokensUsed: 0,
        isValid: false,
        error: "internal_server_error"
      };
    }
  });

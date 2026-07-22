import { createServerFn } from "@tanstack/react-start";
import { ContextEngine, type State } from "../financial-engine";
import { FinancialCoaches, type CoachType } from "./financial-coaches";
import { ResponseValidator } from "./response-validator";

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
 * Protects API keys, builds server-side intent-sliced prompt, formats multi-turn history,
 * and calls Gemini API cleanly.
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

    // ── 1. Server-Side Context Builder (Intent Slicing) ────────────────
    const slicedContextJson = ContextEngine.buildIntentSlicedContext(data.state, intent);

    // ── 2. Server-Side System Prompt Assembly ──────────────────────────
    let systemPrompt = `${coach.systemInstruction}

CRITICAL ARCHITECTURAL DIRECTIVE:
1. You are the GloriousFinance Copilot. All monetary values are in Indian Rupees (₹) unless specified otherwise.
2. You MUST NEVER calculate Net Worth, Cash Flow, Savings Rate, Debt Ratios, Tax Slabs, or Forecasts yourself. These numbers are deterministically computed by the Financial Operating System and supplied in the CONTEXT below.
3. Your role is purely advisory, explanatory, and editorial. Present the numbers, explain trends, answer user queries, and offer friendly, non-regulated coaching. Never invent, estimate, or hallucinate metrics.

CLASSIFIED INTENT: ${intent}
COACH PERSONA: ${coach.name} (${coach.roleTitle})

FINANCIAL OS CONTEXT (SLICED FOR INTENT '${intent}'):
${slicedContextJson}`;

    if (data.kbArticleTitle && data.kbArticleDetails) {
      systemPrompt += `\n\nRELEVANT KNOWLEDGE BASE REFERENCE:
Topic: ${data.kbArticleTitle}
Details: ${data.kbArticleDetails}`;
    }

    const isDirectGemini = apiKey.startsWith("AQ.") || apiKey.startsWith("AIzaSy");

    // ── 3. Multi-Turn Conversation History Assembly ───────────────────
    const history = data.history ?? [];
    const sanitizedHistory = history
      .slice(-6) // Keep last 6 messages for token efficiency & strong focus
      .filter((m) => m.content && m.content.trim() !== "");

    try {
      let rawContent = "";
      let tokensUsed = 0;

      if (isDirectGemini) {
        // Direct Google Generative AI API Format
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
        // Lovable AI Gateway Fallback Format
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

      // ── 4. Server-Side Response Validation ───────────────────────────
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

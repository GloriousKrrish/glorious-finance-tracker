import type { State } from "../store";
import { DomainGuard, type DomainGuardCheck } from "./domain-guard";
import { IntentEngine, type FinanceIntent } from "./intent-engine";
import { FinanceKnowledgeBase, type KnowledgeArticle } from "./knowledge-base";
import { CacheEngine } from "./cache-engine";
import { AICostOptimizer } from "./cost-optimizer";
import { FinancialCoaches, type CoachType } from "./financial-coaches";
import { ResponseValidator } from "./response-validator";
import { CitationEngine, type CitationRef } from "./citation-engine";
import { ContextEngine } from "../financial-engine";

export interface CopilotResponse {
  answerText: string;
  intent: FinanceIntent;
  domainCheck: DomainGuardCheck;
  source: "local_kb" | "local_cache" | "gemini_llm";
  tokensUsed: number;
  tokensSaved: number;
  citations: CitationRef[];
  kbArticle?: KnowledgeArticle;
}

export class RAGEngine {
  public static async processCopilotQuery(
    userMessage: string,
    state: State,
    coachType: CoachType = "wealth_coach",
    apiKey?: string
  ): Promise<CopilotResponse> {
    const text = userMessage.trim();

    // 1. Domain Guard Check
    const domainCheck = DomainGuard.checkDomain(text);
    if (!domainCheck.isFinanceRelated) {
      return {
        answerText: domainCheck.refusalMessage || "I specialize in finance and financial planning. I can't assist with unrelated topics.",
        intent: "NonFinance",
        domainCheck,
        source: "local_kb",
        tokensUsed: 0,
        tokensSaved: 1000,
        citations: []
      };
    }

    // 2. Intent Classification
    const intent = IntentEngine.classifyIntent(text);

    // 3. Local Knowledge Base Search (0 Token Cost)
    const kbMatch = FinanceKnowledgeBase.searchKnowledgeBase(text);
    if (kbMatch) {
      AICostOptimizer.recordQueryEvent("kb_hit", 0, 1200);
      const answer = `### ${kbMatch.title}\n\n${kbMatch.details}\n\n*Summary:* ${kbMatch.summary}`;
      const validated = ResponseValidator.validateResponse(answer);
      const citations = CitationEngine.extractCitations(validated.sanitizedResponse, kbMatch.title);

      return {
        answerText: validated.sanitizedResponse,
        intent,
        domainCheck,
        source: "local_kb",
        tokensUsed: 0,
        tokensSaved: 1200,
        citations,
        kbArticle: kbMatch
      };
    }

    // 4. Response Cache Lookup (0 Token Cost)
    const cached = CacheEngine.getCachedResponse(text);
    if (cached) {
      AICostOptimizer.recordQueryEvent("cache_hit", 0, 1000);
      const validated = ResponseValidator.validateResponse(cached.response);
      const citations = CitationEngine.extractCitations(validated.sanitizedResponse);

      return {
        answerText: validated.sanitizedResponse,
        intent,
        domainCheck,
        source: "local_cache",
        tokensUsed: 0,
        tokensSaved: 1000,
        citations
      };
    }

    // 5. Fallback LLM / Direct RAG Context Assembly
    const coach = FinancialCoaches.getCoach(coachType);
    const aiContext = ContextEngine.buildAiContext(state);

    const systemPrompt = `${coach.systemInstruction}

CRITICAL RULE: You MUST NEVER calculate Net Worth, Cash Flow, Savings Rate, Debt Ratios, or Forecasts yourself. These values are deterministically pre-calculated by the Financial Operating System and supplied in the context below. You are a presentation and advisory layer: your job is to explain these metrics, identify trends, answer questions, and offer friendly, concise, non-regulated coaching. Never invent or estimate numbers.

FINANCIAL CONTEXT (JSON):
${aiContext}`;

    // Execute via Gemini or simulated LLM response
    let answerContent = "";
    let tokensUsed = 350;

    if (apiKey && (apiKey.startsWith("AQ.") || apiKey.startsWith("AIzaSy"))) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text }] }],
              systemInstruction: { parts: [{ text: systemPrompt }] }
            })
          }
        );
        if (response.ok) {
          const json = await response.json();
          answerContent = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          tokensUsed = json.usageMetadata?.totalTokenCount ?? 400;
        }
      } catch (err) {
        console.error("[RAGEngine] Gemini API fetch error:", err);
      }
    }

    if (!answerContent) {
      // Fallback deterministic response grounded in Financial OS state
      const dashboard = state.accounts ? state.accounts.reduce((s, a) => s + a.balance, 0) : 0;
      answerContent = `Based on your Financial OS ledger for workspace **${state.profile?.userType || "Personal"}**:

• **Account Balances:** ₹${dashboard.toLocaleString("en-IN")} across active accounts.
• **Advice:** Your financial metrics are managed by the Financial Operating System. You can review your active budget caps, upcoming bills, and goal progress in the dashboard menus.`;
    }

    // Cache the generated response
    CacheEngine.setCachedResponse(text, answerContent, intent);
    AICostOptimizer.recordQueryEvent("api_call", tokensUsed, 0);

    const validated = ResponseValidator.validateResponse(answerContent);
    const citations = CitationEngine.extractCitations(validated.sanitizedResponse);

    return {
      answerText: validated.sanitizedResponse,
      intent,
      domainCheck,
      source: "gemini_llm",
      tokensUsed,
      tokensSaved: 0,
      citations
    };
  }
}

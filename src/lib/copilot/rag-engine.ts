import type { State } from "../store";
import { DomainGuardCheck } from "./domain-guard";
import { FinanceIntent } from "./intent-engine";
import { KnowledgeArticle } from "./knowledge-base";
import { CoachType } from "./financial-coaches";
import { CitationRef } from "./citation-engine";
import { CopilotChatHistoryMessage } from "./copilot-server";
import {
  FinancialCopilotBrain,
  type UserFacingLabel,
  type WorkflowState,
  type ExtractedFacts,
  type ActionPlan,
} from "./copilot-brain";

export interface CopilotResponse {
  answerText: string;
  intent: FinanceIntent;
  domainCheck: DomainGuardCheck;
  userFacingLabel: UserFacingLabel;
  isFollowUpRequired: boolean;
  citations: CitationRef[];
  kbArticle?: KnowledgeArticle;
  // ── NEW: Goal-Driven Fields ──
  workflowState?: WorkflowState;
  extractedFacts?: ExtractedFacts;
  actionPlan?: ActionPlan;
  followUpOptions?: string[];
}

export class RAGEngine {
  public static async processCopilotQuery(
    userMessage: string,
    state: State,
    coachType: CoachType = "wealth_coach",
    history: CopilotChatHistoryMessage[] = []
  ): Promise<CopilotResponse> {
    const brainResult = await FinancialCopilotBrain.processQuery(userMessage, state, coachType, history);

    return {
      answerText: brainResult.answerText,
      intent: brainResult.intent,
      domainCheck: brainResult.domainCheck,
      userFacingLabel: brainResult.userFacingLabel,
      isFollowUpRequired: brainResult.isFollowUpRequired,
      citations: brainResult.citations,
      workflowState: brainResult.workflowState,
      extractedFacts: brainResult.extractedFacts,
      actionPlan: brainResult.actionPlan,
      followUpOptions: brainResult.followUpOptions,
    };
  }
}

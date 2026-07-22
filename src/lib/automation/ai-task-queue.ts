import { JobQueueEngine, type BackgroundJob } from "./job-queue";

export type AITaskType =
  | "generate_summary"
  | "explain_report"
  | "analyze_spending"
  | "suggest_goal_optimization"
  | "tax_explanation"
  | "portfolio_commentary";

export interface AITaskRequest {
  taskType: AITaskType;
  workspaceId: string;
  contextData?: any;
}

export class AITaskQueue {
  public static enqueueAITask(taskType: AITaskType, workspaceId: string = "personal", contextData?: any): BackgroundJob {
    const titleMap: Record<AITaskType, string> = {
      generate_summary: "AI Summary Generation",
      explain_report: "AI Financial Report Commentary",
      analyze_spending: "AI Anomaly & Spending Pattern Analysis",
      suggest_goal_optimization: "AI Goal Funding & Debt Optimization Model",
      tax_explanation: "AI Income Tax Regime & SLA Advisory",
      portfolio_commentary: "AI Investment Risk & Alpha Breakdown"
    };

    return JobQueueEngine.enqueue(
      titleMap[taskType] || "AI Background Processing",
      "ai_job",
      "normal",
      workspaceId,
      { taskType, contextData }
    );
  }

  public static executeSimulatedAITask(jobId: string): void {
    JobQueueEngine.updateJobStatus(jobId, "running", 25);
    setTimeout(() => {
      JobQueueEngine.updateJobStatus(jobId, "running", 75);
      setTimeout(() => {
        JobQueueEngine.updateJobStatus(jobId, "completed", 100);
      }, 1000);
    }, 1000);
  }
}

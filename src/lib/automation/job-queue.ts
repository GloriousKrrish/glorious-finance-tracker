import { RetryEngine } from "./retry-engine";
import { DeadLetterQueue } from "./dead-letter-queue";

export type JobType =
  | "import_job"
  | "ocr_job"
  | "ai_job"
  | "forecast_job"
  | "report_generation"
  | "bank_sync"
  | "document_processing"
  | "search_indexing"
  | "cleanup_job";

export type JobPriority = "low" | "normal" | "high" | "critical";

export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "paused" | "retrying";

export interface BackgroundJob {
  id: string;
  name: string;
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  workspaceId: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  nextRetryAt?: string;
  attemptsMade: number;
  maxRetries: number;
  error?: string;
  progressPercent: number;
  payload?: any;
}

export class JobQueueEngine {
  private static STORAGE_KEY = "gf_background_jobs";

  public static getJobs(workspaceId?: string): BackgroundJob[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    const jobs: BackgroundJob[] = raw ? JSON.parse(raw) : this.getSeedJobs();
    if (workspaceId) {
      return jobs.filter(j => j.workspaceId === workspaceId);
    }
    return jobs;
  }

  public static enqueue(
    name: string,
    type: JobType,
    priority: JobPriority = "normal",
    workspaceId: string = "personal",
    payload?: any,
    maxRetries: number = 5
  ): BackgroundJob {
    const jobs = this.getJobs();
    const newJob: BackgroundJob = {
      id: `job_${Math.random().toString(36).substring(2, 9)}`,
      name,
      type,
      priority,
      status: "pending",
      workspaceId,
      createdAt: new Date().toISOString(),
      attemptsMade: 0,
      maxRetries,
      progressPercent: 0,
      payload
    };

    jobs.unshift(newJob);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(jobs));
    return newJob;
  }

  public static updateJobStatus(
    id: string,
    status: JobStatus,
    progressPercent?: number,
    errorMsg?: string
  ): BackgroundJob | undefined {
    const jobs = this.getJobs();
    const job = jobs.find(j => j.id === id);
    if (!job) return undefined;

    job.status = status;
    if (progressPercent !== undefined) job.progressPercent = progressPercent;
    if (errorMsg) job.error = errorMsg;

    if (status === "running" && !job.startedAt) {
      job.startedAt = new Date().toISOString();
      job.attemptsMade += 1;
    }

    if (status === "completed") {
      job.completedAt = new Date().toISOString();
      job.progressPercent = 100;
    }

    if (status === "failed") {
      if (RetryEngine.shouldRetry(job.attemptsMade, job.maxRetries)) {
        job.status = "retrying";
        job.nextRetryAt = RetryEngine.calculateNextRunTime(job.attemptsMade);
      } else {
        // Exceeded max retries -> Push to Dead Letter Queue
        DeadLetterQueue.add({
          jobId: job.id,
          jobName: job.name,
          queueName: job.type,
          workspaceId: job.workspaceId,
          attemptsMade: job.attemptsMade,
          maxRetries: job.maxRetries,
          lastError: errorMsg || "Maximum retry threshold exceeded",
          payload: job.payload
        });
      }
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(jobs));
    return job;
  }

  public static cancelJob(id: string): void {
    this.updateJobStatus(id, "cancelled");
  }

  public static retryJobNow(id: string): void {
    const jobs = this.getJobs();
    const job = jobs.find(j => j.id === id);
    if (job) {
      job.status = "pending";
      job.error = undefined;
      job.nextRetryAt = undefined;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(jobs));
    }
  }

  public static clearCompletedJobs(): void {
    const jobs = this.getJobs().filter(j => j.status !== "completed");
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(jobs));
  }

  private static getSeedJobs(): BackgroundJob[] {
    const seeds: BackgroundJob[] = [
      {
        id: "job_seed_1",
        name: "Morning Open Banking Ledger Sync",
        type: "bank_sync",
        priority: "high",
        status: "completed",
        workspaceId: "personal",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        startedAt: new Date(Date.now() - 3590000).toISOString(),
        completedAt: new Date(Date.now() - 3570000).toISOString(),
        attemptsMade: 1,
        maxRetries: 5,
        progressPercent: 100
      },
      {
        id: "job_seed_2",
        name: "Financial Intelligence AI Commentary",
        type: "ai_job",
        priority: "normal",
        status: "running",
        workspaceId: "personal",
        createdAt: new Date(Date.now() - 120000).toISOString(),
        startedAt: new Date(Date.now() - 100000).toISOString(),
        attemptsMade: 1,
        maxRetries: 3,
        progressPercent: 65
      },
      {
        id: "job_seed_3",
        name: "Tax Deduction Document Search Indexing",
        type: "search_indexing",
        priority: "low",
        status: "pending",
        workspaceId: "business",
        createdAt: new Date(Date.now() - 30000).toISOString(),
        attemptsMade: 0,
        maxRetries: 5,
        progressPercent: 0
      }
    ];
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seeds));
    return seeds;
  }
}

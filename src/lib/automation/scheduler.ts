export type ScheduleFrequency =
  | "once"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "cron";

export interface ScheduledTask {
  id: string;
  name: string;
  workflowId?: string;
  jobType: string;
  frequency: ScheduleFrequency;
  cronExpression?: string; // e.g. "0 8 * * *"
  timezone: string;
  enabled: boolean;
  lastRun?: string;
  nextRun: string;
  workspaceId: string;
}

export class SchedulerEngine {
  private static STORAGE_KEY = "gf_scheduled_tasks";

  public static getTasks(workspaceId?: string): ScheduledTask[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    const tasks: ScheduledTask[] = raw ? JSON.parse(raw) : this.getSeedTasks();
    if (workspaceId) {
      return tasks.filter(t => t.workspaceId === workspaceId);
    }
    return tasks;
  }

  public static addTask(
    name: string,
    jobType: string,
    frequency: ScheduleFrequency,
    workspaceId: string = "personal",
    cronExpression?: string,
    timezone: string = "Asia/Kolkata"
  ): ScheduledTask {
    const tasks = this.getTasks();
    const newTask: ScheduledTask = {
      id: `sched_${Math.random().toString(36).substring(2, 9)}`,
      name,
      jobType,
      frequency,
      cronExpression,
      timezone,
      enabled: true,
      nextRun: this.calculateNextRun(frequency, cronExpression),
      workspaceId
    };

    tasks.unshift(newTask);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tasks));
    return newTask;
  }

  public static toggleTask(id: string, enabled: boolean): void {
    const tasks = this.getTasks();
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.enabled = enabled;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tasks));
    }
  }

  public static deleteTask(id: string): void {
    const tasks = this.getTasks().filter(t => t.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tasks));
  }

  private static calculateNextRun(frequency: ScheduleFrequency, cron?: string): string {
    const now = new Date();
    switch (frequency) {
      case "hourly":
        now.setHours(now.getHours() + 1);
        break;
      case "daily":
        now.setDate(now.getDate() + 1);
        break;
      case "weekly":
        now.setDate(now.getDate() + 7);
        break;
      case "monthly":
        now.setMonth(now.getMonth() + 1);
        break;
      case "quarterly":
        now.setMonth(now.getMonth() + 3);
        break;
      case "yearly":
        now.setFullYear(now.getFullYear() + 1);
        break;
      default:
        now.setDate(now.getDate() + 1);
    }
    return now.toISOString();
  }

  private static getSeedTasks(): ScheduledTask[] {
    const seeds: ScheduledTask[] = [
      {
        id: "sched_1",
        name: "Morning Open Banking Account Sync",
        jobType: "bank_sync",
        frequency: "daily",
        cronExpression: "0 8 * * *",
        timezone: "Asia/Kolkata",
        enabled: true,
        lastRun: new Date(Date.now() - 3600000 * 12).toISOString(),
        nextRun: new Date(Date.now() + 3600000 * 12).toISOString(),
        workspaceId: "personal"
      },
      {
        id: "sched_2",
        name: "Monthly Financial OS Report PDF Generator",
        jobType: "report_generation",
        frequency: "monthly",
        cronExpression: "0 0 1 * *",
        timezone: "Asia/Kolkata",
        enabled: true,
        lastRun: "2026-07-01T00:00:00Z",
        nextRun: "2026-08-01T00:00:00Z",
        workspaceId: "personal"
      },
      {
        id: "sched_3",
        name: "Weekly Net Worth & Investment Commentary",
        jobType: "ai_job",
        frequency: "weekly",
        cronExpression: "0 9 * * 1",
        timezone: "Asia/Kolkata",
        enabled: true,
        lastRun: new Date(Date.now() - 86400000 * 3).toISOString(),
        nextRun: new Date(Date.now() + 86400000 * 4).toISOString(),
        workspaceId: "personal"
      }
    ];
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seeds));
    return seeds;
  }
}

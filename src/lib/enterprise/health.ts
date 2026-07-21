export interface HealthMetric {
  apiLatencyMs: number;
  databaseStatus: "healthy" | "degraded" | "unreachable";
  syncQueueSize: number;
  ocrQueueSize: number;
  backgroundJobsCompleted: number;
  backgroundJobsFailed: number;
  storageUsedBytes: number;
  storageMaxBytes: number;
  lastSyncTime: string;
}

export class SystemHealthEngine {
  public static getMetrics(): HealthMetric {
    return {
      apiLatencyMs: 38,
      databaseStatus: "healthy",
      syncQueueSize: 0,
      ocrQueueSize: 0,
      backgroundJobsCompleted: 1450,
      backgroundJobsFailed: 3,
      storageUsedBytes: 8120000, // 8.12 MB
      storageMaxBytes: 1073741824, // 1 GB free tier
      lastSyncTime: new Date(Date.now() - 45000).toISOString() // 45 seconds ago
    };
  }

  public static getActiveJobs(): { id: string; name: string; status: "running" | "queued" | "failed"; durationSec: number }[] {
    return [
      { id: "job_sync_1", name: "HDFC bank synchronization", status: "running", durationSec: 12 },
      { id: "job_ocr_2", name: "FY25_Form16 OCR Extraction", status: "queued", durationSec: 0 }
    ];
  }
}

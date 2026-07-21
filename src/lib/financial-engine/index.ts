export * from "./types";
export { DependencyRegistry } from "./registry";
export { EventEngine } from "./events";
export { ValidationEngine } from "./validation";
export { RulesEngine } from "./rules";
export { CalculationEngine } from "./calculations";
export { SelectorEngine } from "./selectors";
export { SynchronizationEngine } from "./sync";
export { AutomationEngine } from "./automation";
export { FinancialHealthEngine } from "./health";
export type { FinancialHealthMetrics } from "./health";

// Phase 10 additions
export { MetricsRegistry } from "./metrics";
export type { MetricType } from "./metrics";
export { TimeSeriesEngine } from "./time-series";
export type { TimeSeriesPoint, PeriodComparisonResult } from "./time-series";
export { FilterEngine } from "./filters";
export type { ReportFilters } from "./filters";
export { ReportEngine } from "./reports";
export type { ReportPayload, ReportSection } from "./reports";
export { ForecastEngine } from "./forecast";
export type { GoalForecast, LoanForecast, BudgetForecast, ForecastPoint } from "./forecast";
export { ExportEngine } from "./export";

// Financial Intelligence additions
export {
  ContextEngine,
  InsightEngine,
  RecommendationEngine,
  RiskEngine,
  OpportunityEngine,
  ScenarioEngine,
  GoalPlanner,
  FinancialCoach
} from "./intelligence";
export type {
  DeterministicInsight,
  Recommendation,
  FinancialRisk,
  FinancialOpportunity,
  ScenarioInput,
  ScenarioResult,
  GoalPlan
} from "./intelligence";

// Phase 12 Data Integration additions
export {
  NormalizationEngine,
  DuplicateDetectionEngine,
  CategoryEngine,
  ImportEngine,
  OcrEngine,
  BankSyncEngine,
  ReconciliationEngine,
  AttachmentEngine,
  IciciAdapter,
  HdfcAdapter,
  SbiAdapter,
  AxisAdapter
} from "./integration";
export type {
  ImportItem,
  ImportPreviewPayload,
  OcrResult,
  ReconciliationReport,
  BankSyncConnection,
  BankAdapter
} from "./integration";

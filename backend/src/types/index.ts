export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  eventType?: string;
  patientId?: string;
  facilityId?: string;
  orgUuid?: string;
  message: string;
  endpoint?: string;
  duration?: number;
  status?: string | number;
  page: number;
  lineNum: number;
  webhookId?: string;
  rawJson?: string;
  rawMessage: string;
}

export interface ApiCall {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  success: boolean;
  timestamp: string;
}

export interface CensusOperation {
  service: string;
  action: string;
  timestamp: string;
  message: string;
  success: boolean;
}

export interface ForecastOperation {
  service: string;
  action: string;
  timestamp: string;
  message: string;
  success: boolean;
}

export interface WebhookTransaction {
  webhookId: string;
  eventType: string;
  patientId?: string;
  facilityId?: string;
  orgUuid?: string;
  startTime: string;
  endTime: string;
  duration: number; // in milliseconds
  status: 'success' | 'warning' | 'error' | 'processing';
  logs: LogEntry[];
  warnings: string[];
  errors: string[];
  apisCalled: ApiCall[];
  censusOperations: CensusOperation[];
  forecastOperations: ForecastOperation[];
  adtMatchStatus: 'matched' | 'fallback' | 'missing' | 'none';
  duplicateCount: number;
}

export interface ChartData {
  labels: string[];
  data: number[];
}

export interface AnalysisReport {
  totalEvents: number;
  eventTypes: Record<string, number>;
  warningsCount: number;
  errorsCount: number;
  patientsAffected: string[];
  facilitiesAffected: string[];
  censusUpdatesCount: number;
  forecastUpdatesCount: number;
  duplicateEventsCount: number;
  transactions: WebhookTransaction[];
  charts: {
    eventsByType: ChartData;
    errorsByFacility: ChartData;
    warningsByDay: ChartData;
    processingDurationHistogram: ChartData;
    apiUsage: ChartData;
  };
  aiSummary: AISummary;
}

export interface AISummary {
  executiveSummary: string;
  criticalIssues: string[];
  warnings: string[];
  errors: string[];
  patientsRequiringInvestigation: string[];
  facilitiesWithProblems: string[];
  censusAnomalies: string[];
  forecastAnomalies: string[];
  duplicateWebhookDetection: string[];
  recommendedActions: string[];
}

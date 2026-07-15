const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

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
  duration: number;
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

export interface AnalysisReport {
  reportId: string;
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

export class ApiClient {
  /**
   * Upload and analyze a PDF log file
   */
  static async uploadAndAnalyze(
    file: File,
    geminiApiKey?: string,
    knownFacilities?: string[]
  ): Promise<AnalysisReport> {
    const formData = new FormData();
    formData.append('file', file);
    if (geminiApiKey) formData.append('geminiApiKey', geminiApiKey);
    if (knownFacilities) formData.append('knownFacilities', JSON.stringify(knownFacilities));

    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to analyze PDF log file.');
    }

    return response.json();
  }

  /**
   * Trigger demo log generation and analysis
   */
  static async generateAndAnalyzeDemo(
    pages: number,
    geminiApiKey?: string
  ): Promise<AnalysisReport> {
    const response = await fetch(`${API_BASE_URL}/api/test/generate-and-analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pages,
        geminiApiKey,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to generate and analyze demo logs.');
    }

    return response.json();
  }

  /**
   * Get Export URL for report
   */
  static getExportUrl(reportId: string, format: 'excel' | 'csv' | 'html'): string {
    return `${API_BASE_URL}/api/export/${reportId}/${format}`;
  }
}

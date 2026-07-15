import { Request, Response } from 'express';
import * as fs from 'fs';
import { PdfParserService } from '../services/pdf-parser.service.js';
import { LogParserService } from '../services/log-parser.service.js';
import { TransactionBuilderService } from '../services/transaction-builder.service.js';
import { IssueDetectorService } from '../services/issue-detector.service.js';
import { AiSummaryService } from '../services/ai-summary.service.js';
import { LogEntry, AnalysisReport, WebhookTransaction } from '../types/index.js';

// In-memory cache for generated reports
export const reportCache = new Map<string, AnalysisReport>();

// Helper to normalize API endpoints
function normalizeEndpoint(path: string): string {
  let normalized = path;
  // Replace patient IDs (e.g., pat-123456)
  normalized = normalized.replace(/pat-[0-9a-zA-Z]+/gi, '{patientId}');
  // Replace facility IDs (e.g., fac-101)
  normalized = normalized.replace(/fac-[0-9a-zA-Z]+/gi, '{facilityId}');
  // Replace generic UUIDs
  normalized = normalized.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{uuid}');
  // Replace trailing numeric IDs
  normalized = normalized.replace(/\/\d+(?=\b|\/|$)/g, '/{id}');
  return normalized;
}

export async function analyzeLogs(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No PDF log file uploaded.' });
    return;
  }

  const geminiApiKey = req.body.geminiApiKey || process.env.GEMINI_API_KEY;
  const knownFacilities = req.body.knownFacilities 
    ? (typeof req.body.knownFacilities === 'string' ? JSON.parse(req.body.knownFacilities) : req.body.knownFacilities)
    : undefined;

  try {
    const fileBuffer = fs.readFileSync(file.path);
    const parsedLogs: LogEntry[] = [];
    let logLineCounter = 0;

    // 1. PDF Parsing page-by-page
    await PdfParserService.parsePdfPageByPage(
      fileBuffer,
      (pageNum, pageText) => {
        const lines = pageText.split('\n');
        for (const line of lines) {
          if (line.trim().length > 0) {
            logLineCounter++;
            const parsed = LogParserService.parseLine(line, pageNum, logLineCounter);
            parsedLogs.push(parsed);
          }
        }
      }
    );

    // 2. Correlate Events
    const rawTransactions = TransactionBuilderService.buildTransactions(parsedLogs);

    // 3. Issue Detection
    const transactions = IssueDetectorService.detectIssues(rawTransactions, {
      knownFacilities
    });

    // 4. Generate AI Summary
    const aiSummary = await AiSummaryService.generateSummary(transactions, geminiApiKey);

    // 5. Aggregate metrics
    const totalEvents = parsedLogs.length;
    const eventTypes: Record<string, number> = {};
    let warningsCount = 0;
    let errorsCount = 0;
    const patientsAffected = new Set<string>();
    const facilitiesAffected = new Set<string>();
    let censusUpdatesCount = 0;
    let forecastUpdatesCount = 0;
    let duplicateEventsCount = 0;

    // Chart processing buckets
    const errorsByFacilityMap = new Map<string, number>();
    const warningsByDayMap = new Map<string, number>();
    const apiUsageMap = new Map<string, number>();
    const durationBuckets = {
      '< 500ms': 0,
      '500ms - 1s': 0,
      '1s - 2s': 0,
      '2s - 5s': 0,
      '> 5s': 0
    };

    for (const tx of transactions) {
      if (tx.eventType && tx.eventType !== 'unknown') {
        eventTypes[tx.eventType] = (eventTypes[tx.eventType] || 0) + 1;
      }
      
      warningsCount += tx.warnings.length;
      errorsCount += tx.errors.length;
      
      if (tx.patientId) patientsAffected.add(tx.patientId);
      if (tx.facilityId) facilitiesAffected.add(tx.facilityId);
      
      censusUpdatesCount += tx.censusOperations.length;
      forecastUpdatesCount += tx.forecastOperations.length;
      
      if (tx.duplicateCount > 0) {
        duplicateEventsCount += tx.duplicateCount;
      }

      // Populate error counts per facility
      if (tx.facilityId && tx.errors.length > 0) {
        errorsByFacilityMap.set(
          tx.facilityId,
          (errorsByFacilityMap.get(tx.facilityId) || 0) + tx.errors.length
        );
      }

      // Populate warnings by day
      if (tx.startTime) {
        const day = tx.startTime.split(' ')[0]; // YYYY-MM-DD
        if (day) {
          warningsByDayMap.set(day, (warningsByDayMap.get(day) || 0) + tx.warnings.length);
        }
      }

      // Populate processing durations histogram
      const d = tx.duration;
      if (d < 500) durationBuckets['< 500ms']++;
      else if (d < 1000) durationBuckets['500ms - 1s']++;
      else if (d < 2000) durationBuckets['1s - 2s']++;
      else if (d < 5000) durationBuckets['2s - 5s']++;
      else durationBuckets['> 5s']++;

      // Populate API usage maps
      for (const api of tx.apisCalled) {
        const normalized = `${api.method} ${normalizeEndpoint(api.endpoint)}`;
        apiUsageMap.set(normalized, (apiUsageMap.get(normalized) || 0) + 1);
      }
    }

    // Convert Maps to ChartData structures
    const errorsByFacility = {
      labels: Array.from(errorsByFacilityMap.keys()),
      data: Array.from(errorsByFacilityMap.values())
    };

    // Sort days chronologically
    const sortedDays = Array.from(warningsByDayMap.keys()).sort();
    const warningsByDay = {
      labels: sortedDays,
      data: sortedDays.map(day => warningsByDayMap.get(day) || 0)
    };

    const processingDurationHistogram = {
      labels: Object.keys(durationBuckets),
      data: Object.values(durationBuckets)
    };

    // Sort API usage by call frequency
    const sortedApis = Array.from(apiUsageMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const apiUsage = {
      labels: sortedApis.map(item => item[0]),
      data: sortedApis.map(item => item[1])
    };

    const eventsByType = {
      labels: Object.keys(eventTypes),
      data: Object.values(eventTypes)
    };

    const report: AnalysisReport = {
      totalEvents,
      eventTypes,
      warningsCount,
      errorsCount,
      patientsAffected: Array.from(patientsAffected),
      facilitiesAffected: Array.from(facilitiesAffected),
      censusUpdatesCount,
      forecastUpdatesCount,
      duplicateEventsCount,
      transactions,
      charts: {
        eventsByType,
        errorsByFacility,
        warningsByDay,
        processingDurationHistogram,
        apiUsage
      },
      aiSummary
    };

    // Store in cache under a random report ID
    const reportId = 'rpt-' + Math.random().toString(36).substring(2, 12);
    reportCache.set(reportId, report);

    // Remove the uploaded temporary file asynchronously
    fs.unlink(file.path, () => {});

    // Return the report details + report ID to client
    res.status(200).json({
      reportId,
      ...report
    });
  } catch (error: any) {
    console.error('Analysis failed:', error);
    // Cleanup file in case of crash
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    res.status(500).json({ error: 'Failed to process PDF log file. ' + error.message });
  }
}

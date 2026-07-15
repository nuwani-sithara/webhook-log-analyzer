import { WebhookTransaction } from '../types/index.js';

export interface IssueDetectorSettings {
  knownFacilities?: string[];
  slowWebhookThresholdMs?: number;
  slowApiThresholdMs?: number;
}

export class IssueDetectorService {
  /**
   * Run rules-based checks across all transactions to append diagnostic warnings/errors.
   */
  static detectIssues(
    transactions: WebhookTransaction[],
    settings: IssueDetectorSettings = {}
  ): WebhookTransaction[] {
    const knownFacilities = settings.knownFacilities || ['fac-101', 'fac-102', 'fac-103', 'fac-104', 'fac-105'];
    const slowWebhookThresholdMs = settings.slowWebhookThresholdMs || 5000;
    const slowApiThresholdMs = settings.slowApiThresholdMs || 1000;

    // First, map transactions by webhook ID to detect duplicate webhook ID deliveries
    const webhookIdCount = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.webhookId && !tx.webhookId.startsWith('SYSTEM') && !tx.webhookId.startsWith('DailyForecast')) {
        webhookIdCount.set(tx.webhookId, (webhookIdCount.get(tx.webhookId) || 0) + 1);
      }
    }

    for (const tx of transactions) {
      // 1. Duplicate Webhook ID detection
      if (tx.webhookId && (webhookIdCount.get(tx.webhookId) || 0) > 1) {
        tx.warnings.push(`Duplicate Webhook ID detected: [${tx.webhookId}] was processed ${webhookIdCount.get(tx.webhookId)} times.`);
        tx.status = tx.status === 'error' ? 'error' : 'warning';
      }

      // 2. Duplicate Event Contents detection (same patient + facility + eventType within a short time)
      if (tx.duplicateCount > 0) {
        tx.warnings.push(`Duplicate webhook contents received. Duplicate count for this event type and patient: ${tx.duplicateCount}`);
        tx.status = tx.status === 'error' ? 'error' : 'warning';
      }

      // 3. Unknown Facility ID
      if (tx.facilityId) {
        if (!knownFacilities.includes(tx.facilityId.toLowerCase()) && !knownFacilities.includes(tx.facilityId.toUpperCase())) {
          tx.warnings.push(`Unknown or unregistered Facility ID detected: [${tx.facilityId}]`);
          tx.status = tx.status === 'error' ? 'error' : 'warning';
        }
      } else if (tx.eventType !== 'system.logs' && !tx.webhookId.startsWith('SYSTEM')) {
        tx.warnings.push(`Missing Facility ID in transaction payload`);
        tx.status = tx.status === 'error' ? 'error' : 'warning';
      }

      // 4. Missing / Fallback ADT Match
      if (tx.adtMatchStatus === 'missing') {
        tx.warnings.push(`Missing ADT match for patient ADT event [${tx.eventType}]`);
        tx.status = tx.status === 'error' ? 'error' : 'warning';
      } else if (tx.adtMatchStatus === 'fallback') {
        tx.warnings.push(`ADT match fallback triggered during patient event [${tx.eventType}]`);
        tx.status = tx.status === 'error' ? 'error' : 'warning';
      }

      // 5. Processing SLA breaches (Slow Webhook)
      if (tx.duration > slowWebhookThresholdMs) {
        tx.warnings.push(`Webhook processing exceeded SLA limit. Duration: ${tx.duration}ms (Threshold: ${slowWebhookThresholdMs}ms)`);
        tx.status = tx.status === 'error' ? 'error' : 'warning';
      }

      // 6. API call analysis (failures, retries, slow APIs, token failures)
      const endpointsCalled = new Set<string>();
      for (const api of tx.apisCalled) {
        // Slow API
        if (api.duration > slowApiThresholdMs) {
          tx.warnings.push(`Slow PCC API call: ${api.method} ${api.endpoint} took ${api.duration}ms (Threshold: ${slowApiThresholdMs}ms)`);
          tx.status = tx.status === 'error' ? 'error' : 'warning';
        }

        // API Failure
        if (!api.success) {
          tx.errors.push(`PCC API Request failed: ${api.method} ${api.endpoint} returned Status [${api.status}]`);
          tx.status = 'error';
        }

        // Token Failure
        if (api.status === 401 || api.status === 403) {
          tx.errors.push(`Token / Authentication failure: ${api.method} ${api.endpoint} returned Unauthorized [${api.status}]`);
          tx.status = 'error';
        }

        // Repeated API retries
        const apiSignature = `${api.method}-${api.endpoint}`;
        if (endpointsCalled.has(apiSignature)) {
          tx.warnings.push(`Repeated API retry detected: ${api.method} ${api.endpoint} was requested multiple times inside this transaction`);
          tx.status = tx.status === 'error' ? 'error' : 'warning';
        } else {
          endpointsCalled.add(apiSignature);
        }
      }

      // 7. PccCensusService checks (Missing completion)
      const censusStarts = tx.censusOperations.filter(op => op.action === 'start');
      const censusCompletes = tx.censusOperations.filter(op => op.action === 'complete');
      if (censusStarts.length > 0 && censusCompletes.length === 0) {
        tx.errors.push(`Census update started but never completed (PccCensusService hang)`);
        tx.status = 'error';
      }

      // 8. DailyForecastRecalculationService checks (Missing completion)
      const forecastStarts = tx.forecastOperations.filter(op => op.action === 'start');
      const forecastCompletes = tx.forecastOperations.filter(op => op.action === 'complete');
      if (forecastStarts.length > 0 && forecastCompletes.length === 0) {
        tx.errors.push(`Daily Forecast recalculation started but never completed (DailyForecastRecalculationService hang)`);
        tx.status = 'error';
      }

      // Check for Timeout keywords in any log message
      const hasTimeoutMsg = tx.logs.some(log => log.message.toLowerCase().includes('timeout') || log.message.toLowerCase().includes('timed out'));
      if (hasTimeoutMsg) {
        tx.errors.push(`Transaction encountered timeout Exception during execution`);
        tx.status = 'error';
      }
    }

    return transactions;
  }
}

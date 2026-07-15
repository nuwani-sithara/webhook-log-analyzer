export class AiSummaryService {
    /**
     * Generates a structured executive summary based on the analyzed transactions.
     * If a Gemini API Key is provided, it uses the Gemini model to refine the summary.
     */
    static async generateSummary(transactions, apiKey) {
        // 1. Gather stats and lists
        const criticalIssues = [];
        const warnings = [];
        const errors = [];
        const patientsReqInv = new Set();
        const facilitiesWithProblemsMap = new Map();
        const censusAnomalies = [];
        const forecastAnomalies = [];
        const duplicateWebhookDetection = [];
        let totalTimeouts = 0;
        let totalTokenFailures = 0;
        let totalCensusHangs = 0;
        let totalForecastHangs = 0;
        let totalDuplicates = 0;
        for (const tx of transactions) {
            const pId = tx.patientId || 'unknown';
            const fId = tx.facilityId || 'unknown';
            // Aggregate issues per facility
            if (tx.status === 'error' || tx.status === 'warning') {
                const facStats = facilitiesWithProblemsMap.get(fId) || { errors: 0, warnings: 0 };
                if (tx.status === 'error')
                    facStats.errors++;
                if (tx.status === 'warning')
                    facStats.warnings++;
                facilitiesWithProblemsMap.set(fId, facStats);
            }
            // Collect Errors & Warnings
            if (tx.errors.length > 0) {
                errors.push(...tx.errors.map(err => `[Facility: ${fId}, Patient: ${pId}] ${err}`));
                patientsReqInv.add(pId);
            }
            if (tx.warnings.length > 0) {
                warnings.push(...tx.warnings.map(warn => `[Facility: ${fId}, Patient: ${pId}] ${warn}`));
            }
            // Check specific issues
            for (const err of tx.errors) {
                if (err.toLowerCase().includes('timeout'))
                    totalTimeouts++;
                if (err.toLowerCase().includes('token') || err.toLowerCase().includes('unauthorized'))
                    totalTokenFailures++;
                if (err.includes('Census update started')) {
                    totalCensusHangs++;
                    censusAnomalies.push(`[Facility: ${fId}] Census Service hung - started but never completed for patient ${pId}`);
                }
                if (err.includes('Daily Forecast recalculation started')) {
                    totalForecastHangs++;
                    forecastAnomalies.push(`[Facility: ${fId}] Forecast Recalculation Service hung - started but never completed`);
                }
            }
            for (const warn of tx.warnings) {
                if (warn.includes('Duplicate Webhook ID') || warn.includes('Duplicate webhook contents')) {
                    totalDuplicates++;
                    duplicateWebhookDetection.push(`[Facility: ${fId}] ${warn}`);
                }
                if (warn.includes('ADT match fallback')) {
                    censusAnomalies.push(`[Facility: ${fId}] ADT match fallback used for Patient ${pId}`);
                }
                if (warn.includes('Missing ADT match')) {
                    censusAnomalies.push(`[Facility: ${fId}] Missing ADT match on patient event [${tx.eventType}]`);
                }
            }
        }
        // Compile Top problematic facilities
        const facilitiesWithProblems = Array.from(facilitiesWithProblemsMap.entries())
            .map(([id, stats]) => `${id} (${stats.errors} errors, ${stats.warnings} warnings)`)
            .slice(0, 5);
        // Patients requiring investigation (limit to 10 for dashboard cleanliness)
        const patientsRequiringInvestigation = Array.from(patientsReqInv)
            .filter(p => p !== 'unknown')
            .slice(0, 10);
        // Compile critical issues list
        if (totalTimeouts > 0)
            criticalIssues.push(`Encountered ${totalTimeouts} timeout exceptions indicating network or API threshold delays.`);
        if (totalTokenFailures > 0)
            criticalIssues.push(`Authentication errors: ${totalTokenFailures} API requests failed due to 401/403 credentials expire.`);
        if (totalCensusHangs > 0)
            criticalIssues.push(`Active service hangs: ${totalCensusHangs} PccCensusService threads halted before completing.`);
        if (totalForecastHangs > 0)
            criticalIssues.push(`Recalculation failures: ${totalForecastHangs} DailyForecastRecalculationService processes did not finish.`);
        if (criticalIssues.length === 0 && errors.length > 0) {
            criticalIssues.push(`Detected ${errors.length} transaction-level API or processing errors requiring investigation.`);
        }
        // Dynamic recommendations
        const recommendedActions = [];
        if (totalTokenFailures > 0) {
            recommendedActions.push('Audit PCC OAuth integration credentials. Check token refresh intervals and expiration handling.');
        }
        if (totalTimeouts > 0) {
            recommendedActions.push('Review API rate limits and network latency. Implement a back-off retrying logic in the integration layer.');
        }
        if (totalCensusHangs > 0 || totalForecastHangs > 0) {
            recommendedActions.push('Inspect Census and Forecast transaction scopes. Add safety timeouts/dead-letter logs for database locks.');
        }
        if (censusAnomalies.some(a => a.includes('Missing ADT') || a.includes('fallback'))) {
            recommendedActions.push('Verify ADT matching parameters. Ensure demographic identifiers (SSN, MRN, Names) are correctly synced.');
        }
        if (totalDuplicates > 0) {
            recommendedActions.push('Configure deduplication caching (e.g. Redis) at the webhook receiver endpoint to reject duplicate webhook UUIDs within a 5-minute sliding window.');
        }
        if (recommendedActions.length === 0) {
            recommendedActions.push('All PCC webhook routes operating within specifications. No architectural actions needed.');
        }
        // Limit lists to avoid clogging UI
        const errorsSubset = errors.slice(0, 10);
        const warningsSubset = warnings.slice(0, 10);
        const dupSubset = duplicateWebhookDetection.slice(0, 5);
        const successCount = transactions.filter(t => t.status === 'success').length;
        const avgDuration = transactions.length > 0
            ? Math.round(transactions.reduce((acc, t) => acc + t.duration, 0) / transactions.length)
            : 0;
        // Initialize report summary
        let executiveSummary = `## Webhook Integration Health Review
The system parsed and correlated **${transactions.length}** PointClickCare webhook transactions.

- **Successful Runs:** ${successCount} transactions processed successfully within SLAs
- **Average Processing SLA:** ${avgDuration} ms
- **Warnings & Anomalies:** ${warnings.length} items flagged
- **Critical Failures:** ${errors.length} errors encountered
- **Deduplication Rate:** ${totalDuplicates} redundant payloads ignored

### Primary Diagnostic Takeaways
`;
        if (errors.length === 0 && warnings.length === 0) {
            executiveSummary += `All webhook logs show normal operations. PCC client notifications are successfully ADT-matched, Census updates completed, and DailyForecast schedules run within processing SLAs.`;
        }
        else {
            executiveSummary += `Integration errors are concentrated in **${facilitiesWithProblemsMap.size}** facility environment(s). `;
            if (totalTokenFailures > 0) {
                executiveSummary += `A critical security token error is disrupting communications. `;
            }
            if (totalCensusHangs > 0 || totalForecastHangs > 0) {
                executiveSummary += `Thread synchronization hangs were detected in downstream updates, preventing complete database commits. `;
            }
            if (totalTimeouts > 0) {
                executiveSummary += `Response SLA limits were exceeded on some endpoints, flagging network throttling. `;
            }
            executiveSummary += `Immediate actions should be taken based on the recommendations list.`;
        }
        // 2. Optional Gemini API enhancement
        if (apiKey) {
            try {
                const prompt = `
          You are a senior Solutions Architect and Staff Engineer analyzing PointClickCare (PCC) webhook logs.
          Review these statistics compiled from the log files and write a professional, highly detailed, and actionable Executive Summary (around 2-3 paragraphs in markdown format).
          
          Log Analysis Statistics:
          - Total correlated transactions: ${transactions.length}
          - Total error lines detected: ${errors.length}
          - Total warning lines detected: ${warnings.length}
          - Critical issues summaries: ${JSON.stringify(criticalIssues)}
          - Problematic facilities: ${JSON.stringify(facilitiesWithProblems)}
          - Patients requiring review count: ${patientsReqInv.size}
          - Census errors: ${JSON.stringify(censusAnomalies.slice(0, 5))}
          - Forecast errors: ${JSON.stringify(forecastAnomalies.slice(0, 5))}
          - Duplicate webhook counts: ${totalDuplicates}
          
          Guidelines:
          - Make it read like a premium AI assessment from an expert engineer.
          - Identify architectural bottlenecks (e.g. database locks, thread pool exhaustion, credential expiration, or API thresholding).
          - Provide a clear verdict on the stability of the system.
          - Return ONLY the raw markdown content for the executive summary. Do not wrap in backticks or markdown quotes.
        `;
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });
                if (response.ok) {
                    const resJson = await response.json();
                    const generatedText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (generatedText) {
                        executiveSummary = generatedText;
                    }
                }
            }
            catch (err) {
                console.error('Gemini API call failed, falling back to rule-based summary:', err);
            }
        }
        return {
            executiveSummary,
            criticalIssues,
            warnings: warningsSubset,
            errors: errorsSubset,
            patientsRequiringInvestigation,
            facilitiesWithProblems,
            censusAnomalies: censusAnomalies.slice(0, 5),
            forecastAnomalies: forecastAnomalies.slice(0, 5),
            duplicateWebhookDetection: dupSubset,
            recommendedActions
        };
    }
}

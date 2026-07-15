export class TransactionBuilderService {
    /**
     * Group and sequence parsed log entries into end-to-end transactions.
     */
    static buildTransactions(logs) {
        const transactionsMap = new Map();
        const strayLogs = [];
        // Sort logs by timestamp to process chronologically
        const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        // Step 1: Initialize transactions for lines that have a webhookId
        for (const log of sortedLogs) {
            if (log.webhookId) {
                let tx = transactionsMap.get(log.webhookId);
                if (!tx) {
                    tx = {
                        webhookId: log.webhookId,
                        eventType: log.eventType || 'unknown',
                        patientId: log.patientId,
                        facilityId: log.facilityId,
                        orgUuid: log.orgUuid,
                        startTime: log.timestamp,
                        endTime: log.timestamp,
                        duration: 0,
                        status: 'processing',
                        logs: [],
                        warnings: [],
                        errors: [],
                        apisCalled: [],
                        censusOperations: [],
                        forecastOperations: [],
                        adtMatchStatus: 'none',
                        duplicateCount: 0
                    };
                    transactionsMap.set(log.webhookId, tx);
                }
                // Add log entry to the transaction
                tx.logs.push(log);
                // Update transaction metadata if missing and available in this log
                if (!tx.patientId && log.patientId)
                    tx.patientId = log.patientId;
                if (!tx.facilityId && log.facilityId)
                    tx.facilityId = log.facilityId;
                if (!tx.orgUuid && log.orgUuid)
                    tx.orgUuid = log.orgUuid;
                if (tx.eventType === 'unknown' && log.eventType)
                    tx.eventType = log.eventType;
            }
            else {
                strayLogs.push(log);
            }
        }
        // Step 2: Correlate stray logs (without webhookId) using patientId and/or facilityId + time window
        // We check if a stray log occurred within a 5-second window of a transaction with the same patientId / facilityId.
        const TIME_WINDOW_MS = 5000;
        for (const log of strayLogs) {
            let matchedTx = null;
            const logTime = new Date(log.timestamp).getTime();
            // Search for a matching transaction
            if (log.patientId || log.facilityId) {
                for (const tx of transactionsMap.values()) {
                    const txStartTime = new Date(tx.startTime).getTime();
                    const txEndTime = new Date(tx.endTime).getTime();
                    // Check if log falls within transaction bounds (+ buffer)
                    const isWithinWindow = logTime >= txStartTime - TIME_WINDOW_MS &&
                        logTime <= txEndTime + TIME_WINDOW_MS;
                    if (isWithinWindow) {
                        const patientMatches = log.patientId && tx.patientId === log.patientId;
                        const facilityMatches = log.facilityId && tx.facilityId === log.facilityId;
                        if (patientMatches || (log.facilityId && facilityMatches && !log.patientId)) {
                            matchedTx = tx;
                            break;
                        }
                    }
                }
            }
            if (matchedTx) {
                matchedTx.logs.push(log);
                // Sort transaction logs again just in case
                matchedTx.logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            }
            else {
                // If it's a service log that doesn't fit any active webhook transaction, create a synthetic transaction
                // e.g. DailyForecastRecalculationService or PccCensusService running independently
                if (log.eventType === 'DailyForecastRecalculationService' || log.eventType === 'PccCensusService') {
                    const serviceId = `${log.eventType}-${log.facilityId || 'unknown'}-${log.timestamp.slice(0, 13)}`;
                    let tx = transactionsMap.get(serviceId);
                    if (!tx) {
                        tx = {
                            webhookId: serviceId,
                            eventType: log.eventType,
                            patientId: log.patientId,
                            facilityId: log.facilityId,
                            orgUuid: log.orgUuid,
                            startTime: log.timestamp,
                            endTime: log.timestamp,
                            duration: 0,
                            status: 'success',
                            logs: [],
                            warnings: [],
                            errors: [],
                            apisCalled: [],
                            censusOperations: [],
                            forecastOperations: [],
                            adtMatchStatus: 'none',
                            duplicateCount: 0
                        };
                        transactionsMap.set(serviceId, tx);
                    }
                    tx.logs.push(log);
                }
                else {
                    // General system stray log, create a default bucket or ignore. Let's create a "system" transaction for it
                    const systemId = `SYSTEM-LOGS-${log.timestamp.slice(0, 10)}`;
                    let tx = transactionsMap.get(systemId);
                    if (!tx) {
                        tx = {
                            webhookId: systemId,
                            eventType: 'system.logs',
                            startTime: log.timestamp,
                            endTime: log.timestamp,
                            duration: 0,
                            status: 'success',
                            logs: [],
                            warnings: [],
                            errors: [],
                            apisCalled: [],
                            censusOperations: [],
                            forecastOperations: [],
                            adtMatchStatus: 'none',
                            duplicateCount: 0
                        };
                        transactionsMap.set(systemId, tx);
                    }
                    tx.logs.push(log);
                }
            }
        }
        // Step 3: Post-process each transaction to extract details, handle sequencing, and set status
        const transactions = Array.from(transactionsMap.values());
        const duplicateCountMap = new Map();
        for (const tx of transactions) {
            // Sort logs by time to ensure order
            tx.logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            // Start / End / Duration
            if (tx.logs.length > 0) {
                tx.startTime = tx.logs[0].timestamp;
                tx.endTime = tx.logs[tx.logs.length - 1].timestamp;
                tx.duration = new Date(tx.endTime).getTime() - new Date(tx.startTime).getTime();
            }
            // Track duplicate webhooks
            // Duplicate ID check: We increment count for duplicates outside the builder
            // but let's pre-populate the keys
            const dupKey = `${tx.eventType}-${tx.patientId}-${tx.facilityId}-${tx.startTime.slice(0, 16)}`;
            duplicateCountMap.set(dupKey, (duplicateCountMap.get(dupKey) || 0) + 1);
            // Parse inner operations
            let hasError = false;
            let hasWarning = false;
            let adtMatched = false;
            let adtFallback = false;
            for (const log of tx.logs) {
                // Collect errors & warnings
                if (log.level === 'ERROR') {
                    tx.errors.push(log.message);
                    hasError = true;
                }
                if (log.level === 'WARN') {
                    tx.warnings.push(log.message);
                    hasWarning = true;
                }
                // Collect APIs Called
                if (log.eventType === 'PCC API Request') {
                    const methodMatch = log.message.match(/PCC API Request:\s*(GET|POST|PUT|DELETE)/i);
                    const method = methodMatch ? methodMatch[1].toUpperCase() : 'GET';
                    const statusVal = log.status ? Number(log.status) : 200;
                    const apiCall = {
                        endpoint: log.endpoint || 'unknown',
                        method,
                        duration: log.duration || 0,
                        status: statusVal,
                        success: statusVal < 400,
                        timestamp: log.timestamp
                    };
                    tx.apisCalled.push(apiCall);
                    if (statusVal >= 400) {
                        hasError = true;
                    }
                }
                // Collect Census Operations
                if (log.eventType === 'PccCensusService' || log.message.includes('Census')) {
                    const isSuccess = !log.message.toLowerCase().includes('fail') && log.level !== 'ERROR';
                    const censusOp = {
                        service: 'PccCensusService',
                        action: log.message.includes('start') ? 'start' : log.message.includes('complete') ? 'complete' : 'process',
                        timestamp: log.timestamp,
                        message: log.message,
                        success: isSuccess
                    };
                    tx.censusOperations.push(censusOp);
                }
                // Collect Forecast Operations
                if (log.eventType === 'DailyForecastRecalculationService' || log.message.includes('Forecast')) {
                    const isSuccess = !log.message.toLowerCase().includes('fail') && log.level !== 'ERROR';
                    const forecastOp = {
                        service: 'DailyForecastRecalculationService',
                        action: log.message.includes('start') ? 'start' : log.message.includes('complete') ? 'complete' : 'process',
                        timestamp: log.timestamp,
                        message: log.message,
                        success: isSuccess
                    };
                    tx.forecastOperations.push(forecastOp);
                }
                // ADT matching state
                if (log.eventType === 'ADT Match' || log.message.toLowerCase().includes('adt match')) {
                    adtMatched = true;
                }
                if (log.eventType === 'ADT Fallback' || log.message.toLowerCase().includes('adt fallback')) {
                    adtFallback = true;
                }
            }
            // Resolve ADT Match Status
            if (adtMatched) {
                tx.adtMatchStatus = 'matched';
            }
            else if (adtFallback) {
                tx.adtMatchStatus = 'fallback';
            }
            else {
                const patientEvents = [
                    'patient.admit',
                    'patient.discharge',
                    'patient.updateAccount',
                    'patient.transfer',
                    'patient.leave',
                    'patient.cancelLeave',
                    'patient.undoDischarge',
                    'patient.death'
                ];
                if (patientEvents.includes(tx.eventType)) {
                    tx.adtMatchStatus = 'missing';
                }
                else {
                    tx.adtMatchStatus = 'none';
                }
            }
            // Resolve transaction level status
            if (hasError) {
                tx.status = 'error';
            }
            else if (hasWarning || tx.adtMatchStatus === 'fallback' || tx.adtMatchStatus === 'missing') {
                tx.status = 'warning';
            }
            else {
                tx.status = 'success';
            }
        }
        // Assign duplicate count
        for (const tx of transactions) {
            const dupKey = `${tx.eventType}-${tx.patientId}-${tx.facilityId}-${tx.startTime.slice(0, 16)}`;
            tx.duplicateCount = (duplicateCountMap.get(dupKey) || 1) - 1;
        }
        // Sort transactions by start time descending (newest first)
        return transactions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    }
}

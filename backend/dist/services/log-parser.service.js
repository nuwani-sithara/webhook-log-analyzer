export class LogParserService {
    // Regex patterns
    static TIMESTAMP_REGEX = /^\[?(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}[,.]\d{3}Z?)\]?/;
    static LOG_LEVEL_REGEX = /\b(INFO|WARN|ERROR|DEBUG)\b/;
    // PCC Webhook IDs patterns, e.g. [wh-123-abc] or webhookId: "wh-123"
    static WEBHOOK_ID_REGEX = /(?:\[(wh-[a-zA-Z0-9-]+)\]|webhookId[":\s]+([a-zA-Z0-9-]+)|Correlation ID:?\s*([a-zA-Z0-9-]+))/i;
    // Specific entity extractors
    static PATIENT_ID_REGEX = /(?:patientId[":\s]+([a-zA-Z0-9-]+)|Patient[":\s\[]+([a-zA-Z0-9-]+)\]?|\/patients\/([a-zA-Z0-9-]+))/i;
    static FACILITY_ID_REGEX = /(?:facilityId[":\s]+([a-zA-Z0-9-]+)|Facility[":\s\[]+([a-zA-Z0-9-]+)\]?|\/facilities\/([a-zA-Z0-9-]+))/i;
    static ORG_UUID_REGEX = /(?:orgUuid[":\s]+([a-zA-Z0-9-]+)|Org[":\s\[]+([a-zA-Z0-9-]+)\]?)/i;
    // API Call patterns
    static API_REQUEST_REGEX = /PCC API Request:\s*(GET|POST|PUT|DELETE)\s*([^\s]+)/i;
    static API_STATUS_REGEX = /Status:\s*\[?(\d{3})\]?/i;
    static API_DURATION_REGEX = /(?:duration|took)[":\s]+(\d+)\s*ms/i;
    /**
     * Parse a single log line into a structured LogEntry
     */
    static parseLine(rawMessage, page, lineNum) {
        const trimmed = rawMessage.trim();
        // 1. Extract Timestamp
        let timestamp = new Date().toISOString(); // fallback
        const tsMatch = trimmed.match(this.TIMESTAMP_REGEX);
        if (tsMatch) {
            // Standardize timestamp formatting
            timestamp = tsMatch[1].replace(',', '.');
            if (!timestamp.endsWith('Z') && !timestamp.includes('+')) {
                timestamp += 'Z'; // Assume UTC if not specified
            }
        }
        // 2. Extract Log Level
        let level = 'INFO';
        const lvlMatch = trimmed.match(this.LOG_LEVEL_REGEX);
        if (lvlMatch) {
            level = lvlMatch[1].toUpperCase();
        }
        else if (trimmed.toLowerCase().includes('error') || trimmed.toLowerCase().includes('fail')) {
            level = 'ERROR';
        }
        else if (trimmed.toLowerCase().includes('warn')) {
            level = 'WARN';
        }
        // 3. Extract JSON payload if embedded
        let rawJson;
        let jsonPayload = null;
        const firstBrace = trimmed.indexOf('{');
        const lastBrace = trimmed.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const jsonStr = trimmed.slice(firstBrace, lastBrace + 1);
            try {
                jsonPayload = JSON.parse(jsonStr);
                rawJson = jsonStr;
            }
            catch (e) {
                // Not a valid JSON, ignore
            }
        }
        // 4. Base fields
        let webhookId = jsonPayload?.webhookId || jsonPayload?.id || undefined;
        let patientId = jsonPayload?.patientId || jsonPayload?.patientUuid || undefined;
        let facilityId = jsonPayload?.facilityId || jsonPayload?.facilityUuid || undefined;
        let orgUuid = jsonPayload?.orgUuid || jsonPayload?.orgId || undefined;
        let eventType = jsonPayload?.eventType || undefined;
        let endpoint = jsonPayload?.endpoint || undefined;
        let duration = jsonPayload?.duration || undefined;
        let status = jsonPayload?.status || undefined;
        // 5. If fields not in JSON, extract via Regex from text message
        if (!webhookId) {
            const whMatch = trimmed.match(this.WEBHOOK_ID_REGEX);
            if (whMatch) {
                webhookId = whMatch[1] || whMatch[2] || whMatch[3];
            }
        }
        if (!patientId) {
            const ptMatch = trimmed.match(this.PATIENT_ID_REGEX);
            if (ptMatch) {
                patientId = ptMatch[1] || ptMatch[2] || ptMatch[3];
            }
        }
        if (!facilityId) {
            const facMatch = trimmed.match(this.FACILITY_ID_REGEX);
            if (facMatch) {
                facilityId = facMatch[1] || facMatch[2] || facMatch[3];
            }
        }
        if (!orgUuid) {
            const orgMatch = trimmed.match(this.ORG_UUID_REGEX);
            if (orgMatch) {
                orgUuid = orgMatch[1] || orgMatch[2];
            }
        }
        // 6. Match Specific Service Events
        let message = trimmed;
        if (trimmed.includes('PccCensusService')) {
            eventType = 'PccCensusService';
        }
        else if (trimmed.includes('DailyForecastRecalculationService')) {
            eventType = 'DailyForecastRecalculationService';
        }
        else if (trimmed.includes('Cache HIT')) {
            eventType = 'Cache HIT';
        }
        else if (trimmed.includes('Cache MISS')) {
            eventType = 'Cache MISS';
        }
        else if (trimmed.includes('ADT Match')) {
            eventType = 'ADT Match';
        }
        else if (trimmed.includes('ADT Fallback')) {
            eventType = 'ADT Fallback';
        }
        // Check for API logs
        const apiMatch = trimmed.match(this.API_REQUEST_REGEX);
        if (apiMatch) {
            eventType = 'PCC API Request';
            endpoint = apiMatch[2];
            const statusMatch = trimmed.match(this.API_STATUS_REGEX);
            if (statusMatch) {
                status = parseInt(statusMatch[1], 10);
            }
            const durationMatch = trimmed.match(this.API_DURATION_REGEX);
            if (durationMatch) {
                duration = parseInt(durationMatch[1], 10);
            }
        }
        // If eventType is still empty, scan standard webhook events
        if (!eventType) {
            const eventKeywords = [
                'patient.admit',
                'patient.discharge',
                'patient.updateAccount',
                'patient.transfer',
                'patient.leave',
                'patient.cancelLeave',
                'patient.undoDischarge',
                'patient.death'
            ];
            for (const kw of eventKeywords) {
                if (trimmed.includes(kw)) {
                    eventType = kw;
                    break;
                }
            }
        }
        return {
            timestamp,
            level,
            eventType,
            patientId,
            facilityId,
            orgUuid,
            message,
            endpoint,
            duration,
            status,
            page,
            lineNum,
            webhookId,
            rawJson,
            rawMessage
        };
    }
}

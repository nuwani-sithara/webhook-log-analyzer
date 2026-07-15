export class LogParserService {
    // Regex patterns
    static TIMESTAMP_REGEX = /^\[?(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}[,.]\d{3}Z?)\]?/;
    static LOG_LEVEL_REGEX = /\b(INFO|WARN|ERROR|DEBUG)\b/;
    // PCC Webhook IDs patterns, e.g. [wh-123-abc] or webhookId: "wh-123"
    static WEBHOOK_ID_REGEX = /(?:\[(wh-[a-zA-Z0-9-]+)\]|webhookId[":\s]+([a-zA-Z0-9-]+)|Correlation ID:?\s*([a-zA-Z0-9-]+)|messageId[":\s]+([a-zA-Z0-9-]+))/i;
    // Specific entity extractors
    static PATIENT_ID_REGEX = /(?:patient\s*(?:id|uuid)?[":\s\[]+([a-zA-Z0-9-]+)|(?:fetch-patient|patient-coverage|get-adt-records)\/([a-zA-Z0-9-]+))/i;
    static FACILITY_ID_REGEX = /(?:facility\s*(?:id|uuid)?|facId)[":\s\[]+([a-zA-Z0-9-]+)/i;
    static ORG_UUID_REGEX = /(?:org\s*(?:uuid|id)?[":\s\[]+([a-zA-Z0-9-]+))/i;
    static PCC_FACILITY_ID_REGEX = /(?:pccFacilityDbURL:(\d+)|"facId":\s*(\d+))/i;
    // API Call patterns
    static API_REQUEST_REGEX = /(?:PCC API Request|GET|POST|PUT|DELETE):\s*(GET|POST|PUT|DELETE)?\s*([^\s]+)/i;
    static API_STATUS_REGEX = /Status:\s*\[?(\d{3})\]?/i;
    static API_DURATION_REGEX = /(?:duration|took)[":\s]+(\d+)\s*ms/i;
    /**
     * Stateful method to parse all text in a PDF page.
     * Handles multi-line label-value fields and multi-line JSON blocks.
     */
    static parsePage(pageText, pageNum, startLineNum) {
        const lines = pageText.split('\n');
        const parsedEntries = [];
        let i = 0;
        let lineNum = startLineNum;
        while (i < lines.length) {
            const line = lines[i].trim();
            if (line.length === 0) {
                i++;
                continue;
            }
            // 1. Check for JSON block start
            if (line.startsWith('{')) {
                let jsonStr = line;
                let openBraces = (line.match(/{/g) || []).length;
                let closeBraces = (line.match(/}/g) || []).length;
                let j = i + 1;
                while (openBraces > closeBraces && j < lines.length) {
                    const nextLine = lines[j].trim();
                    jsonStr += '\n' + nextLine;
                    openBraces += (nextLine.match(/{/g) || []).length;
                    closeBraces += (nextLine.match(/}/g) || []).length;
                    j++;
                }
                const linesConsumed = j - i;
                const parsed = this.parseLine(jsonStr, pageNum, lineNum);
                parsedEntries.push(parsed);
                i = j;
                lineNum += linesConsumed;
                continue;
            }
            // 2. Check for multi-line label-value fields
            const labelMatch = line.match(/^(Patient\s*(?:id)?|Facility\s*(?:id)?|PCC\s*Facility\s*id|Event|Status|Duration|Date\s*Range|Processing\s*Date|orgUuid|orgId)\s*:?$/i);
            if (labelMatch && i + 1 < lines.length) {
                let j = i + 1;
                while (j < lines.length && lines[j].trim().length === 0) {
                    j++;
                }
                if (j < lines.length) {
                    const valueLine = lines[j].trim();
                    // Ensure it's not a new label or start of JSON
                    if (!valueLine.match(/^[a-zA-Z\s]+:/) && !valueLine.startsWith('{') && !valueLine.includes('---')) {
                        const combinedLine = `${line} ${valueLine}`;
                        const parsed = this.parseLine(combinedLine, pageNum, lineNum);
                        parsedEntries.push(parsed);
                        const linesConsumed = j - i + 1;
                        i = j + 1;
                        lineNum += linesConsumed;
                        continue;
                    }
                }
            }
            // 3. Normal line
            const parsed = this.parseLine(line, pageNum, lineNum);
            parsedEntries.push(parsed);
            i++;
            lineNum++;
        }
        return parsedEntries;
    }
    /**
     * Parse a single log line (potentially combined or JSON) into a structured LogEntry
     */
    static parseLine(rawMessage, page, lineNum) {
        const trimmed = rawMessage.trim();
        // 1. Extract Timestamp
        let timestamp = new Date().toISOString(); // fallback
        const tsMatch = trimmed.match(this.TIMESTAMP_REGEX);
        if (tsMatch) {
            timestamp = tsMatch[1].replace(',', '.');
            if (!timestamp.endsWith('Z') && !timestamp.includes('+')) {
                timestamp += 'Z';
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
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
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
        let webhookId = jsonPayload?.webhookId || jsonPayload?.id || jsonPayload?.messageId || undefined;
        let patientId = jsonPayload?.patientId ? String(jsonPayload.patientId) : (jsonPayload?.patientUuid || undefined);
        let facilityId = jsonPayload?.facilityId ? String(jsonPayload.facilityId) : (jsonPayload?.facilityUuid || jsonPayload?.facId ? String(jsonPayload.facId) : undefined);
        let pccFacilityId = jsonPayload?.facId ? String(jsonPayload.facId) : undefined;
        let orgUuid = jsonPayload?.orgUuid || jsonPayload?.orgId ? String(jsonPayload.orgId) : undefined;
        let eventType = jsonPayload?.eventType || undefined;
        let endpoint = jsonPayload?.endpoint || undefined;
        let duration = jsonPayload?.duration ? Number(jsonPayload.duration) : undefined;
        let status = jsonPayload?.status || undefined;
        // 5. If fields not in JSON, extract via Regex from text message
        if (!webhookId) {
            const whMatch = trimmed.match(this.WEBHOOK_ID_REGEX);
            if (whMatch) {
                webhookId = whMatch[1] || whMatch[2] || whMatch[3] || whMatch[4];
            }
        }
        if (!patientId) {
            const ptMatch = trimmed.match(this.PATIENT_ID_REGEX);
            if (ptMatch) {
                patientId = ptMatch[1] || ptMatch[2];
            }
        }
        if (!facilityId) {
            const facMatch = trimmed.match(this.FACILITY_ID_REGEX);
            if (facMatch) {
                facilityId = facMatch[1];
            }
        }
        if (!pccFacilityId) {
            const pccFacMatch = trimmed.match(this.PCC_FACILITY_ID_REGEX);
            if (pccFacMatch) {
                pccFacilityId = pccFacMatch[1] || pccFacMatch[2];
            }
        }
        if (!orgUuid) {
            const orgMatch = trimmed.match(this.ORG_UUID_REGEX);
            if (orgMatch) {
                orgUuid = orgMatch[1];
            }
        }
        // 6. Match Specific Service Events
        let message = trimmed;
        if (trimmed.includes('PccCensusService')) {
            eventType = 'PccCensusService';
        }
        else if (trimmed.includes('DailyForecastRecalculationService') || trimmed.includes('DailyForecast recalculated') || trimmed.includes('DailyForecast recalculation')) {
            eventType = 'DailyForecastRecalculationService';
        }
        else if (trimmed.includes('Cache HIT')) {
            eventType = 'Cache HIT';
        }
        else if (trimmed.includes('Cache MISS')) {
            eventType = 'Cache MISS';
        }
        else if (trimmed.includes('ADT Match Found') || trimmed.includes('ADT matched')) {
            eventType = 'ADT Match';
        }
        else if (trimmed.includes('ADT Fallback') || trimmed.includes('Fallback ADT Used') || trimmed.includes('Fallback to latest')) {
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
        // Map facility ID special cases
        if (trimmed.includes('Unknown PCC facility ID')) {
            facilityId = 'Unknown';
            level = 'ERROR';
        }
        return {
            timestamp,
            level,
            eventType,
            patientId,
            facilityId,
            pccFacilityId,
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

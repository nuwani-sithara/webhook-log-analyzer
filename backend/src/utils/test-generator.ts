import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Script to generate mock PCC webhook log PDFs of arbitrary page size.
 * Usage: ts-node test-generator.ts <numPages> <outputPath>
 */

const EVENT_TYPES = [
  'patient.admit',
  'patient.discharge',
  'patient.updateAccount',
  'patient.transfer',
  'patient.leave',
  'patient.cancelLeave',
  'patient.undoDischarge',
  'patient.death'
];

const FACILITIES = ['fac-101', 'fac-102', 'fac-103', 'fac-104', 'fac-105'];
const ORGS = ['org-uuid-001', 'org-uuid-002', 'org-uuid-003'];

function generateWebhookId() {
  return 'wh-' + Math.random().toString(36).substring(2, 10) + '-' + Math.random().toString(36).substring(2, 6);
}

function generatePatientId() {
  return 'pat-' + Math.floor(100000 + Math.random() * 900000);
}

function padZero(num: number): string {
  return num < 10 ? '0' + num : num.toString();
}

function formatTimestamp(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = padZero(d.getMonth() + 1);
  const dd = padZero(d.getDate());
  const hh = padZero(d.getHours());
  const min = padZero(d.getMinutes());
  const ss = padZero(d.getSeconds());
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}.${ms}`;
}

export function generateMockLogs(numLines: number): string[] {
  const logs: string[] = [];
  let currentTime = new Date();
  
  let lineCount = 0;
  while (lineCount < numLines) {
    // Determine flow scenario
    const rand = Math.random();
    const whId = generateWebhookId();
    const patId = generatePatientId();
    const facId = Math.random() < 0.05 ? 'fac-999' : FACILITIES[Math.floor(Math.random() * FACILITIES.length)]; // fac-999 is unknown
    const orgId = ORGS[Math.floor(Math.random() * ORGS.length)];
    const eventType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];

    // 1. Success Scenario (80%)
    if (rand < 0.8) {
      currentTime = new Date(currentTime.getTime() + Math.random() * 2000);
      logs.push(`${formatTimestamp(currentTime)} [INFO] Webhook received. ID: [${whId}] Type: [${eventType}] Facility: [${facId}] Org: [${orgId}]`);
      
      currentTime = new Date(currentTime.getTime() + 10 + Math.random() * 50);
      logs.push(`${formatTimestamp(currentTime)} [INFO] ADT Match processing. Patient: [${patId}] ID: [${whId}]`);
      logs.push(`${formatTimestamp(currentTime)} [INFO] ADT Match successfully linked patient record. ID: [${whId}]`);
      
      currentTime = new Date(currentTime.getTime() + 50 + Math.random() * 100);
      const apiDuration = Math.floor(50 + Math.random() * 200);
      logs.push(`${formatTimestamp(currentTime)} [INFO] PCC API Request: GET /patients/${patId} - Status: [200] Duration: [${apiDuration}ms] ID: [${whId}]`);
      logs.push(`${formatTimestamp(currentTime)} [INFO] Cache HIT for facility ${facId} config. ID: [${whId}]`);
      
      currentTime = new Date(currentTime.getTime() + 20 + Math.random() * 100);
      logs.push(`${formatTimestamp(currentTime)} [INFO] PccCensusService: start census update for patient ${patId}. ID: [${whId}]`);
      
      currentTime = new Date(currentTime.getTime() + 100 + Math.random() * 300);
      logs.push(`${formatTimestamp(currentTime)} [INFO] PccCensusService: complete census update successfully. ID: [${whId}]`);
      
      currentTime = new Date(currentTime.getTime() + 20 + Math.random() * 50);
      logs.push(`${formatTimestamp(currentTime)} [INFO] DailyForecastRecalculationService: start forecast recalculation. ID: [${whId}]`);
      
      currentTime = new Date(currentTime.getTime() + 300 + Math.random() * 500);
      logs.push(`${formatTimestamp(currentTime)} [INFO] DailyForecastRecalculationService: complete forecast recalculation successfully. ID: [${whId}]`);
      
      currentTime = new Date(currentTime.getTime() + 10);
      logs.push(`${formatTimestamp(currentTime)} [INFO] Webhook completed for patient ${patId}. ID: [${whId}]`);
      lineCount += 10;
    }
    // 2. ADT Fallback Scenario (5%)
    else if (rand < 0.85) {
      currentTime = new Date(currentTime.getTime() + Math.random() * 2000);
      logs.push(`${formatTimestamp(currentTime)} [INFO] Webhook received. ID: [${whId}] Type: [${eventType}] Facility: [${facId}] Org: [${orgId}]`);
      
      currentTime = new Date(currentTime.getTime() + 10 + Math.random() * 50);
      logs.push(`${formatTimestamp(currentTime)} [INFO] ADT Match processing. Patient: [${patId}] ID: [${whId}]`);
      logs.push(`${formatTimestamp(currentTime)} [WARN] ADT Match failed to find primary record. Triggering ADT Fallback search. ID: [${whId}]`);
      
      currentTime = new Date(currentTime.getTime() + 150 + Math.random() * 200);
      const apiDuration = Math.floor(100 + Math.random() * 200);
      logs.push(`${formatTimestamp(currentTime)} [INFO] PCC API Request: GET /patients/search - Status: [200] Duration: [${apiDuration}ms] ID: [${whId}]`);
      logs.push(`${formatTimestamp(currentTime)} [INFO] ADT Fallback match established via backup identifier. ID: [${whId}]`);
      
      currentTime = new Date(currentTime.getTime() + 50);
      logs.push(`${formatTimestamp(currentTime)} [INFO] PccCensusService: start census update for patient ${patId}. ID: [${whId}]`);
      currentTime = new Date(currentTime.getTime() + 200);
      logs.push(`${formatTimestamp(currentTime)} [INFO] PccCensusService: complete census update successfully. ID: [${whId}]`);
      
      currentTime = new Date(currentTime.getTime() + 10);
      logs.push(`${formatTimestamp(currentTime)} [INFO] Webhook completed for patient ${patId}. ID: [${whId}]`);
      lineCount += 8;
    }
    // 3. API Error/Timeout Scenario (5%)
    else if (rand < 0.90) {
      currentTime = new Date(currentTime.getTime() + Math.random() * 2000);
      logs.push(`${formatTimestamp(currentTime)} [INFO] Webhook received. ID: [${whId}] Type: [${eventType}] Facility: [${facId}] Org: [${orgId}]`);
      
      currentTime = new Date(currentTime.getTime() + 10 + Math.random() * 50);
      logs.push(`${formatTimestamp(currentTime)} [INFO] ADT Match processing. Patient: [${patId}] ID: [${whId}]`);
      
      currentTime = new Date(currentTime.getTime() + 100);
      if (Math.random() < 0.5) {
        // Slow API Timeout
        logs.push(`${formatTimestamp(currentTime)} [INFO] PCC API Request: GET /patients/${patId} - Status: [0] Duration: [10050ms] ID: [${whId}]`);
        currentTime = new Date(currentTime.getTime() + 10050);
        logs.push(`${formatTimestamp(currentTime)} [ERROR] Exception caught in Webhook Process: Gateway Connection Timeout exception during PCC fetch. ID: [${whId}]`);
      } else {
        // Internal Server Error (500)
        logs.push(`${formatTimestamp(currentTime)} [INFO] PCC API Request: GET /patients/${patId} - Status: [500] Duration: [180ms] ID: [${whId}]`);
        logs.push(`${formatTimestamp(currentTime)} [ERROR] PCC API failed with server error 500. Message: Internal server error. ID: [${whId}]`);
      }
      
      currentTime = new Date(currentTime.getTime() + 10);
      logs.push(`${formatTimestamp(currentTime)} [ERROR] Webhook execution terminated with errors. ID: [${whId}]`);
      lineCount += 5;
    }
    // 4. Token Failure Scenario (3%)
    else if (rand < 0.93) {
      currentTime = new Date(currentTime.getTime() + Math.random() * 2000);
      logs.push(`${formatTimestamp(currentTime)} [INFO] Webhook received. ID: [${whId}] Type: [${eventType}] Facility: [${facId}] Org: [${orgId}]`);
      
      currentTime = new Date(currentTime.getTime() + 10);
      logs.push(`${formatTimestamp(currentTime)} [INFO] ADT Match processing. Patient: [${patId}] ID: [${whId}]`);
      
      currentTime = new Date(currentTime.getTime() + 50);
      logs.push(`${formatTimestamp(currentTime)} [INFO] PCC API Request: GET /patients/${patId} - Status: [401] Duration: [45ms] ID: [${whId}]`);
      logs.push(`${formatTimestamp(currentTime)} [ERROR] Token expired or OAuth authentication failed. Response: Unauthorized 401. ID: [${whId}]`);
      
      currentTime = new Date(currentTime.getTime() + 10);
      logs.push(`${formatTimestamp(currentTime)} [ERROR] Webhook execution terminated with errors. ID: [${whId}]`);
      lineCount += 5;
    }
    // 5. Service Hang Scenario (Census/Forecast) (3%)
    else if (rand < 0.96) {
      currentTime = new Date(currentTime.getTime() + Math.random() * 2000);
      logs.push(`${formatTimestamp(currentTime)} [INFO] Webhook received. ID: [${whId}] Type: [${eventType}] Facility: [${facId}] Org: [${orgId}]`);
      
      currentTime = new Date(currentTime.getTime() + 20);
      logs.push(`${formatTimestamp(currentTime)} [INFO] ADT Match processing. Patient: [${patId}] ID: [${whId}]`);
      
      currentTime = new Date(currentTime.getTime() + 50);
      logs.push(`${formatTimestamp(currentTime)} [INFO] PccCensusService: start census update for patient ${patId}. ID: [${whId}]`);
      
      // HANG - missing completion log line!
      currentTime = new Date(currentTime.getTime() + 2000);
      logs.push(`${formatTimestamp(currentTime)} [WARN] Transaction whId [${whId}] running abnormally long, thread holding census lock.`);
      lineCount += 4;
    }
    // 6. Duplicate Webhook Delivery Scenario (4%)
    else {
      // Generate two duplicate webhooks
      currentTime = new Date(currentTime.getTime() + Math.random() * 2000);
      const duplicateWhId = whId; // same ID
      const dupTime1 = new Date(currentTime.getTime());
      const dupTime2 = new Date(currentTime.getTime() + 100);

      // Attempt 1
      logs.push(`${formatTimestamp(dupTime1)} [INFO] Webhook received. ID: [${duplicateWhId}] Type: [${eventType}] Facility: [${facId}] Org: [${orgId}]`);
      logs.push(`${formatTimestamp(dupTime1)} [INFO] ADT Match processing. Patient: [${patId}] ID: [${duplicateWhId}]`);
      
      // Attempt 2
      logs.push(`${formatTimestamp(dupTime2)} [INFO] Webhook received. ID: [${duplicateWhId}] Type: [${eventType}] Facility: [${facId}] Org: [${orgId}]`);
      logs.push(`${formatTimestamp(dupTime2)} [WARN] Duplicate webhook ID received: [${duplicateWhId}]. Rejecting redundant process.`);
      lineCount += 4;
    }
  }
  
  return logs;
}

export function generatePdf(numPages: number, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Estimate lines needed: about 45 lines per page
    const linesPerPage = 45;
    const totalLines = numPages * linesPerPage;
    const logs = generateMockLogs(totalLines);
    
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 36, // 0.5 inch margins
      bufferPages: true
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Setup style
    doc.font('Courier');
    doc.fontSize(8);

    let currentLineOnPage = 0;
    
    for (let i = 0; i < logs.length; i++) {
      if (currentLineOnPage >= linesPerPage) {
        doc.addPage();
        currentLineOnPage = 0;
      }
      
      doc.text(logs[i], { lineGap: 2 });
      currentLineOnPage++;
    }

    doc.end();

    stream.on('finish', () => {
      resolve();
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
}

// Executed when run directly
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('test-generator.ts') || 
  process.argv[1].endsWith('test-generator.js') ||
  process.argv[1].includes('test-generator')
);

if (isDirectRun) {
  const args = process.argv.slice(2);
  const pages = parseInt(args[0] || '10', 10);
  const out = args[1] || path.join(__dirname, '..', '..', 'test-data', `mock-logs-${pages}p.pdf`);
  
  const dir = path.dirname(out);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log(`Generating mock log PDF with ${pages} pages to: ${out}...`);
  generatePdf(pages, out)
    .then(() => console.log('Mock PDF generation complete!'))
    .catch((err) => console.error('Generation failed:', err));
}

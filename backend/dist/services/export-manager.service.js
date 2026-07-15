import * as XLSX from 'xlsx';
export class ExportManagerService {
    /**
     * Generates a multi-sheet Excel report containing Summary, Transactions, and Issues details.
     */
    static generateExcel(report) {
        const wb = XLSX.utils.book_new();
        // 1. KPI Summary Sheet
        const summaryData = [
            { Metric: 'Total Webhook Events', Value: report.totalEvents },
            { Metric: 'Successful Webhook Runs', Value: report.transactions.filter(tx => tx.status === 'success' || tx.status === 'warning').length },
            { Metric: 'Warnings Count', Value: report.warningsCount },
            { Metric: 'Errors Count', Value: report.errorsCount },
            { Metric: 'Patients Affected', Value: report.patientsAffected.length },
            { Metric: 'Facilities Affected', Value: report.facilitiesAffected.length },
            { Metric: 'Census Updates', Value: report.censusUpdatesCount },
            { Metric: 'Forecast Updates', Value: report.forecastUpdatesCount },
            { Metric: 'Duplicate Webhooks', Value: report.duplicateEventsCount },
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');
        // 2. Transactions Sheet
        const transactionsData = report.transactions.map(tx => ({
            'Webhook ID': tx.webhookId,
            'Event Type': tx.eventType,
            'Patient ID': tx.patientId || 'N/A',
            'Facility ID': tx.facilityId || 'N/A',
            'Org UUID': tx.orgUuid || 'N/A',
            'Start Time': tx.startTime,
            'End Time': tx.endTime,
            'Duration (ms)': tx.duration,
            'Status': tx.status === 'error' ? 'FAILED' : (tx.status === 'warning' ? 'SUCCESS (WARNING)' : 'SUCCESS'),
            'ADT Match': tx.adtMatchStatus.toUpperCase(),
            'API Calls Count': tx.apisCalled.length,
            'Census Actions': tx.censusOperations.length,
            'Forecast Actions': tx.forecastOperations.length,
            'Errors Encountered': tx.errors.join(' | '),
            'Warnings Encountered': tx.warnings.join(' | '),
        }));
        const wsTx = XLSX.utils.json_to_sheet(transactionsData);
        XLSX.utils.book_append_sheet(wb, wsTx, 'Transactions');
        // 3. Detailed Issues Sheet
        const issuesData = [];
        for (const tx of report.transactions) {
            const target = `Patient: ${tx.patientId || 'N/A'}, Facility: ${tx.facilityId || 'N/A'}`;
            for (const err of tx.errors) {
                issuesData.push({ Type: 'ERROR', Target: target, Description: err });
            }
            for (const warn of tx.warnings) {
                issuesData.push({ Type: 'WARNING', Target: target, Description: warn });
            }
        }
        const wsIssues = XLSX.utils.json_to_sheet(issuesData);
        XLSX.utils.book_append_sheet(wb, wsIssues, 'Detected Issues');
        // Generate buffer
        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }
    /**
     * Generates a CSV list of all parsed transactions.
     */
    static generateCsv(transactions) {
        const headers = [
            'Webhook ID',
            'Event Type',
            'Patient ID',
            'Facility ID',
            'Start Time',
            'Duration (ms)',
            'Status',
            'ADT Match Status',
            'Errors Count',
            'Warnings Count'
        ];
        const lines = [headers.join(',')];
        for (const tx of transactions) {
            const row = [
                `"${tx.webhookId || ''}"`,
                `"${tx.eventType || ''}"`,
                `"${tx.patientId || ''}"`,
                `"${tx.facilityId || ''}"`,
                `"${tx.startTime || ''}"`,
                tx.duration,
                `"${tx.status === 'error' ? 'FAILED' : (tx.status === 'warning' ? 'SUCCESS (WARNING)' : 'SUCCESS')}"`,
                `"${tx.adtMatchStatus}"`,
                tx.errors.length,
                tx.warnings.length
            ];
            lines.push(row.join(','));
        }
        return lines.join('\n');
    }
    /**
     * Generates a beautiful HTML report styling transaction flows and executive summaries.
     */
    static generateHtmlReport(report) {
        const errorRows = report.transactions
            .filter(tx => tx.status === 'error')
            .map(tx => `
        <tr class="hover:bg-red-50 text-red-900 border-b">
          <td class="px-6 py-4 font-mono text-sm">${tx.webhookId}</td>
          <td class="px-6 py-4">${tx.eventType}</td>
          <td class="px-6 py-4">${tx.patientId || 'N/A'}</td>
          <td class="px-6 py-4">${tx.facilityId || 'N/A'}</td>
          <td class="px-6 py-4 font-semibold text-red-600">${tx.errors.length} Errors</td>
        </tr>
      `).join('');
        const warningRows = report.transactions
            .filter(tx => tx.status === 'warning')
            .map(tx => `
        <tr class="hover:bg-yellow-50 text-yellow-900 border-b">
          <td class="px-6 py-4 font-mono text-sm">${tx.webhookId}</td>
          <td class="px-6 py-4">${tx.eventType}</td>
          <td class="px-6 py-4">${tx.patientId || 'N/A'}</td>
          <td class="px-6 py-4">${tx.facilityId || 'N/A'}</td>
          <td class="px-6 py-4 font-semibold text-yellow-600">${tx.warnings.length} Warnings</td>
        </tr>
      `).join('');
        const successRows = report.transactions
            .filter(tx => tx.status === 'success')
            .map(tx => `
        <tr class="hover:bg-emerald-50 text-emerald-950 border-b">
          <td class="px-6 py-4 font-mono text-sm">${tx.webhookId}</td>
          <td class="px-6 py-4">${tx.eventType}</td>
          <td class="px-6 py-4">${tx.patientId || 'N/A'}</td>
          <td class="px-6 py-4">${tx.facilityId || 'N/A'}</td>
          <td class="px-6 py-4 font-semibold text-emerald-600">Success (${tx.duration} ms)</td>
        </tr>
      `).join('');
        const aiRecs = report.aiSummary.recommendedActions
            .map(rec => `
        <li class="flex items-start mb-2">
          <svg class="h-6 w-6 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-gray-700">${rec}</span>
        </li>
      `).join('');
        const criticalList = report.aiSummary.criticalIssues
            .map(issue => `
        <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-3 rounded-r">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm font-medium text-red-800">${issue}</p>
            </div>
          </div>
        </div>
      `).join('');
        return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PointClickCare Webhook Log Analysis Report</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @media print {
            .no-print { display: none !important; }
            body { background: white; color: black; }
            .print-break { page-break-before: always; }
          }
        </style>
      </head>
      <body class="bg-slate-50 font-sans text-slate-800 min-h-screen">
        <header class="bg-slate-900 text-white shadow no-print">
          <div class="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
            <div>
              <h1 class="text-2xl font-bold tracking-tight">PointClickCare Webhook Log Analyzer</h1>
              <p class="text-slate-400 text-sm mt-1">Generated Analysis Report</p>
            </div>
            <button onclick="window.print()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-semibold text-sm shadow transition duration-200">
              Print to PDF
            </button>
          </div>
        </header>

        <main class="max-w-7xl mx-auto px-4 py-8">
          <!-- KPI Stats -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div class="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
              <h3 class="text-xs font-semibold text-slate-500 uppercase">Correlated Transactions</h3>
              <p class="text-3xl font-bold mt-2 text-slate-900">${report.transactions.length}</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
              <h3 class="text-xs font-semibold text-slate-500 uppercase">Total Log Events</h3>
              <p class="text-3xl font-bold mt-2 text-slate-900">${report.totalEvents}</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-red-500">
              <h3 class="text-xs font-semibold text-slate-500 uppercase">Critical Errors</h3>
              <p class="text-3xl font-bold mt-2 text-red-600">${report.errorsCount}</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-yellow-500">
              <h3 class="text-xs font-semibold text-slate-500 uppercase">Warnings Raised</h3>
              <p class="text-3xl font-bold mt-2 text-yellow-600">${report.warningsCount}</p>
            </div>
          </div>

          <!-- Executive Summary Section -->
          <div class="bg-white rounded-lg shadow-sm border border-slate-200 p-8 mb-8">
            <h2 class="text-xl font-bold text-slate-900 border-b pb-4 mb-6">AI Executive Summary</h2>
            <div class="prose max-w-none text-slate-700 leading-relaxed mb-6">
              ${report.aiSummary.executiveSummary.replace(/\n/g, '<br/>')}
            </div>

            ${criticalList.length > 0 ? `
              <h3 class="font-bold text-slate-800 mb-3">Critical Issues Summary</h3>
              <div class="mb-6">${criticalList}</div>
            ` : ''}

            <h3 class="font-bold text-slate-800 mb-3">Actionable Architecture Recommendations</h3>
            <ul class="list-none p-0">${aiRecs}</ul>
          </div>

          <!-- Problematic Facilities & Patients -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 class="font-bold text-slate-900 border-b pb-3 mb-4">Problematic Facilities</h3>
              <ul class="space-y-2">
                ${report.aiSummary.facilitiesWithProblems.map(f => `
                  <li class="flex items-center text-gray-700">
                    <span class="w-3 h-3 bg-indigo-500 rounded-full mr-3"></span>
                    ${f}
                  </li>
                `).join('') || '<li class="text-gray-500 text-sm">No problematic facilities detected.</li>'}
              </ul>
            </div>
            <div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 class="font-bold text-slate-900 border-b pb-3 mb-4">Patients Requiring Investigation</h3>
              <ul class="space-y-2">
                ${report.aiSummary.patientsRequiringInvestigation.map(p => `
                  <li class="flex items-center text-gray-700 font-mono text-sm">
                    <span class="w-3 h-3 bg-amber-500 rounded-full mr-3"></span>
                    Patient ID: ${p}
                  </li>
                `).join('') || '<li class="text-gray-500 text-sm">No patients requiring urgent review.</li>'}
              </ul>
            </div>
          </div>

          <!-- Transactions Breakdown (Errors) -->
          ${errorRows.length > 0 ? `
            <div class="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-8 print-break">
              <div class="bg-red-600 px-6 py-4">
                <h3 class="font-bold text-white text-lg">Error Transactions Detail</h3>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="bg-slate-100 border-b">
                      <th class="px-6 py-3 font-semibold text-sm">Webhook ID</th>
                      <th class="px-6 py-3 font-semibold text-sm">Event Type</th>
                      <th class="px-6 py-3 font-semibold text-sm">Patient ID</th>
                      <th class="px-6 py-3 font-semibold text-sm">Facility ID</th>
                      <th class="px-6 py-3 font-semibold text-sm">Error Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${errorRows}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}

          <!-- Transactions Breakdown (Warnings) -->
          ${warningRows.length > 0 ? `
            <div class="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-8 print-break">
              <div class="bg-yellow-500 px-6 py-4">
                <h3 class="font-bold text-white text-lg">Warning Transactions Detail</h3>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="bg-slate-100 border-b">
                      <th class="px-6 py-3 font-semibold text-sm">Webhook ID</th>
                      <th class="px-6 py-3 font-semibold text-sm">Event Type</th>
                      <th class="px-6 py-3 font-semibold text-sm">Patient ID</th>
                      <th class="px-6 py-3 font-semibold text-sm">Facility ID</th>
                      <th class="px-6 py-3 font-semibold text-sm">Warning Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${warningRows}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}

          <!-- Transactions Breakdown (Success) -->
          ${successRows.length > 0 ? `
            <div class="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-8 print-break">
              <div class="bg-emerald-600 px-6 py-4">
                <h3 class="font-bold text-white text-lg">Successful Webhook Transactions</h3>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="bg-slate-100 border-b">
                      <th class="px-6 py-3 font-semibold text-sm">Webhook ID</th>
                      <th class="px-6 py-3 font-semibold text-sm">Event Type</th>
                      <th class="px-6 py-3 font-semibold text-sm">Patient ID</th>
                      <th class="px-6 py-3 font-semibold text-sm">Facility ID</th>
                      <th class="px-6 py-3 font-semibold text-sm">Status Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${successRows}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
        </main>
      </body>
      </html>
    `;
    }
}

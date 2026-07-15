import { Request, Response } from 'express';
import { reportCache } from './analyze.controller.js';
import { ExportManagerService } from '../services/export-manager.service.js';

export function exportExcel(req: Request, res: Response): void {
  const { reportId } = req.params;
  const report = reportCache.get(reportId as string);

  if (!report) {
    res.status(404).json({ error: 'Report not found or has expired.' });
    return;
  }

  try {
    const excelBuffer = ExportManagerService.generateExcel(report);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=pcc_webhook_report_${reportId}.xlsx`
    );
    res.send(excelBuffer);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate Excel export: ' + error.message });
  }
}

export function exportCsv(req: Request, res: Response): void {
  const { reportId } = req.params;
  const report = reportCache.get(reportId as string);

  if (!report) {
    res.status(404).json({ error: 'Report not found or has expired.' });
    return;
  }

  try {
    const csvContent = ExportManagerService.generateCsv(report.transactions);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=pcc_webhook_transactions_${reportId}.csv`
    );
    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate CSV export: ' + error.message });
  }
}

export function exportHtml(req: Request, res: Response): void {
  const { reportId } = req.params;
  const report = reportCache.get(reportId as string);

  if (!report) {
    res.status(404).json({ error: 'Report not found or has expired.' });
    return;
  }

  try {
    const htmlReport = ExportManagerService.generateHtmlReport(report);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader(
      'Content-Disposition',
      `inline; filename=pcc_webhook_report_${reportId}.html`
    );
    res.send(htmlReport);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate HTML report: ' + error.message });
  }
}

/**
 * Milestone Excel Exporter (ADR-034)
 *
 * Generates an .xlsx file with 2 sheets:
 * 1. Ορόσημα — all milestones with dates, status, progress, descriptions
 * 2. Σύνοψη — aggregate statistics
 *
 * Uses ExcelJS (MIT license) — same pattern as gantt-excel-exporter.ts.
 */

import ExcelJS from 'exceljs';
import type { MilestoneExportOptions } from './types';
import { triggerBlobDownload } from '../gantt-export/gantt-export-utils';

// ─── Styling Constants ───────────────────────────────────────────────────

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF3B82F6' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
};

/** Status → ARGB fill colors for conditional cell coloring */
const STATUS_FILL: Record<string, ExcelJS.Fill> = {
  'completed': {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDCFCE7' }, // green-100
  },
  'in-progress': {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDBEAFE' }, // blue-100
  },
  'pending': {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' }, // slate-100
  },
  'delayed': {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFEE2E2' }, // red-100
  },
};

const STATUS_FONT: Record<string, Partial<ExcelJS.Font>> = {
  'completed':   { bold: true, color: { argb: 'FF16A34A' } },
  'in-progress': { bold: true, color: { argb: 'FF2563EB' } },
  'pending':     { bold: true, color: { argb: 'FF64748B' } },
  'delayed':     { bold: true, color: { argb: 'FFDC2626' } },
};

const STATUS_TEXT: Record<string, string> = {
  'completed':   'Ολοκληρώθηκε',
  'in-progress': 'Σε Εξέλιξη',
  'pending':     'Εκκρεμεί',
  'delayed':     'Καθυστέρηση',
};

// ─── Main Export Function ────────────────────────────────────────────────

export async function exportMilestonesToExcel(options: MilestoneExportOptions): Promise<void> {
  const { milestones, buildingName, filename, companyName, projectName } = options;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Nestor App';
  workbook.created = new Date();

  // ─── Sheet 1: Ορόσημα ──────────────────────────────────────────────

  const sheet = workbook.addWorksheet('Ορόσημα');
  sheet.columns = [
    { header: '#', key: 'index', width: 6 },
    { header: 'Ορόσημο', key: 'title', width: 28 },
    { header: 'Περιγραφή', key: 'description', width: 40 },
    { header: 'Ημερομηνία', key: 'date', width: 15 },
    { header: 'Κατάσταση', key: 'status', width: 16 },
    { header: 'Πρόοδος %', key: 'progress', width: 12 },
    { header: 'Τύπος', key: 'type', width: 14 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = HEADER_FONT;
  headerRow.fill = HEADER_FILL;
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Populate data rows
  milestones.forEach((m, i) => {
    const statusText = STATUS_TEXT[m.status] ?? m.status;
    const row = sheet.addRow({
      index: i + 1,
      title: m.title,
      description: m.description ?? '',
      date: new Date(m.date).toLocaleDateString('el-GR'),
      status: statusText,
      progress: m.progress ?? 0,
      type: m.type,
    });

    // Color-code status cell (column 5 = index 5)
    const statusCell = row.getCell(5);
    const fillConfig = STATUS_FILL[m.status];
    const fontConfig = STATUS_FONT[m.status];
    if (fillConfig) statusCell.fill = fillConfig;
    if (fontConfig) statusCell.font = fontConfig;
    statusCell.alignment = { horizontal: 'center' };

    // Center progress cell
    row.getCell(6).alignment = { horizontal: 'center' };
    // Center index cell
    row.getCell(1).alignment = { horizontal: 'center' };
  });

  // Auto-filter on all columns
  sheet.autoFilter = {
    from: 'A1',
    to: `G${milestones.length + 1}`,
  };

  // ─── Sheet 2: Σύνοψη ──────────────────────────────────────────────

  const summarySheet = workbook.addWorksheet('Σύνοψη');
  summarySheet.columns = [
    { header: 'Μετρική', key: 'metric', width: 30 },
    { header: 'Τιμή', key: 'value', width: 25 },
  ];

  // Style header
  const summaryHeader = summarySheet.getRow(1);
  summaryHeader.font = HEADER_FONT;
  summaryHeader.fill = HEADER_FILL;

  // Calculate stats
  const total = milestones.length;
  const completed = milestones.filter(m => m.status === 'completed').length;
  const inProgress = milestones.filter(m => m.status === 'in-progress').length;
  const pending = milestones.filter(m => m.status === 'pending').length;
  const delayed = milestones.filter(m => m.status === 'delayed').length;
  const avgProgress = total > 0
    ? Math.round(milestones.reduce((sum, m) => sum + (m.progress ?? 0), 0) / total)
    : 0;

  if (companyName) {
    summarySheet.addRow({ metric: 'Εταιρεία', value: companyName });
  }
  if (projectName) {
    summarySheet.addRow({ metric: 'Έργο', value: projectName });
  }
  summarySheet.addRow({ metric: 'Κτίριο', value: buildingName });
  summarySheet.addRow({ metric: 'Ημ. Εξαγωγής', value: new Date().toLocaleDateString('el-GR') });
  summarySheet.addRow({ metric: 'Σύνολο Ορoσήμων', value: total });
  summarySheet.addRow({ metric: 'Ολοκληρωμένα', value: completed });
  summarySheet.addRow({ metric: 'Σε Εξέλιξη', value: inProgress });
  summarySheet.addRow({ metric: 'Εκκρεμή', value: pending });
  summarySheet.addRow({ metric: 'Καθυστερημένα', value: delayed });
  summarySheet.addRow({ metric: 'Μέση Πρόοδος %', value: `${avgProgress}%` });

  // ─── Download ──────────────────────────────────────────────────────

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBlobDownload(blob, filename);
}

/**
 * Gantt Excel Exporter (ADR-034)
 *
 * Generates an .xlsx file with 2 sheets:
 * 1. Timeline — all phases/tasks with dates, duration, progress
 * 2. Summary — aggregate stats (total phases, tasks, avg progress)
 *
 * Uses exceljs (MIT license) for styled Excel generation.
 */

import ExcelJS from 'exceljs';
import type { GanttExportOptions } from './types';
import { flattenTaskGroupsToRows, triggerBlobDownload } from './gantt-export-utils';

/** Blue header style — matches the app's primary color (#3B82F6) */
const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF3B82F6' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
};

/**
 * Exports Gantt data as a styled Excel workbook (.xlsx).
 */
export async function exportGanttToExcel(options: GanttExportOptions): Promise<void> {
  const { taskGroups, buildingName, filename } = options;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Nestor Pagonis';
  workbook.created = new Date();

  // ─── Sheet 1: Timeline ────────────────────────────────────────────

  const sheet = workbook.addWorksheet('Timeline');
  sheet.columns = [
    { header: 'Φάση', key: 'phase', width: 25 },
    { header: 'Εργασία', key: 'task', width: 30 },
    { header: 'Έναρξη', key: 'start', width: 15 },
    { header: 'Λήξη', key: 'end', width: 15 },
    { header: 'Διάρκεια (ημ.)', key: 'duration', width: 14 },
    { header: 'Πρόοδος %', key: 'progress', width: 12 },
    { header: 'Κατάσταση', key: 'status', width: 15 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = HEADER_FONT;
  headerRow.fill = HEADER_FILL;
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Populate data rows
  const rows = flattenTaskGroupsToRows(taskGroups);
  for (const row of rows) {
    sheet.addRow({
      phase: row.phaseName,
      task: row.taskName,
      start: row.startDate,
      end: row.endDate,
      duration: row.duration,
      progress: row.progress,
      status: row.status,
    });
  }

  // Auto-filter on all columns
  sheet.autoFilter = {
    from: 'A1',
    to: `G${rows.length + 1}`,
  };

  // ─── Sheet 2: Summary ─────────────────────────────────────────────

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Μετρική', key: 'metric', width: 30 },
    { header: 'Τιμή', key: 'value', width: 20 },
  ];

  // Style header
  const summaryHeader = summarySheet.getRow(1);
  summaryHeader.font = HEADER_FONT;
  summaryHeader.fill = HEADER_FILL;

  // Calculate summary stats
  const totalPhases = taskGroups.length;
  const totalTasks = rows.length;
  const avgProgress = totalTasks > 0
    ? Math.round(rows.reduce((sum, r) => sum + r.progress, 0) / totalTasks)
    : 0;
  const completedTasks = rows.filter((r) => r.progress >= 100).length;

  summarySheet.addRow({ metric: 'Κτίριο', value: buildingName });
  summarySheet.addRow({ metric: 'Ημ. Εξαγωγής', value: new Date().toLocaleDateString('el-GR') });
  summarySheet.addRow({ metric: 'Συνολικές Φάσεις', value: totalPhases });
  summarySheet.addRow({ metric: 'Συνολικές Εργασίες', value: totalTasks });
  summarySheet.addRow({ metric: 'Ολοκληρωμένες Εργασίες', value: completedTasks });
  summarySheet.addRow({ metric: 'Μέση Πρόοδος %', value: `${avgProgress}%` });

  // ─── Download ─────────────────────────────────────────────────────

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBlobDownload(blob, filename);
}

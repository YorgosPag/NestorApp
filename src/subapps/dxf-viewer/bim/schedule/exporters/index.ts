/**
 * BIM Schedule Export — Exporters Barrel (ADR-363 §6 Phase 8).
 *
 * Public surface για schedule export downloads. UI layer importάρει
 * `downloadScheduleAs*` per chosen `ScheduleExportFormat`. Format-aware
 * dispatcher `downloadSchedule` selects the right exporter.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 */

import type { ExportableTable, ScheduleExportFormat, ScheduleExportOptions } from '../types';
import { downloadScheduleAsCsv, scheduleToCsv } from './csv-exporter';
import type { HeaderTranslator } from './csv-exporter';
import { downloadScheduleAsPdf, scheduleToPdfBlob } from './pdf-exporter';
import { downloadScheduleAsXlsx, scheduleToXlsxBlob } from './xlsx-exporter';

// Re-exports — format-specific entry points (preferred when format known
// at call site; the dispatcher below is for runtime-switched format).
export { downloadScheduleAsCsv, scheduleToCsv } from './csv-exporter';
export { downloadScheduleAsXlsx, scheduleToXlsxBlob, tablesToXlsxBlob } from './xlsx-exporter';
export { downloadScheduleAsPdf, scheduleToPdfBlob, tablesToPdfBlob } from './pdf-exporter';
export type { HeaderTranslator } from './csv-exporter';
export { formatCellForDisplay, formatCellForXlsx, xlsxNumFmtFor } from './value-formatters';

/**
 * Format-aware dispatcher — selects the right exporter per
 * `ScheduleExportFormat`. UI uses this so the format-picker drives
 * download with a single call.
 */
export async function downloadSchedule(
  schedule: ExportableTable,
  format: ScheduleExportFormat,
  options: ScheduleExportOptions,
  translateHeader: HeaderTranslator,
): Promise<void> {
  switch (format) {
    case 'csv':
      downloadScheduleAsCsv(schedule, options, translateHeader);
      return;
    case 'xlsx':
      await downloadScheduleAsXlsx(schedule, options, translateHeader);
      return;
    case 'pdf':
      await downloadScheduleAsPdf(schedule, options, translateHeader);
      return;
  }
}
